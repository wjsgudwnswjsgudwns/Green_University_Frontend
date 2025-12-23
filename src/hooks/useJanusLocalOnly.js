// src/hooks/useJanusLocalOnly.js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useJanusLocalOnly (final - A안 + Screen Picker 강제 + Deny 안내 + "전환=세션 재생성")
 *
 * 정책(합의본 A안)
 * 1) onended(트랙 종료) ≠ 세션 죽음
 *    - screen track onended: 정상 종료 → camera 복귀 + 세션 재생성
 *    - camera track onended: 세션 죽음 단정 X → reinject 1회(가벼운 복구)
 *
 * 2) 카메라 변경/화면공유 시작/종료는 publish/replace가 아니라 "세션 재생성"
 *    - setVideoSource("camera", deviceId)
 *    - setVideoSource("screen") : getDisplayMedia로 Picker 강제 (요구사항)
 *      => mediaRef 의도 저장 → leaveRoom → joinRoom(lastJoin)
 *
 * 3) 진짜 세션 죽음(458/pcDead 등)만 hardReconnect
 *
 * Deny UX
 * - camera deny: permissionDeniedVideo 플래그 + 안내 메시지
 * - screen deny: permissionDeniedScreen 플래그 + 안내 메시지
 *
 * ✅ UI 단일 진실: localMedia
 */
export function useJanusLocalOnly(
    serverUrl = "https://janus.jsflux.co.kr/janus",
    options = {}
) {
    // =========================================================
    // 0) callbacks refs (항상 최신 콜백)
    // =========================================================
    const callbacksRef = useRef({
        onRemoteParticipantsChanged: null,
        onLocalStream: null,
    });

    const mediaSignalRef = useRef({ sendNow: null, send: null });

    const lastSignaledRef = useRef({
        audio: null,
        video: null,
        videoDeviceLost: null,
        videoSource: null,
        screenSoftMuted: null,
        screenCapturing: null,
    });

    useEffect(() => {
        callbacksRef.current.onRemoteParticipantsChanged =
            options?.onRemoteParticipantsChanged || null;
    }, [options?.onRemoteParticipantsChanged]);

    useEffect(() => {
        callbacksRef.current.onLocalStream = options?.onLocalStream || null;
    }, [options?.onLocalStream]);

    useEffect(() => {
        mediaSignalRef.current.sendNow = options?.mediaSignal?.sendNow || null;
        mediaSignalRef.current.send = options?.mediaSignal?.send || null;
    }, [options?.mediaSignal?.sendNow, options?.mediaSignal?.send]);

    // mounted guard
    const mountedRef = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const safeSet = useCallback((fn) => {
        if (!mountedRef.current) return;
        fn();
    }, []);

    // =========================================================
    // 1) State (UI용)
    // =========================================================
    const [isSupported, setIsSupported] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    const DEFAULT_WANT_AUDIO = false; // 입장 기본: 마이크 OFF
    const DEFAULT_WANT_VIDEO = true; // 입장 기본: 비디오 ON(가능하면)

    // legacy / 디버그용
    const [audioEnabled, setAudioEnabled] = useState(DEFAULT_WANT_AUDIO);
    const [videoEnabled, setVideoEnabled] = useState(DEFAULT_WANT_VIDEO);
    const [isVideoDeviceLost, setIsVideoDeviceLost] = useState(false);
    const [noMediaDevices, setNoMediaDevices] = useState(false);

    // ✅ UI 단일 진실(localMedia)
    const [localMedia, setLocalMedia] = useState({
        audio: DEFAULT_WANT_AUDIO,
        video: DEFAULT_WANT_VIDEO,
        videoDeviceLost: false,
        noMediaDevices: false,
        liveAudio: false,
        liveVideo: false,

        videoSource: "camera", // "camera" | "screen"
        cameraDeviceId: null, // string | null

        // ✅ screen soft-mute: "송출만 OFF" (getDisplayMedia 스트림은 유지)
        screenSoftMuted: false,
        // ✅ screen capture가 살아있는지(UI 표시/로직용)
        screenCapturing: false,

        permissionDeniedVideo: false,
        permissionDeniedScreen: false,
    });

    // =========================================================
    // 2) Refs (핵심)
    // =========================================================
    const lastVideoMetaRef = useRef({
        videoSource: null, // "camera" | "screen"
        cameraDeviceId: null, // string | null
    });
    const genRef = useRef(0);
    const closingRef = useRef(false);

    const leaveWaitRef = useRef({ promise: null, resolve: null });
    const resetLeaveWait = useCallback(() => {
        leaveWaitRef.current.promise = new Promise((res) => {
            leaveWaitRef.current.resolve = res;
        });
    }, []);
    useEffect(() => {
        if (!leaveWaitRef.current.promise) resetLeaveWait();
    }, [resetLeaveWait]);

    const bumpGen = useCallback(() => {
        genRef.current += 1;
        return genRef.current;
    }, []);
    const isStale = useCallback((myGen) => {
        return closingRef.current || myGen !== genRef.current;
    }, []);

    const janusRef = useRef({
        janus: null,
        pub: null,
        privateId: null,
        remote: {}, // feedId -> { handle, feedId, display, stream }
        remotePending: {},
        localStream: null,
    });

    const connRef = useRef({ isConnected: false, isConnecting: false });
    useEffect(() => {
        connRef.current.isConnected = isConnected;
    }, [isConnected]);
    useEffect(() => {
        connRef.current.isConnecting = isConnecting;
    }, [isConnecting]);

    const sessionRef = useRef({
        inited: false,
        destroying: false,
        joined: false,
        lastJoin: null, // { roomNumber, displayName }
        bootRetryCount: 0,
        myFeedId: null,
    });

    const timersRef = useRef({
        notify: null,
        deviceDebounce: null,
        deviceCooldown: 0,
        boot: null,

        offerRetry: null,
        offerRetryPending: null, // {audio, video}
        publishDebounce: null,
    });

    const pendingPublishRef = useRef(null);
    const offerErrorCountRef = useRef(0);
    const deadRetryTimerRef = useRef(null);

    // “의도”의 단일 진실(내부)
    const mediaRef = useRef({
        wantAudio: DEFAULT_WANT_AUDIO,
        wantVideo: DEFAULT_WANT_VIDEO,

        noDevices: false,
        hasAudioDevice: true,
        hasVideoDevice: true,

        videoLost: false,

        permissionDeniedVideo: false,
        permissionDeniedScreen: false,

        videoSource: "camera",
        cameraDeviceId: null,

        // screen stream (필수)
        screenStream: null,

        // ✅ screen soft-mute: 송출만 끄고 캡처는 유지
        screenSoftMuted: false,

        screenEndingAt: 0,
    });

    const negotiationRef = useRef({
        locked: false,
        pending: null, // {audio, video}
    });

    const publishedRef = useRef(false);
    const lastConfiguredRef = useRef({ audio: null, video: null });

    const hardReconnectRef = useRef(null);
    const publishLocalStreamRef = useRef(null);
    const forceResubscribeAllRef = useRef(null);
    const recreateSessionRef = useRef(null);

    const preserveScreenOnFinalizeRef = useRef(false);

    // =========================================================
    // 3) toggle 연타 코알레싱(quiet window)
    // =========================================================
    const applyTimerRef = useRef(null);
    const bumpTimerRef = useRef(null);
    const applySeqRef = useRef(0);
    const lastAppliedIntentRef = useRef({
        audio: null,
        video: null,
        videoSource: null,
        screenSoftMuted: null,
    });

    const QUIET_MS = 650;
    const SAFE_BUMP_MS = 900;

    const clearTimer = useCallback((key) => {
        const t = timersRef.current?.[key];
        if (t) {
            window.clearTimeout(t);
            timersRef.current[key] = null;
        }
    }, []);

    const isQuietWindowActive = useCallback(() => {
        return !!applyTimerRef.current;
    }, []);

    const hasLiveTrack = useCallback((stream, kind) => {
        if (!stream) return false;
        const tracks =
            kind === "video"
                ? stream.getVideoTracks?.()
                : stream.getAudioTracks?.();
        return (
            Array.isArray(tracks) && tracks.some((t) => t.readyState === "live")
        );
    }, []);

    // =========================================================
    // 4) Device availability
    // =========================================================
    const refreshDeviceAvailability = useCallback(async () => {
        const md = navigator.mediaDevices;
        if (!md?.enumerateDevices) {
            mediaRef.current.noDevices = true;
            mediaRef.current.hasAudioDevice = false;
            mediaRef.current.hasVideoDevice = false;
            safeSet(() => setNoMediaDevices(true));
            return { hasAudio: false, hasVideo: false, noMediaDevices: true };
        }

        const devices = await md.enumerateDevices().catch(() => null);
        if (!devices) return null;

        const hasAudio = devices.some((d) => d.kind === "audioinput");
        const hasVideo = devices.some((d) => d.kind === "videoinput");
        const none = !hasAudio && !hasVideo;

        mediaRef.current.noDevices = none;
        mediaRef.current.hasAudioDevice = hasAudio;
        mediaRef.current.hasVideoDevice = hasVideo;

        safeSet(() => setNoMediaDevices(none));
        return { hasAudio, hasVideo, noMediaDevices: none };
    }, [safeSet]);

    useEffect(() => {
        refreshDeviceAvailability();
    }, [refreshDeviceAvailability]);

    const getVideoInputs = useCallback(async () => {
        const md = navigator.mediaDevices;
        if (!md?.enumerateDevices) return [];
        const devices = await md.enumerateDevices().catch(() => []);
        return (devices || [])
            .filter((d) => d.kind === "videoinput")
            .map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" }));
    }, []);

    // =========================================================
    // 5) Local media snapshot (UI 단일 진실 갱신)
    // =========================================================
    const signalLocalMedia = useCallback((next, opts = {}) => {
        const { immediate = false, reason = "localMedia" } = opts;

        const sendNow = mediaSignalRef.current.sendNow;
        const send = mediaSignalRef.current.send;
        if (typeof sendNow !== "function" && typeof send !== "function") return;

        const prev = lastSignaledRef.current;

        const changed =
            prev.audio !== next.audio ||
            prev.video !== next.video ||
            prev.videoDeviceLost !== next.videoDeviceLost ||
            prev.videoSource !== next.videoSource ||
            prev.screenSoftMuted !== next.screenSoftMuted ||
            prev.screenCapturing !== next.screenCapturing;

        if (!changed) return;

        lastSignaledRef.current = {
            audio: next.audio,
            video: next.video,
            videoDeviceLost: next.videoDeviceLost,
            videoSource: next.videoSource,
            screenSoftMuted: next.screenSoftMuted,
            screenCapturing: next.screenCapturing,
        };

        const extra = {
            videoDeviceLost: !!next.videoDeviceLost,
            videoSource: next.videoSource || "camera",
            screenSoftMuted: !!next.screenSoftMuted,
            screenCapturing: !!next.screenCapturing,
            reason,
        };

        // ✅ audio/video는 기존 프로토콜 유지, 나머지는 extra로 확장
        if (immediate && typeof sendNow === "function") {
            sendNow(!!next.audio, !!next.video, extra);
            return;
        }
        if (typeof send === "function") {
            send(!!next.audio, !!next.video, extra);
            return;
        }
        if (typeof sendNow === "function") {
            sendNow(!!next.audio, !!next.video, extra);
        }
    }, []);

    const emitLocalMediaState = useCallback(() => {
        const s = janusRef.current.localStream;

        const liveAudio = hasLiveTrack(s, "audio");
        const liveVideo = hasLiveTrack(s, "video");

        const wantAudio = !!mediaRef.current.wantAudio;
        const wantVideo = !!mediaRef.current.wantVideo;

        const screenStream = mediaRef.current.screenStream;
        const screenCapturing = hasLiveTrack(screenStream, "video");

        const videoDeviceLost =
            !!mediaRef.current.videoLost ||
            (!!wantVideo &&
                !liveVideo &&
                !!mediaRef.current.hasVideoDevice &&
                !mediaRef.current.noDevices);

        const next = {
            audio: wantAudio,
            video: wantVideo,
            videoDeviceLost: !!videoDeviceLost,
            noMediaDevices: !!mediaRef.current.noDevices,
            liveAudio: !!liveAudio,
            liveVideo: !!liveVideo,

            videoSource: mediaRef.current.videoSource || "camera",
            cameraDeviceId: mediaRef.current.cameraDeviceId ?? null,

            // ✅ screen 관련 상태
            screenSoftMuted: !!mediaRef.current.screenSoftMuted,
            screenCapturing: !!screenCapturing,

            permissionDeniedVideo: !!mediaRef.current.permissionDeniedVideo,
            permissionDeniedScreen: !!mediaRef.current.permissionDeniedScreen,
        };
        signalLocalMedia(next, {
            immediate: false,
            reason: "emitLocalMediaState",
        });
        safeSet(() => {
            setLocalMedia((prev) => {
                const same =
                    prev.audio === next.audio &&
                    prev.video === next.video &&
                    prev.videoDeviceLost === next.videoDeviceLost &&
                    prev.noMediaDevices === next.noMediaDevices &&
                    prev.liveAudio === next.liveAudio &&
                    prev.liveVideo === next.liveVideo &&
                    prev.videoSource === next.videoSource &&
                    prev.cameraDeviceId === next.cameraDeviceId &&
                    prev.screenSoftMuted === next.screenSoftMuted &&
                    prev.screenCapturing === next.screenCapturing &&
                    prev.permissionDeniedVideo === next.permissionDeniedVideo &&
                    prev.permissionDeniedScreen === next.permissionDeniedScreen;
                return same ? prev : next;
            });

            setAudioEnabled(wantAudio);
            setVideoEnabled(wantVideo);
            setIsVideoDeviceLost(!!videoDeviceLost);
            setNoMediaDevices(!!mediaRef.current.noDevices);
        });
    }, [hasLiveTrack, safeSet]);

    useEffect(() => {
        emitLocalMediaState();
    }, [emitLocalMediaState]);

    // =========================================================
    // 6) Remote participants notify (debounce)
    // =========================================================
    const flushRemoteParticipants = useCallback(() => {
        timersRef.current.notify = null;

        const fn = callbacksRef.current.onRemoteParticipantsChanged;
        if (typeof fn !== "function") return;

        const list = Object.values(janusRef.current.remote || {}).map(
            (info) => {
                const stream = info.stream || null;
                const audioTracks = stream?.getAudioTracks?.() || [];
                const videoTracks = stream?.getVideoTracks?.() || [];

                return {
                    feedId: info.feedId,
                    id: info.feedId,
                    display: info.display,
                    stream,

                    ...(typeof info.display === "string"
                        ? (() => {
                              try {
                                  const parsed = JSON.parse(info.display);
                                  return {
                                      userId: parsed?.userId ?? null,
                                      name: parsed?.name ?? null,
                                      role: parsed?.role ?? null,
                                  };
                              } catch {
                                  return {
                                      userId: null,
                                      name: null,
                                      role: null,
                                  };
                              }
                          })()
                        : { userId: null, name: null, role: null }),

                    hasLiveVideo: stream
                        ? hasLiveTrack(stream, "video")
                        : false,
                    hasLiveAudio: stream
                        ? hasLiveTrack(stream, "audio")
                        : false,

                    dead: stream
                        ? !(audioTracks.length > 0 || videoTracks.length > 0)
                        : false,
                    videoDead: stream ? videoTracks.length === 0 : false,
                };
            }
        );

        try {
            fn(list);
        } catch (e) {
            console.error(
                "[useJanusLocalOnly] onRemoteParticipantsChanged error",
                e
            );
        }
    }, [hasLiveTrack]);

    const notifyRemoteParticipantsChanged = useCallback(() => {
        if (timersRef.current.notify) return;
        timersRef.current.notify = window.setTimeout(
            flushRemoteParticipants,
            80
        );
    }, [flushRemoteParticipants]);

    // =========================================================
    // 7) negotiation lock + publish debounce
    // =========================================================
    const lockNegotiation = useCallback(() => {
        if (negotiationRef.current.locked) return false;
        negotiationRef.current.locked = true;
        return true;
    }, []);

    const scheduleApplyIntent = useCallback((reason = "toggle") => {
        const seq = ++applySeqRef.current;

        // reset timers
        if (applyTimerRef.current) {
            window.clearTimeout(applyTimerRef.current);
            applyTimerRef.current = null;
        }
        if (bumpTimerRef.current) {
            window.clearTimeout(bumpTimerRef.current);
            bumpTimerRef.current = null;
        }

        const canApply = () => {
            if (!connRef.current.isConnected) return false;
            if (!janusRef.current.pub) return false;
            if (closingRef.current || sessionRef.current.destroying)
                return false;

            const vs = mediaRef.current.videoSource || "camera";
            const isScreen = vs === "screen";

            // camera deny면 camera에서만 막기
            if (!isScreen && !!mediaRef.current.permissionDeniedVideo)
                return false;
            // screen deny면 screen에서 막기
            if (isScreen && !!mediaRef.current.permissionDeniedScreen)
                return false;

            // screen인데 stream 없고 softMuted도 아니면(=진짜 켜려는 중인데 아직 picker 전) 적용 금지
            if (
                isScreen &&
                !mediaRef.current.screenSoftMuted &&
                !mediaRef.current.screenStream
            ) {
                return false;
            }

            return true;
        };

        const snapshotIntent = () => {
            const a = !!mediaRef.current.wantAudio;
            const v = !!mediaRef.current.wantVideo;
            const vs = mediaRef.current.videoSource || "camera";
            const ssm = !!mediaRef.current.screenSoftMuted;
            return { a, v, vs, ssm };
        };

        const isSameAsLast = ({ a, v, vs, ssm }) => {
            const last = lastAppliedIntentRef.current;
            return (
                last.audio === a &&
                last.video === v &&
                last.videoSource === vs &&
                last.screenSoftMuted === ssm
            );
        };

        const markApplied = ({ a, v, vs, ssm }) => {
            lastAppliedIntentRef.current = {
                audio: a,
                video: v,
                videoSource: vs,
                screenSoftMuted: ssm,
            };
        };

        const applyOnce = (tag) => {
            if (seq !== applySeqRef.current) return;
            if (!canApply()) return;

            const cur = snapshotIntent();
            if (isSameAsLast(cur)) return;

            // 협상 락/리트라이 중이면 pending만 쌓고 빠짐
            if (negotiationRef.current.locked || timersRef.current.offerRetry) {
                negotiationRef.current.pending = { audio: cur.a, video: cur.v };
                return;
            }

            markApplied(cur);
            publishLocalStreamRef.current?.(cur.a, cur.v, {
                republish: true,
                reason: `${reason}${tag ? "." + tag : ""}`,
            });
        };

        // QUIET window 후 1회 적용
        applyTimerRef.current = window.setTimeout(() => {
            applyTimerRef.current = null;
            applyOnce("apply");

            // ✅ screen이면 bump 금지 (중복 offer/addTrack 방지)
            const vsNow = mediaRef.current.videoSource || "camera";
            const isScreenNow = vsNow === "screen";

            if (!isScreenNow) {
                bumpTimerRef.current = window.setTimeout(() => {
                    bumpTimerRef.current = null;
                    applyOnce("bump");
                }, SAFE_BUMP_MS);
            }
        }, QUIET_MS);
    }, []);

    const unlockNegotiation = useCallback(() => {
        negotiationRef.current.locked = false;

        const p = negotiationRef.current.pending;
        if (!p) return;

        // deny면 pending 폐기
        const vs = mediaRef.current.videoSource || "camera";
        const isScreen = vs === "screen";
        if (!isScreen && mediaRef.current.permissionDeniedVideo) {
            negotiationRef.current.pending = null;
            return;
        }
        if (isScreen && mediaRef.current.permissionDeniedScreen) {
            negotiationRef.current.pending = null;
            return;
        }

        // 다음 quiet window로 처리(즉시 publish 하지 않음)
        negotiationRef.current.pending = null;
        scheduleApplyIntent("unlock-pending");
    }, [scheduleApplyIntent]);

    const queuePublish = useCallback(
        (audio, video, opts = {}) => {
            pendingPublishRef.current = {
                audio: !!audio,
                video: !!video,
                opts,
            };

            clearTimer("publishDebounce");
            timersRef.current.publishDebounce = window.setTimeout(() => {
                timersRef.current.publishDebounce = null;

                const p = pendingPublishRef.current;
                pendingPublishRef.current = null;
                if (!p) return;

                publishLocalStreamRef.current?.(p.audio, p.video, p.opts);
            }, 180);
        },
        [clearTimer]
    );

    const reinjectIfPossible = useCallback(() => {
        if (!connRef.current.isConnected) return;
        if (!janusRef.current.pub) return;
        if (negotiationRef.current.locked) return;

        const isScreen =
            (mediaRef.current.videoSource || "camera") === "screen";
        const cameraDenied =
            !!mediaRef.current.permissionDeniedVideo && !isScreen;
        if (cameraDenied) return;

        queuePublish(mediaRef.current.wantAudio, mediaRef.current.wantVideo, {
            republish: true,
            reason: "reinject",
        });
    }, [queuePublish]);

    // =========================================================
    // 8) Local stream setter (onended 의미 분리)
    // =========================================================
    const setLocalStream = useCallback(
        (stream) => {
            janusRef.current.localStream = stream || null;

            const fn = callbacksRef.current.onLocalStream;
            if (typeof fn === "function") {
                try {
                    fn(stream || null);
                } catch (e) {
                    console.error("[useJanusLocalOnly] onLocalStream error", e);
                }
            }

            if (!stream) {
                emitLocalMediaState();
                return;
            }

            // video track 종료 의미 분리
            stream.getVideoTracks?.().forEach((track) => {
                const onDead = () => {
                    // ✅ screenStream 쪽 onended가 먼저 처리된 직후라면,
                    // setLocalStream 쪽 onended는 무시(꼬임 방지)
                    const recentlyScreenEnded =
                        Date.now() - (mediaRef.current.screenEndingAt || 0) <
                        1500;
                    if (recentlyScreenEnded) return;
                    // screen 종료는 정상 시나리오 → camera 복귀 + 세션 재생성
                    if (mediaRef.current.videoSource === "screen") {
                        mediaRef.current.videoSource = "camera";

                        // screenStream 정리
                        try {
                            const ss = mediaRef.current.screenStream;
                            ss?.getTracks?.().forEach((t) => {
                                try {
                                    t.stop();
                                } catch {}
                            });
                        } catch {}
                        mediaRef.current.screenStream = null;

                        emitLocalMediaState();
                        recreateSessionRef.current?.("screen-ended");
                        return;
                    }

                    // camera onended는 세션 죽음으로 단정 X → reinject 1회
                    if (deadRetryTimerRef.current)
                        window.clearTimeout(deadRetryTimerRef.current);

                    deadRetryTimerRef.current = window.setTimeout(() => {
                        deadRetryTimerRef.current = null;

                        if (closingRef.current || sessionRef.current.destroying)
                            return;
                        if (!connRef.current.isConnected) return;

                        const isScreen =
                            (mediaRef.current.videoSource || "camera") ===
                            "screen";
                        const cameraDenied =
                            !!mediaRef.current.permissionDeniedVideo &&
                            !isScreen;
                        if (cameraDenied) return;

                        if (negotiationRef.current.locked) return;
                        reinjectIfPossible();
                    }, 600);
                };

                track.onended = onDead;
                if (track.oninactive == null) track.oninactive = onDead;
            });

            emitLocalMediaState();
        },
        [emitLocalMediaState, reinjectIfPossible]
    );

    // =========================================================
    // 9) Remote feed attach/detach/reset
    // =========================================================
    const detachRemoteFeed = useCallback(
        (feedId, { skipHandleCleanup = false } = {}) => {
            const info = janusRef.current.remote?.[feedId];
            delete janusRef.current.remotePending?.[feedId];
            if (!info) return;

            if (!skipHandleCleanup) {
                try {
                    info.handle?.hangup?.();
                    info.handle?.detach?.();
                } catch {}
            }
            delete janusRef.current.remote[feedId];
        },
        []
    );

    const resetRemoteFeeds = useCallback(() => {
        try {
            Object.values(janusRef.current.remote || {}).forEach((info) => {
                try {
                    info.handle?.hangup?.();
                    info.handle?.detach?.();
                } catch {}
            });
        } catch {}
        janusRef.current.remote = {};
        janusRef.current.remotePending = {};
        notifyRemoteParticipantsChanged();
    }, [notifyRemoteParticipantsChanged]);

    const newRemoteFeed = useCallback(
        (feedId, display, roomNumber) => {
            const myGen = genRef.current;
            const Janus = window.Janus;
            if (!Janus || !janusRef.current.janus) return;

            const existing = janusRef.current.remote[feedId];
            if (existing) {
                const pcAlive = !!existing.handle?.webrtcStuff?.pc;
                const hasStream = !!existing.stream;
                if (pcAlive && hasStream) return;
                detachRemoteFeed(feedId);
            }
            if (janusRef.current.remotePending?.[feedId]) return;

            janusRef.current.remotePending[feedId] = true;

            const safeDisplay =
                display ??
                JSON.stringify({
                    name: `User${feedId}`,
                    role: "PARTICIPANT",
                    userId: null,
                });

            janusRef.current.janus.attach({
                plugin: "janus.plugin.videoroom",

                success: (handle) => {
                    if (isStale(myGen)) {
                        delete janusRef.current.remotePending[feedId];
                        try {
                            handle?.detach?.();
                        } catch {}
                        return;
                    }

                    delete janusRef.current.remotePending[feedId];
                    janusRef.current.remote[feedId] = {
                        handle,
                        feedId,
                        display: safeDisplay,
                        stream: null,
                    };

                    const subscribe = {
                        request: "join",
                        room: Number(roomNumber),
                        ptype: "subscriber",
                        feed: feedId,
                    };
                    if (janusRef.current.privateId)
                        subscribe.private_id = janusRef.current.privateId;

                    handle.send({ message: subscribe });
                    notifyRemoteParticipantsChanged();
                },

                error: (err) => {
                    delete janusRef.current.remotePending[feedId];
                    if (isStale(myGen)) return;
                    console.error("[subscriber] attach error:", err);
                },

                onmessage: (msg, jsep) => {
                    if (isStale(myGen)) return;
                    if (!jsep) return;

                    const info = janusRef.current.remote[feedId];
                    const handle = info?.handle;
                    if (!handle) return;

                    const jtype = jsep?.type;
                    if (jtype && jtype !== "offer") return;

                    info.answerToken = (info.answerToken || 0) + 1;
                    const token = info.answerToken;

                    handle.createAnswer({
                        jsep,
                        media: {
                            audioSend: false,
                            videoSend: false,
                            audioRecv: true,
                            videoRecv: true,
                        },
                        success: (jsepAnswer) => {
                            if (isStale(myGen)) return;

                            const cur = janusRef.current.remote?.[feedId];
                            if (!cur) return;
                            if (cur.handle !== handle) return;
                            if (cur.answerToken !== token) return;

                            const pc = handle?.webrtcStuff?.pc;

                            const senders = pc?.getSenders?.() || [];
                            console.log(
                                "[pub] senders",
                                senders.map((s) => ({
                                    kind: s.track?.kind,
                                    readyState: s.track?.readyState,
                                    id: s.track?.id,
                                }))
                            );

                            if (!pc) return;

                            handle.send({
                                message: {
                                    request: "start",
                                    room: Number(roomNumber),
                                },
                                jsep: jsepAnswer,
                            });
                        },
                        error: (err) => {
                            if (isStale(myGen)) return;
                            console.error(
                                "[subscriber] createAnswer error:",
                                err
                            );
                        },
                    });
                },

                onremotestream: (stream) => {
                    if (isStale(myGen)) return;
                    const prev = janusRef.current.remote[feedId];
                    if (!prev) return;
                    janusRef.current.remote[feedId] = { ...prev, stream };
                    notifyRemoteParticipantsChanged();
                },

                oncleanup: () => {
                    if (isStale(myGen)) return;

                    const cur = janusRef.current.remote?.[feedId];
                    if (!cur) return;
                    const pc = cur.handle?.webrtcStuff?.pc;
                    if (!pc) {
                        detachRemoteFeed(feedId, { skipHandleCleanup: true });
                        notifyRemoteParticipantsChanged();
                        return;
                    }
                    janusRef.current.remote[feedId] = { ...cur, stream: null };
                    notifyRemoteParticipantsChanged();
                },
            });
        },
        [detachRemoteFeed, notifyRemoteParticipantsChanged, isStale]
    );

    const forceResubscribeAll = useCallback(
        (roomNumber, reason = "resub") => {
            const h = janusRef.current.pub;
            if (!h) return;
            if (closingRef.current || sessionRef.current.destroying) return;

            const myGen = genRef.current;
            h.send({
                message: {
                    request: "listparticipants",
                    room: Number(roomNumber),
                },
                success: (result) => {
                    if (isStale(myGen)) return;

                    const d = result?.plugindata?.data || result || {};
                    const parts = d.participants || [];

                    parts.forEach((p) => {
                        if (!p?.id) return;
                        const myFeedId = sessionRef.current.myFeedId;
                        if (myFeedId && p.id === myFeedId) return;

                        if (janusRef.current.remote?.[p.id])
                            detachRemoteFeed(p.id);
                        newRemoteFeed(p.id, p.display, roomNumber);
                    });

                    notifyRemoteParticipantsChanged();
                    console.log("[forceResubscribeAll]", {
                        roomNumber,
                        reason,
                    });
                },
                error: (e) => {
                    console.warn(
                        "[forceResubscribeAll] listparticipants fail",
                        e
                    );
                },
            });
        },
        [
            detachRemoteFeed,
            newRemoteFeed,
            notifyRemoteParticipantsChanged,
            isStale,
        ]
    );

    useEffect(() => {
        forceResubscribeAllRef.current = forceResubscribeAll;
    }, [forceResubscribeAll]);

    // =========================================================
    // 10) publish / republish (screenStream 지원)
    // =========================================================
    const publishLocalStream = useCallback(
        async (intentAudio = true, intentVideo = true, opts = {}) => {
            const Janus = window.Janus;
            const handle = janusRef.current.pub;
            if (!Janus || !handle) return;

            // offerRetry 중엔 마지막 의도만 저장
            if (timersRef.current.offerRetry) {
                negotiationRef.current.pending = {
                    audio: !!intentAudio,
                    video: !!intentVideo,
                };
                timersRef.current.offerRetryPending = {
                    audio: !!intentAudio,
                    video: !!intentVideo,
                };
                safeSet(() => setIsConnecting(false));
                return;
            }

            const isScreen =
                (mediaRef.current.videoSource || "camera") === "screen";
            const screenSoftMuted =
                isScreen && !!mediaRef.current.screenSoftMuted;

            if (
                isScreen &&
                !screenSoftMuted &&
                !mediaRef.current.screenStream
            ) {
                emitLocalMediaState();
                safeSet(() => setIsConnecting(false));
                return;
            }
            // ✅ camera deny는 camera에서만 막기 (screen은 허용)
            const cameraDenied =
                !!mediaRef.current.permissionDeniedVideo && !isScreen;
            const intentVideoSafe = cameraDenied ? false : !!intentVideo;

            // 의도 저장
            mediaRef.current.wantAudio = !!intentAudio;
            mediaRef.current.wantVideo = !!intentVideoSafe;

            safeSet(() => {
                setAudioEnabled(!!intentAudio);
                setVideoEnabled(!!intentVideoSafe);
            });

            await refreshDeviceAvailability().catch(() => null);

            const noDev = !!mediaRef.current.noDevices;
            const hasA = !!mediaRef.current.hasAudioDevice;
            const hasV = !!mediaRef.current.hasVideoDevice;

            const wantAudio = !!intentAudio && !noDev && hasA;

            // ✅ screen은 "캡처가 살아있더라도" soft-mute면 송출은 OFF로 본다
            const wantVideo =
                !!intentVideoSafe &&
                (isScreen ? (screenSoftMuted ? false : true) : !noDev && hasV);

            if (!wantVideo) {
                mediaRef.current.videoLost = false;
                safeSet(() => setIsVideoDeviceLost(false));
            }

            emitLocalMediaState();

            // 미디어 없이 참가
            if (!wantAudio && !wantVideo) {
                try {
                    handle.send({
                        message: {
                            request: "configure",
                            audio: false,
                            video: false,
                        },
                    });
                    publishedRef.current = true;
                    safeSet(() => setIsConnecting(false));
                    emitLocalMediaState();
                } catch {
                    safeSet(() => {
                        setError(
                            "미디어 없이 참가 처리 중 오류가 발생했습니다."
                        );
                        setIsConnecting(false);
                    });
                }
                return;
            }

            // 협상 락
            if (!lockNegotiation()) {
                negotiationRef.current.pending = {
                    audio: !!intentAudio,
                    video: !!intentVideo,
                };
                return;
            }

            const prev = lastConfiguredRef.current;
            const republish = !!opts.republish || publishedRef.current;

            const currentVideoSource = mediaRef.current.videoSource || "camera";
            const currentCameraId = mediaRef.current.cameraDeviceId ?? null;

            const prevMeta = lastVideoMetaRef.current;
            const sourceChanged =
                prevMeta.videoSource !== currentVideoSource ||
                prevMeta.cameraDeviceId !== currentCameraId;

            // ✅ 소스가 바뀌면 replaceVideo를 강제 true
            const replaceAudio = republish ? prev.audio !== !!wantAudio : true;
            const replaceVideo = republish
                ? prev.video !== !!wantVideo || sourceChanged
                : true;

            const cameraDeviceId = mediaRef.current.cameraDeviceId;
            const mediaCfg = {
                audioRecv: false,
                videoRecv: false,
                audioSend: !!wantAudio,
                videoSend: !!wantVideo,
                replaceAudio,
                replaceVideo,
            };

            if (wantVideo) {
                if (isScreen) {
                    // 힌트(있으면 도움) + 실제 stream 전달이 핵심
                    mediaCfg.video = "screen";
                } else if (cameraDeviceId) {
                    mediaCfg.video = { deviceId: { exact: cameraDeviceId } };
                }
            }

            const offerArgs = {
                media: mediaCfg,
                success: (jsep) => {
                    const prevCfg = { ...lastConfiguredRef.current };
                    try {
                        handle.send({
                            message: {
                                request: "configure",
                                audio: !!wantAudio,
                                video: !!wantVideo,
                            },
                            jsep,
                        });

                        publishedRef.current = true;
                        lastConfiguredRef.current = {
                            audio: !!wantAudio,
                            video: !!wantVideo,
                        };

                        lastVideoMetaRef.current = {
                            videoSource: currentVideoSource,
                            cameraDeviceId: currentCameraId,
                        };

                        // video on 직후 subscriber resub
                        if (!prevCfg.video && !!wantVideo) {
                            const roomNumber =
                                sessionRef.current.lastJoin?.roomNumber;
                            if (roomNumber) {
                                window.setTimeout(() => {
                                    if (closingRef.current) return;
                                    if (!connRef.current.isConnected) return;
                                    forceResubscribeAllRef.current?.(
                                        roomNumber,
                                        "video-on"
                                    );
                                }, 150);
                            }
                        }

                        offerErrorCountRef.current = 0;

                        if (wantVideo) {
                            mediaRef.current.videoLost = false;

                            // ✅ 성공 시 deny 해제: camera/screen 각각만 해제
                            if (!isScreen)
                                mediaRef.current.permissionDeniedVideo = false;
                            if (isScreen)
                                mediaRef.current.permissionDeniedScreen = false;

                            safeSet(() => setIsVideoDeviceLost(false));
                        }

                        const latest =
                            handle?.webrtcStuff?.myStream ||
                            handle?.webrtcStuff?.stream ||
                            null;

                        console.log("[pub] myStream tracks", {
                            a: latest
                                ?.getAudioTracks?.()
                                .map((t) => t.readyState),
                            v: latest
                                ?.getVideoTracks?.()
                                .map((t) => t.readyState),
                        });
                        console.log("[pub] screenStream tracks", {
                            v: mediaRef.current.screenStream
                                ?.getVideoTracks?.()
                                .map((t) => t.readyState),
                        });

                        if (latest) setLocalStream(latest);

                        safeSet(() => setIsConnecting(false));
                        emitLocalMediaState();
                    } finally {
                        unlockNegotiation();
                    }
                },

                error: async (err) => {
                    console.error(
                        "[useJanusLocalOnly] createOffer error:",
                        err
                    );

                    const name = err?.name || "";
                    const msg = String(err?.message || "").toLowerCase();

                    const isPermissionDenied =
                        name === "NotAllowedError" ||
                        name === "PermissionDeniedError" ||
                        msg.includes("permission") ||
                        msg.includes("denied");

                    const isDeviceNotFound =
                        name === "NotFoundError" ||
                        name === "DevicesNotFoundError" ||
                        msg.includes("notfound") ||
                        msg.includes("device not found") ||
                        msg.includes("no capture device");

                    const screenWord =
                        msg.includes("getdisplaymedia") ||
                        msg.includes("display") ||
                        msg.includes("screen");

                    const isScreenNow =
                        (mediaRef.current.videoSource || "camera") === "screen";
                    const isScreenDenied =
                        isScreenNow && isPermissionDenied && screenWord;

                    // 권한/디바이스 없음은 즉시 다운그레이드(재시도/리커넥트 금지)
                    if (isPermissionDenied || isDeviceNotFound) {
                        if (timersRef.current.offerRetry) {
                            clearTimeout(timersRef.current.offerRetry);
                            timersRef.current.offerRetry = null;
                        }
                        timersRef.current.offerRetryPending = null;

                        negotiationRef.current.pending = null;
                        negotiationRef.current.locked = false;

                        try {
                            setLocalStream(null);
                        } catch {}

                        if (isPermissionDenied) {
                            mediaRef.current.videoLost = true;

                            if (isScreenDenied) {
                                mediaRef.current.permissionDeniedScreen = true;
                                safeSet(() => {
                                    setIsConnecting(false);
                                    setError(
                                        "화면 공유 권한이 거부되어 시작할 수 없습니다. 브라우저/사이트 설정에서 화면 공유(캡처) 권한을 허용으로 변경한 뒤 다시 시도해 주세요."
                                    );
                                });
                            } else {
                                mediaRef.current.permissionDeniedVideo = true;
                                safeSet(() => {
                                    setVideoEnabled(false);
                                    setIsVideoDeviceLost(true);
                                    setIsConnecting(false);
                                    setError(
                                        "카메라 권한이 거부되어 영상 송출이 불가능합니다. 브라우저 권한을 허용한 뒤 다시 시도하세요."
                                    );
                                });
                            }
                        } else {
                            await refreshDeviceAvailability().catch(() => null);
                            mediaRef.current.videoLost = false;
                            mediaRef.current.permissionDeniedVideo = false;
                            mediaRef.current.permissionDeniedScreen = false;

                            safeSet(() => {
                                setIsVideoDeviceLost(false);
                                setIsConnecting(false);
                                setError(
                                    isScreenNow
                                        ? "화면 공유 시작에 실패했습니다(디바이스/환경)."
                                        : "카메라를 찾을 수 없습니다. 장치 연결/점유 상태를 확인해 주세요."
                                );
                            });
                        }

                        // 미디어 없이 참가로 안정화
                        try {
                            handle.send({
                                message: {
                                    request: "configure",
                                    audio: false,
                                    video: false,
                                },
                            });
                            publishedRef.current = true;
                            lastConfiguredRef.current = {
                                audio: false,
                                video: false,
                            };
                        } catch {}

                        emitLocalMediaState();
                        return;
                    }

                    // ---- 여기부터는 '일시적/불명 오류'에만 재시도/리커넥트 허용 ----
                    offerErrorCountRef.current += 1;

                    if (timersRef.current.offerRetry) {
                        clearTimeout(timersRef.current.offerRetry);
                        timersRef.current.offerRetry = null;
                    }

                    const pc = janusRef.current.pub?.webrtcStuff?.pc;
                    const pcDead =
                        !pc ||
                        pc.connectionState === "closed" ||
                        pc.iceConnectionState === "closed";

                    if (pcDead) {
                        negotiationRef.current.pending = null;
                        negotiationRef.current.locked = false;
                        safeSet(() => setIsConnecting(false));
                        hardReconnectRef.current?.("createOffer.pc-dead");
                        return;
                    }

                    timersRef.current.offerRetry = window.setTimeout(() => {
                        timersRef.current.offerRetry = null;

                        const p = negotiationRef.current.pending;
                        if (!p) return;

                        negotiationRef.current.pending = null;

                        if (closingRef.current || sessionRef.current.destroying)
                            return;
                        if (!connRef.current.isConnected) return;

                        const isScreen2 =
                            (mediaRef.current.videoSource || "camera") ===
                            "screen";
                        const cameraDenied2 =
                            !!mediaRef.current.permissionDeniedVideo &&
                            !isScreen2;
                        if (cameraDenied2) return;

                        if (negotiationRef.current.locked) {
                            negotiationRef.current.pending = p;
                            return;
                        }

                        publishLocalStreamRef.current?.(p.audio, p.video, {
                            republish: true,
                        });

                        const pending =
                            timersRef.current.offerRetryPending || null;
                        timersRef.current.offerRetryPending = null;
                        if (!pending) return;

                        if (closingRef.current || sessionRef.current.destroying)
                            return;
                        if (!connRef.current.isConnected) return;
                        if (!janusRef.current.pub) return;

                        const isScreen3 =
                            (mediaRef.current.videoSource || "camera") ===
                            "screen";
                        const cameraDenied3 =
                            !!mediaRef.current.permissionDeniedVideo &&
                            !isScreen3;
                        if (cameraDenied3) return;

                        if (negotiationRef.current.locked) {
                            negotiationRef.current.pending = pending;
                            return;
                        }

                        publishLocalStreamRef.current?.(
                            pending.audio,
                            pending.video,
                            { republish: true }
                        );
                    }, 2500);

                    if (offerErrorCountRef.current >= 3) {
                        mediaRef.current.videoLost = true;
                        try {
                            setLocalStream(null);
                        } catch {}
                        safeSet(() => {
                            setIsVideoDeviceLost(true);
                            setIsConnecting(false);
                            setError(
                                "영상 송출 재협상이 반복 실패했습니다. 카메라(점유/드라이버/권한)를 확인해 주세요."
                            );
                        });

                        try {
                            handle.send({
                                message: {
                                    request: "configure",
                                    audio: false,
                                    video: false,
                                },
                            });
                            publishedRef.current = true;
                            lastConfiguredRef.current = {
                                audio: false,
                                video: false,
                            };
                        } catch {}

                        emitLocalMediaState();
                        return;
                    }

                    if (wantVideo) {
                        mediaRef.current.videoLost = true;
                        safeSet(() => setIsVideoDeviceLost(true));
                        emitLocalMediaState();
                        safeSet(() => setIsConnecting(false));

                        try {
                            handle.send({
                                message: {
                                    request: "configure",
                                    audio: false,
                                    video: false,
                                },
                            });
                            publishedRef.current = true;
                            lastConfiguredRef.current = {
                                audio: false,
                                video: false,
                            };
                        } catch {}
                        return;
                    }

                    safeSet(() => setIsConnecting(false));
                },
            };

            // ✅ screen이면 stream을 실제로 넘겨 publish (가장 안정)
            if (isScreen && !screenSoftMuted && mediaRef.current.screenStream) {
                offerArgs.stream = mediaRef.current.screenStream;
            }
            // ✅ (추가) screen 트랙이 이미 sender에 붙어있으면 중복 offer/addTrack 방지
            if (
                isScreen &&
                !screenSoftMuted &&
                mediaRef.current.screenStream &&
                wantVideo
            ) {
                const pc = handle?.webrtcStuff?.pc;
                const track =
                    mediaRef.current.screenStream.getVideoTracks?.()[0] || null;

                if (pc && track && pc.getSenders) {
                    const already = pc
                        .getSenders()
                        .some((s) => s?.track?.id === track.id);
                    if (already) {
                        try {
                            handle.send({
                                message: {
                                    request: "configure",
                                    audio: !!wantAudio,
                                    video: !!wantVideo,
                                },
                            });

                            publishedRef.current = true;
                            lastConfiguredRef.current = {
                                audio: !!wantAudio,
                                video: !!wantVideo,
                            };
                            lastVideoMetaRef.current = {
                                videoSource: currentVideoSource,
                                cameraDeviceId: currentCameraId,
                            };
                        } catch {}

                        safeSet(() => setIsConnecting(false));
                        emitLocalMediaState();
                        unlockNegotiation();
                        return;
                    }
                }
            }

            handle.createOffer(offerArgs);
        },
        [
            emitLocalMediaState,
            lockNegotiation,
            refreshDeviceAvailability,
            safeSet,
            setLocalStream,
            unlockNegotiation,
        ]
    );

    useEffect(() => {
        publishLocalStreamRef.current = publishLocalStream;
    }, [publishLocalStream]);

    // =========================================================
    // 11) finalize / cleanup (정리 버전 - preserve 안전 보장)
    // =========================================================
    const finalizedOnceRef = useRef(false);

    const finalize = useCallback(
        (reason = "finalize") => {
            const preserve = preserveScreenOnFinalizeRef.current === true;
            screenPickerLockRef.current = false;
            // ✅ finalize 1회 보장
            if (finalizedOnceRef.current) return;
            finalizedOnceRef.current = true;

            // -------------------------
            // A) 타이머/대기/락 정리
            // -------------------------
            const clearAllTimers = () => {
                clearTimer("notify");
                clearTimer("deviceDebounce");
                clearTimer("boot");
                clearTimer("publishDebounce");

                if (timersRef.current.offerRetry) {
                    window.clearTimeout(timersRef.current.offerRetry);
                    timersRef.current.offerRetry = null;
                }
                timersRef.current.offerRetryPending = null;
                pendingPublishRef.current = null;

                if (applyTimerRef.current) {
                    window.clearTimeout(applyTimerRef.current);
                    applyTimerRef.current = null;
                }
                if (bumpTimerRef.current) {
                    window.clearTimeout(bumpTimerRef.current);
                    bumpTimerRef.current = null;
                }
                applySeqRef.current += 1;
                lastAppliedIntentRef.current = {
                    audio: null,
                    video: null,
                    videoSource: null,
                    screenSoftMuted: null,
                };

                if (deadRetryTimerRef.current) {
                    window.clearTimeout(deadRetryTimerRef.current);
                    deadRetryTimerRef.current = null;
                }
            };

            // -------------------------
            // B) screenStream 정리(진짜 종료에서만)
            // -------------------------
            const cleanupScreenStreamIfNeeded = () => {
                if (preserve) return;

                try {
                    const ss = mediaRef.current.screenStream;
                    ss?.getTracks?.().forEach((t) => {
                        try {
                            t.stop();
                        } catch {}
                    });
                } catch {}
                mediaRef.current.screenStream = null;

                mediaRef.current.screenSoftMuted = false;
                mediaRef.current.videoSource = "camera";
                mediaRef.current.cameraDeviceId = null;
                mediaRef.current.permissionDeniedScreen = false;
            };

            // -------------------------
            // C) localStream 정리
            //   - preserve일 때는 절대 stop() 금지 (screen 캡처가 같이 죽을 수 있음)
            // -------------------------
            const cleanupLocalStream = () => {
                try {
                    const s = janusRef.current.localStream;
                    if (s) {
                        s.getTracks?.().forEach((t) => {
                            try {
                                t.onended = null;
                                t.oninactive = null;

                                if (!preserve) {
                                    t.stop();
                                }
                            } catch {}
                        });
                    }
                } catch {}

                janusRef.current.localStream = null;
                try {
                    setLocalStream(null);
                } catch {}
            };

            // -------------------------
            // D) Janus/Remote 정리
            // -------------------------
            const cleanupJanus = () => {
                // remote feeds
                try {
                    Object.values(janusRef.current.remote || {}).forEach(
                        (info) => {
                            try {
                                info.handle?.hangup?.();
                                info.handle?.detach?.();
                            } catch {}
                        }
                    );
                } catch {}
                janusRef.current.remote = {};
                janusRef.current.remotePending = {};
                notifyRemoteParticipantsChanged();

                // pub handle / session
                try {
                    janusRef.current.pub?.hangup?.();
                } catch {}
                janusRef.current.pub = null;
                janusRef.current.privateId = null;

                // janus destroy는 leaveRoom에서 이미 시도됨. 여기서는 참조만 끊기.
                janusRef.current.janus = null;
            };

            // -------------------------
            // E) intent/state 초기화(진짜 종료에서만)
            // -------------------------
            const resetIntentIfNeeded = () => {
                if (preserve) return;

                mediaRef.current.wantAudio = DEFAULT_WANT_AUDIO;
                mediaRef.current.wantVideo = DEFAULT_WANT_VIDEO;

                mediaRef.current.videoLost = false;
                mediaRef.current.permissionDeniedVideo = false;
                mediaRef.current.permissionDeniedScreen = false;

                mediaRef.current.videoSource = "camera";
                mediaRef.current.cameraDeviceId = null;
                mediaRef.current.screenSoftMuted = false;
            };

            // -------------------------
            // F) core flags 정리
            // -------------------------
            sessionRef.current.joined = false;
            sessionRef.current.destroying = false;
            sessionRef.current.bootRetryCount = 0;

            negotiationRef.current.locked = false;
            negotiationRef.current.pending = null;

            publishedRef.current = false;
            lastConfiguredRef.current = { audio: null, video: null };

            connRef.current.isConnected = false;
            connRef.current.isConnecting = false;

            // -------------------------
            // 실행 순서 (중요)
            // -------------------------
            clearAllTimers();
            cleanupScreenStreamIfNeeded(); // preserve면 스킵
            cleanupLocalStream(); // preserve면 stop 금지
            cleanupJanus();
            resetIntentIfNeeded(); // preserve면 스킵

            // UI state
            safeSet(() => {
                setIsConnecting(false);
                setIsConnected(false);
                setError(null);

                // ✅ 연결 UI만 초기화 (preserve여도 연결은 끊겼으니 false로)
                // ✅ 단, preserve면 audio/video 토글 상태는 intent 유지되어 join 후 다시 정렬됨
                if (!preserve) {
                    setAudioEnabled(DEFAULT_WANT_AUDIO);
                    setVideoEnabled(DEFAULT_WANT_VIDEO);
                    setIsVideoDeviceLost(false);
                }
            });

            // 마지막 스냅샷 반영
            emitLocalMediaState();
            closingRef.current = false;

            // leaveRoom 대기 해제
            leaveWaitRef.current.resolve?.();
            resetLeaveWait();
        },
        [
            clearTimer,
            emitLocalMediaState,
            notifyRemoteParticipantsChanged,
            resetLeaveWait,
            safeSet,
            setLocalStream,
        ]
    );

    const finalizeRef = useRef(finalize);
    useEffect(() => {
        finalizeRef.current = finalize;
    }, [finalize]);

    // =========================================================
    // 12) leaveRoom (ref-safe)
    // =========================================================
    const leaveRoomRef = useRef(null);

    const leaveRoomImpl = useCallback(
        (reason = "leaveRoom") => {
            if (sessionRef.current.destroying)
                return leaveWaitRef.current.promise;

            sessionRef.current.destroying = true;
            closingRef.current = true;
            bumpGen();

            finalizedOnceRef.current = false; // leave 시작마다 초기화
            clearTimer("boot");

            const janus = janusRef.current.janus;
            const pub = janusRef.current.pub;

            try {
                pub?.send?.({ message: { request: "leave" } });
            } catch {}

            if (janus) {
                try {
                    janus.destroy();

                    // ✅ destroyed 콜백이 안 오는 환경 대비: 1회 fallback finalize
                    window.setTimeout(() => {
                        if (!sessionRef.current.destroying) return; // 이미 끝났으면 스킵
                        // finalize는 1회 보장 로직(finalizedOnceRef) 있으니 안전
                        finalizeRef.current?.(`${reason}.destroy-fallback`);
                    }, 1200);

                    return leaveWaitRef.current.promise;
                } catch {}
            }

            finalizeRef.current?.(`${reason}.noJanus`);
            return leaveWaitRef.current.promise;
        },
        [clearTimer, bumpGen]
    );

    useEffect(() => {
        leaveRoomRef.current = leaveRoomImpl;
    }, [leaveRoomImpl]);

    const leaveRoom = useCallback((reason) => {
        return leaveRoomRef.current?.(reason);
    }, []);

    // =========================================================
    // 13) Create session & publisher attach (+ boot timeout mark)
    // =========================================================
    const createSessionAndAttach = useCallback(
        ({ roomNumber, displayName }) => {
            const myGen = genRef.current;
            const Janus = window.Janus;
            if (!Janus) return;

            sessionRef.current.joined = false;
            publishedRef.current = false;

            const janus = new Janus({
                server: serverUrl,
                success: () => {
                    if (isStale(myGen)) {
                        try {
                            janus.destroy();
                        } catch {}
                        return;
                    }
                    if (!mountedRef.current) {
                        try {
                            janus.destroy();
                        } catch {}
                        return;
                    }

                    janusRef.current.janus = janus;

                    janus.attach({
                        plugin: "janus.plugin.videoroom",
                        success: (handle) => {
                            if (isStale(myGen)) {
                                try {
                                    handle?.detach?.();
                                } catch {}
                                return;
                            }
                            janusRef.current.pub = handle;

                            handle.send({
                                message: {
                                    request: "join",
                                    room: Number(roomNumber),
                                    ptype: "publisher",
                                    display: displayName || "User",
                                },
                            });
                        },
                        error: (err) => {
                            if (isStale(myGen)) return;
                            console.error("[publisher] attach error:", err);
                            safeSet(() => {
                                setError(
                                    "videoroom attach 중 에러가 발생했습니다."
                                );
                                setIsConnecting(false);
                            });
                            connRef.current.isConnecting = false;
                            clearTimer("boot");
                        },
                        onmessage: (msg, jsep) => {
                            if (isStale(myGen)) return;

                            const data = msg?.plugindata?.data || msg || {};
                            const event = data.videoroom;
                            const errorCode = data.error_code;

                            // room create
                            if (event === "event" && errorCode === 426) {
                                const createBody = {
                                    request: "create",
                                    room: Number(roomNumber),
                                    publishers: 10,
                                    bitrate: 512000,
                                };

                                janusRef.current.pub?.send({
                                    message: createBody,
                                    success: (result) => {
                                        const d =
                                            result?.plugindata?.data ||
                                            result ||
                                            {};
                                        if (d.videoroom === "created") {
                                            janusRef.current.pub?.send({
                                                message: {
                                                    request: "join",
                                                    room: d.room,
                                                    ptype: "publisher",
                                                    display:
                                                        displayName || "User",
                                                },
                                            });
                                        }
                                    },
                                    error: (err) => {
                                        console.error(
                                            "[publisher] room create error:",
                                            err
                                        );
                                        safeSet(() => {
                                            setError(
                                                "회의 방 생성 중 오류가 발생했습니다."
                                            );
                                            setIsConnecting(false);
                                        });
                                        connRef.current.isConnecting = false;
                                        clearTimer("boot");
                                    },
                                });
                                return;
                            }

                            if (event === "joined") {
                                sessionRef.current.myFeedId = data.id ?? null;
                                sessionRef.current.joined = true;
                                sessionRef.current.bootRetryCount = 0;

                                clearTimer("boot");

                                janusRef.current.privateId = data.private_id;

                                safeSet(() => {
                                    setIsConnected(true);
                                    setIsConnecting(false);
                                });

                                connRef.current.isConnected = true;
                                connRef.current.isConnecting = false;

                                // ✅ 입장 직후 publish: camera는 즉시, screen은 schedule로(중복 offer 방지)
                                const isScreen =
                                    mediaRef.current.videoSource === "screen";

                                if (!isScreen) {
                                    publishLocalStreamRef.current?.(
                                        mediaRef.current.wantAudio,
                                        mediaRef.current.wantVideo,
                                        { republish: true, reason: "joined" }
                                    );
                                } else {
                                    // screen은 quiet window로 통일해서 2중 publish 가능성 줄임
                                    scheduleApplyIntent("joined-screen");
                                }
                                // publishers attach
                                const list = data.publishers || [];
                                if (list.length > 0) {
                                    list.slice()
                                        .sort((a, b) => a.id - b.id)
                                        .forEach((p) =>
                                            newRemoteFeed(
                                                p.id,
                                                p.display,
                                                roomNumber
                                            )
                                        );
                                    notifyRemoteParticipantsChanged();
                                }

                                // resync 2회
                                const resync = () => {
                                    const h = janusRef.current.pub;
                                    if (!h) return;

                                    h.send({
                                        message: {
                                            request: "listparticipants",
                                            room: Number(roomNumber),
                                        },
                                        success: (result) => {
                                            const d =
                                                result?.plugindata?.data ||
                                                result ||
                                                {};
                                            const parts = d.participants || [];

                                            parts.forEach((p) => {
                                                if (!p?.id) return;
                                                if (
                                                    janusRef.current.remote[
                                                        p.id
                                                    ]
                                                )
                                                    return;
                                                newRemoteFeed(
                                                    p.id,
                                                    p.display,
                                                    roomNumber
                                                );
                                            });

                                            notifyRemoteParticipantsChanged();
                                        },
                                        error: () => {},
                                    });
                                };

                                resync();
                                window.setTimeout(resync, 1000);
                            }

                            if (event === "event") {
                                let changed = false;

                                const list = data.publishers || [];
                                if (list.length > 0) {
                                    list.forEach((p) =>
                                        newRemoteFeed(
                                            p.id,
                                            p.display,
                                            roomNumber
                                        )
                                    );
                                    changed = true;
                                }

                                const leaving = data.leaving;
                                if (leaving) {
                                    detachRemoteFeed(leaving);
                                    changed = true;
                                }

                                const unpublished = data.unpublished;
                                if (unpublished && unpublished !== "ok") {
                                    detachRemoteFeed(unpublished);
                                    changed = true;
                                }

                                if (changed) notifyRemoteParticipantsChanged();

                                if (data.error === "Room not found") {
                                    safeSet(() =>
                                        setError("회의 방이 종료되었습니다.")
                                    );
                                    try {
                                        janusRef.current.janus?.destroy();
                                    } catch {}
                                    return;
                                }
                            }

                            if (jsep && janusRef.current.pub) {
                                janusRef.current.pub.handleRemoteJsep({ jsep });
                            }
                        },
                        onlocalstream: (stream) => {
                            setLocalStream(stream);
                        },
                        oncleanup: () => {},
                    });
                },
                error: (err) => {
                    console.error("[useJanusLocalOnly] Janus error:", err);
                    safeSet(() => {
                        setError("Janus 세션 생성 중 에러가 발생했습니다.");
                        setIsConnecting(false);
                    });
                    connRef.current.isConnecting = false;
                    clearTimer("boot");
                },
                destroyed: () => {
                    finalizeRef.current?.("janus.destroyed");
                },
            });
        },
        [
            serverUrl,
            detachRemoteFeed,
            newRemoteFeed,
            notifyRemoteParticipantsChanged,
            safeSet,
            setLocalStream,
            clearTimer,
            isStale,
        ]
    );

    // =========================================================
    // 14) joinRoom (+ boot timeout / 1회 재시도)
    // =========================================================
    const joinRoomRef = useRef(null);

    const joinRoomImpl = useCallback(
        async ({ roomNumber, displayName }) => {
            const Janus = window.Janus;

            if (!Janus) {
                safeSet(() =>
                    setError("Janus 라이브러리가 아직 로드되지 않았습니다.")
                );
                return;
            }

            if (!Janus.isWebrtcSupported()) {
                safeSet(() => {
                    setIsSupported(false);
                    setError("이 브라우저는 WebRTC를 지원하지 않습니다.");
                });
                return;
            }

            if (sessionRef.current.destroying || closingRef.current) {
                await (leaveWaitRef.current.promise || Promise.resolve());
            }
            if (connRef.current.isConnecting || connRef.current.isConnected)
                return;

            finalizedOnceRef.current = false;

            sessionRef.current.destroying = false;
            sessionRef.current.joined = false;
            sessionRef.current.lastJoin = { roomNumber, displayName };
            sessionRef.current.bootRetryCount = 0;

            resetRemoteFeeds();

            safeSet(() => {
                setError(null);
                setIsConnecting(true);
            });
            connRef.current.isConnecting = true;

            await refreshDeviceAvailability().catch(() => null);

            // camera 모드에서만 "카메라 없음" 처리
            if (
                mediaRef.current.videoSource !== "screen" &&
                (mediaRef.current.noDevices || !mediaRef.current.hasVideoDevice)
            ) {
                mediaRef.current.videoLost = false;
                safeSet(() => setIsVideoDeviceLost(false));
            }
            emitLocalMediaState();

            const run = () => {
                createSessionAndAttach({ roomNumber, displayName });

                clearTimer("boot");
                timersRef.current.boot = window.setTimeout(() => {
                    timersRef.current.boot = null;

                    if (!mountedRef.current) return;
                    if (sessionRef.current.destroying) return;
                    if (sessionRef.current.joined) return;

                    if (sessionRef.current.bootRetryCount >= 1) {
                        safeSet(() => {
                            setIsConnecting(false);
                            setError(
                                "회의 연결이 지연되고 있습니다. 재접속을 시도해 주세요."
                            );
                        });
                        connRef.current.isConnecting = false;
                        return;
                    }

                    sessionRef.current.bootRetryCount += 1;

                    leaveRoomRef.current?.("boot-timeout");
                    window.setTimeout(() => {
                        const last = sessionRef.current.lastJoin;
                        if (last) joinRoomRef.current?.(last);
                    }, 600);
                }, 3500);
            };

            if (!sessionRef.current.inited) {
                Janus.init({
                    debug: "all",
                    callback: () => {
                        sessionRef.current.inited = true;
                        run();
                    },
                });
            } else {
                run();
            }
        },
        [
            createSessionAndAttach,
            emitLocalMediaState,
            refreshDeviceAvailability,
            resetRemoteFeeds,
            safeSet,
            clearTimer,
        ]
    );

    useEffect(() => {
        joinRoomRef.current = joinRoomImpl;
    }, [joinRoomImpl]);

    const joinRoom = useCallback((params) => {
        joinRoomRef.current?.(params);
    }, []);

    // =========================================================
    // 15) recreateSession / hardReconnect
    // =========================================================
    const recreateSession = useCallback(
        async (reason = "recreate") => {
            screenPickerLockRef.current = false;
            const last = sessionRef.current.lastJoin;
            if (!last) return;

            safeSet(() => setIsConnecting(true));
            connRef.current.isConnecting = true;

            preserveScreenOnFinalizeRef.current = true;
            try {
                await leaveRoomRef.current?.(`${reason}.preserveScreen`);
            } finally {
                preserveScreenOnFinalizeRef.current = false;
            }

            joinRoomRef.current?.(last);
        },
        [safeSet]
    );

    useEffect(() => {
        recreateSessionRef.current = recreateSession;
    }, [recreateSession]);

    const hardReconnect = useCallback(async (reason = "hardReconnect") => {
        const last = sessionRef.current.lastJoin;
        if (!last) return;

        if (sessionRef.current.destroying || closingRef.current) {
            await (leaveWaitRef.current.promise || Promise.resolve());
        }

        try {
            await leaveRoomRef.current?.(reason);
        } catch {}
        joinRoomRef.current?.(last);
    }, []);

    useEffect(() => {
        hardReconnectRef.current = hardReconnect;
    }, [hardReconnect]);

    // =========================================================
    // 16) toggleAudio / toggleVideo (연타 중 완전 무시)
    // =========================================================
    const stopScreenCapture = useCallback((why = "stopScreenCapture") => {
        // ✅ 중요: 재선택/토글 후 피커가 다시 떠야 하므로 무조건 락 해제
        screenPickerLockRef.current = false;

        try {
            const ss = mediaRef.current.screenStream;
            ss?.getTracks?.().forEach((t) => {
                try {
                    t.stop();
                } catch {}
            });
        } catch {}

        mediaRef.current.screenStream = null;
        mediaRef.current.screenSoftMuted = false;
        mediaRef.current.permissionDeniedScreen = false;
    }, []);

    const toggleAudio = useCallback(() => {
        if (isQuietWindowActive()) return;

        const next = !mediaRef.current.wantAudio;
        mediaRef.current.wantAudio = next;

        safeSet(() => setAudioEnabled(next));
        emitLocalMediaState();

        if (!connRef.current.isConnected || !janusRef.current.pub) return;
        scheduleApplyIntent("toggleAudio");
    }, [
        emitLocalMediaState,
        safeSet,
        scheduleApplyIntent,
        isQuietWindowActive,
    ]);

    const toggleVideo = useCallback(() => {
        if (isQuietWindowActive()) return;
        // ✅ camera로 전환/토글이면 기존 screen 캡처는 종료 (정책: 동시에 2개 ON 불가)
        stopScreenCapture("toggleVideo->camera");
        // toggleVideo는 camera 전용
        const next = !mediaRef.current.wantVideo;
        mediaRef.current.videoSource = "camera";
        mediaRef.current.screenSoftMuted = false;
        mediaRef.current.wantVideo = next;

        if (!mediaRef.current.permissionDeniedVideo) {
            mediaRef.current.videoLost = false;
        }

        safeSet(() => {
            setVideoEnabled(next);
            if (!mediaRef.current.permissionDeniedVideo)
                setIsVideoDeviceLost(false);
        });

        emitLocalMediaState();

        if (!connRef.current.isConnected || !janusRef.current.pub) return;
        scheduleApplyIntent("toggleVideo");
    }, [
        emitLocalMediaState,
        safeSet,
        scheduleApplyIntent,
        isQuietWindowActive,
    ]);

    const toggleScreenShare = useCallback(() => {
        if (isQuietWindowActive()) return;
        if (connRef.current.isConnecting) return;

        const m = mediaRef.current;
        const isScreenMode = m.videoSource === "screen";
        const isSoftOff =
            isScreenMode && m.wantVideo === true && m.screenSoftMuted === true;
        const isOn =
            isScreenMode && m.wantVideo === true && m.screenSoftMuted !== true;

        // A) ON -> SOFT-OFF (송출만 끔)
        if (isOn) {
            m.screenSoftMuted = true;
            m.wantVideo = true;
            emitLocalMediaState();

            if (connRef.current.isConnected && janusRef.current.pub) {
                scheduleApplyIntent("screen-soft-off");
            }
            return;
        }

        // B) SOFT-OFF -> ON (송출 재개, picker는 안 뜸. 기존 stream 재사용)
        if (isSoftOff) {
            m.screenSoftMuted = false;
            m.wantVideo = true;
            emitLocalMediaState();

            if (connRef.current.isConnected && janusRef.current.pub) {
                scheduleApplyIntent("screen-soft-on");
            } else if (sessionRef.current.lastJoin) {
                recreateSessionRef.current?.("screen-soft-on.recreate");
            }
            return;
        }

        // C) OFF -> ON (처음 시작: picker가 떠야 함)
        m.videoSource = "screen";
        m.screenSoftMuted = false;
        m.wantVideo = true;
        m.permissionDeniedScreen = false;

        emitLocalMediaState();

        // ✅ 여기선 recreateSession을 굳이 먼저 할 필요 없음.
        // effect가 getDisplayMedia로 stream 얻고, scheduleApplyIntent("screen-picked")가 publish를 트리거함.
    }, [emitLocalMediaState, isQuietWindowActive, scheduleApplyIntent]);

    const screenPickerLockRef = useRef(false);

    useEffect(() => {
        const m = mediaRef.current;

        if (!isConnected) return;
        if (m.videoSource !== "screen") return;
        if (m.screenSoftMuted) return;
        if (m.screenStream) return;

        // ✅ picker는 세션당 1회만
        if (screenPickerLockRef.current) return;
        screenPickerLockRef.current = true;

        (async () => {
            try {
                const md = navigator.mediaDevices;
                if (!md?.getDisplayMedia) {
                    safeSet(() =>
                        setError("이 브라우저는 화면 공유를 지원하지 않습니다.")
                    );
                    screenPickerLockRef.current = false;
                    return;
                }

                const stream = await md.getDisplayMedia({
                    video: true,
                    audio: false,
                });

                m.screenStream = stream;

                stream.getVideoTracks()?.forEach((track) => {
                    track.onended = () => {
                        m.screenEndingAt = Date.now();
                        m.videoSource = "camera";
                        m.screenSoftMuted = false;

                        try {
                            m.screenStream
                                ?.getTracks()
                                ?.forEach((t) => t.stop());
                        } catch {}
                        m.screenStream = null;

                        screenPickerLockRef.current = false;

                        emitLocalMediaState();
                        signalLocalMedia(
                            {
                                audio: !!m.wantAudio,
                                video: !!m.wantVideo,
                                videoDeviceLost: false,
                                videoSource: "camera",
                                screenSoftMuted: false,
                                screenCapturing: false,
                            },
                            { immediate: true, reason: "screen-ended" }
                        );
                        recreateSessionRef.current?.("screen-ended");
                    };
                });

                emitLocalMediaState();
                signalLocalMedia(
                    {
                        audio: !!m.wantAudio,
                        video: true,
                        videoDeviceLost: false,
                        videoSource: "screen",
                        screenSoftMuted: false,
                        screenCapturing: true,
                    },
                    { immediate: true, reason: "screen-picked" }
                );

                scheduleApplyIntent("screen-picked");
            } catch (err) {
                screenPickerLockRef.current = false;
                m.permissionDeniedScreen = true;

                m.videoSource = "camera";
                m.screenSoftMuted = false;

                emitLocalMediaState();
                safeSet(() =>
                    setError("화면 공유 권한이 거부되었거나 취소되었습니다.")
                );
            }
        })();
    }, [
        isConnected,
        localMedia.videoSource,
        localMedia.screenSoftMuted,
        emitLocalMediaState,
        scheduleApplyIntent,
        safeSet,
    ]);

    // =========================================================
    // 17) devicechange (screen 모드 제외, force hardReconnect)
    // =========================================================
    useEffect(() => {
        const md = navigator.mediaDevices;
        if (!md?.addEventListener || !md?.enumerateDevices) return;

        const onDeviceChange = () => {
            clearTimer("deviceDebounce");

            timersRef.current.deviceDebounce = window.setTimeout(async () => {
                timersRef.current.deviceDebounce = null;

                if (!connRef.current.isConnected) return;

                const now = Date.now();
                if (now - (timersRef.current.deviceCooldown || 0) < 1200)
                    return;
                timersRef.current.deviceCooldown = now;

                const snap = await refreshDeviceAvailability().catch(
                    () => null
                );
                if (!snap) return;

                // screen 모드에서는 devicechange로 죽었다고 판단하지 않음
                if (mediaRef.current.videoSource === "screen") {
                    emitLocalMediaState();
                    return;
                }

                if (snap.noMediaDevices || !snap.hasVideo) {
                    mediaRef.current.videoLost = false;
                    safeSet(() => setIsVideoDeviceLost(false));
                    emitLocalMediaState();
                    return;
                }

                // camera deny면 하드리커넥트 금지
                if (mediaRef.current.permissionDeniedVideo) return;

                hardReconnectRef.current?.("devicechange");
            }, 250);
        };

        md.addEventListener("devicechange", onDeviceChange);
        return () => {
            md.removeEventListener("devicechange", onDeviceChange);
            clearTimer("deviceDebounce");
        };
    }, [clearTimer, emitLocalMediaState, refreshDeviceAvailability, safeSet]);

    // =========================================================
    // 18) Unmount cleanup
    // =========================================================
    useEffect(() => {
        return () => {
            leaveRoomRef.current?.("unmount");
        };
    }, []);

    // =========================================================
    // 19) retry permission helpers
    // =========================================================
    const retryVideoPermission = useCallback(() => {
        mediaRef.current.permissionDeniedVideo = false;
        mediaRef.current.videoLost = false;

        safeSet(() => {
            setIsVideoDeviceLost(false);
            setError(null);
            setIsConnecting(true);
        });

        emitLocalMediaState();
        reinjectIfPossible();
    }, [emitLocalMediaState, reinjectIfPossible, safeSet]);

    const retryScreenPermission = useCallback(() => {
        mediaRef.current.permissionDeniedScreen = false;

        safeSet(() => setError(null));
        emitLocalMediaState();

        // 다음 join에서 screen을 시도하도록 의도 저장
        mediaRef.current.videoSource = "screen";
        mediaRef.current.cameraDeviceId = null;
        mediaRef.current.wantVideo = true;

        safeSet(() => setVideoEnabled(true));
        emitLocalMediaState();

        if (sessionRef.current.lastJoin) {
            recreateSessionRef.current?.("retryScreenPermission");
        }
    }, [emitLocalMediaState, safeSet]);

    // =========================================================
    // 20) setVideoSource (Picker 강제 + 전환은 세션 재생성)
    // =========================================================
    const setVideoSource = useCallback(
        async (nextType, deviceId = null) => {
            const t = nextType === "screen" ? "screen" : "camera";

            // ✅ 정책: camera로 전환이면 screen 캡처는 항상 종료
            if (t === "camera") {
                stopScreenCapture("setVideoSource->camera");
                mediaRef.current.screenSoftMuted = false;

                // ✅ 권한 deny가 아니면: 선택 즉시 카메라 ON + videoLost 초기화
                if (!mediaRef.current.permissionDeniedVideo) {
                    mediaRef.current.wantVideo = true;
                    mediaRef.current.videoLost = false;
                }
                // deny면 wantVideo는 건드리지 않음(사용자에게 "켜짐"처럼 보이지 않게)
            }

            mediaRef.current.videoSource = t;
            mediaRef.current.cameraDeviceId = t === "camera" ? deviceId : null;

            emitLocalMediaState();

            if (!sessionRef.current.lastJoin) return;
            recreateSessionRef.current?.(`videoSource:${t}`);
        },
        [emitLocalMediaState, stopScreenCapture]
    );

    // =========================================================
    // 21) stopVideo (video 완전 OFF + 세션 재생성)
    // =========================================================
    const stopVideo = useCallback(
        (reason = "stopVideo") => {
            try {
                const ss = mediaRef.current.screenStream;
                ss?.getTracks?.().forEach((t) => {
                    try {
                        t.stop();
                    } catch {}
                });
            } catch {}
            mediaRef.current.screenStream = null;
            mediaRef.current.permissionDeniedScreen = false;

            mediaRef.current.videoSource = "camera";
            mediaRef.current.cameraDeviceId = null;

            mediaRef.current.wantVideo = false;
            mediaRef.current.videoLost = false;

            safeSet(() => {
                setVideoEnabled(false);
                setIsVideoDeviceLost(false);
            });

            emitLocalMediaState();
            signalLocalMedia(
                {
                    audio: !!mediaRef.current.wantAudio,
                    video: false,
                    videoDeviceLost: false,
                    videoSource: "camera",
                    screenSoftMuted: false,
                    screenCapturing: false,
                },
                { immediate: true, reason: "stopVideo" }
            );

            if (!sessionRef.current.lastJoin) return;
            recreateSessionRef.current?.(reason);
        },
        [emitLocalMediaState, safeSet]
    );
    // ✅ 화면공유 "재선택": 기존 캡처 완전 종료 → 새 picker 강제
    const restartScreenShare = useCallback(() => {
        if (isQuietWindowActive()) return;

        // 1) 기존 캡처 완전 종료 (picker 다시 띄우려면 반드시 필요)
        stopScreenCapture("restartScreenShare");

        // 2) screen 모드로 의도 고정
        mediaRef.current.videoSource = "screen";
        mediaRef.current.screenSoftMuted = false;
        mediaRef.current.wantVideo = true;
        mediaRef.current.permissionDeniedScreen = false;

        emitLocalMediaState();

        // 3) 전환 정책: 세션 재생성
        if (sessionRef.current.lastJoin) {
            recreateSessionRef.current?.("screen-restart");
        }
    }, [emitLocalMediaState, isQuietWindowActive, stopScreenCapture]);

    // =========================================================
    // 22) Exports
    // =========================================================
    return {
        isSupported,
        isConnecting,
        isConnected,
        error,

        // legacy
        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        noMediaDevices,

        // ✅ UI 단일 진실
        localMedia,

        // toggles
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        restartScreenShare,
        // session
        joinRoom,
        leaveRoom,

        // helpers
        reinjectIfPossible,
        hardReconnect,
        recreateSession,

        // permission retry
        retryVideoPermission,
        retryScreenPermission,

        // source controls
        getVideoInputs,
        setVideoSource,

        // hard stop video
        stopVideo,
    };
}
