// src/hooks/useJanusLocalOnly.js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useJanusLocalOnly (final - A안 변형: ✅ screen도 "세션 재생성 없이" camera처럼 처리)
 *
 * 정책(최종 - B안)
 * 1) onended(트랙 종료) ≠ 세션 죽음
 *    - screen track onended: 정상 종료 → camera 복귀 + republish (세션 재생성 X)
 *    - camera track onended: 세션 죽음 단정 X → reinject 1회(가벼운 복구)
 *
 * 2) 카메라 변경/화면공유 시작/종료/재선택 모두 publish/replace 기반(세션 유지)
 *    - setVideoSource("camera", deviceId) : 기존 세션에서 republish
 *    - setVideoSource("screen") : getDisplayMedia picker → 기존 세션에서 republish
 *
 * 3) 진짜 세션 죽음(458/pcDead 등)만 hardReconnect
 *
 * Deny UX
 * - camera deny: permissionDeniedVideo 플래그 + 안내 메시지
 * - screen deny: permissionDeniedScreen 플래그 + 안내 메시지
 *
 * ✅ UI 단일 진실: localMedia
 * ✅ screen 전환/재선택 시 publish가 "무조건" 다시 타도록 screenPickNonce 유지
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
        screenPickNonce: null,
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

    // ✅ screen picker trigger (UI state 의존성 제거용)
    const [screenPickerTick, setScreenPickerTick] = useState(0);

    // =========================================================
    // 2) Refs (핵심)
    // =========================================================
    const lastVideoMetaRef = useRef({
        videoSource: null, // "camera" | "screen"
        cameraDeviceId: null, // string | null
        screenPickNonce: null, // ✅ PATCH: meta에 nonce 유지
    });

    const genRef = useRef(0);
    const closingRef = useRef(false);

    // ✅ screen picker 락(중복 picker 방지)
    const screenPickerLockRef = useRef(false);

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

        // ✅ 핵심: screen pick이 바뀌었는지 판단(전환/재선택 강제 publish 트리거)
        screenPickNonce: 0,
        screenTrackId: null,

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
    const recreateSessionRef = useRef(null); // (남겨두지만 screen에서 안씀)

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
        screenPickNonce: null, // ✅ 추가
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
        const {
            immediate = false,
            reason = "localMedia",
            force = false, // ✅ 같아도 강제 전송
            phase, // ✅ "intent" | "commit"
        } = opts;

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
            prev.screenPickNonce !== next.screenPickNonce ||
            prev.screenCapturing !== next.screenCapturing;

        if (!changed && !force) return;

        // ✅ PATCH: screenPickNonce 저장 누락 버그 수정
        lastSignaledRef.current = {
            audio: next.audio,
            video: next.video,
            videoDeviceLost: next.videoDeviceLost,
            videoSource: next.videoSource,
            screenSoftMuted: next.screenSoftMuted,
            screenCapturing: next.screenCapturing,
            screenPickNonce: Number(next.screenPickNonce || 0),
        };

        const extra = {
            videoDeviceLost: !!next.videoDeviceLost,
            videoSource: next.videoSource || "camera",
            screenSoftMuted: !!next.screenSoftMuted,
            screenCapturing: !!next.screenCapturing,
            screenPickNonce: Number(next.screenPickNonce || 0),
            reason,
            phase: phase || (immediate ? "commit" : "intent"),
        };

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

            screenSoftMuted: !!mediaRef.current.screenSoftMuted,
            screenCapturing: !!screenCapturing,

            permissionDeniedVideo: !!mediaRef.current.permissionDeniedVideo,
            permissionDeniedScreen: !!mediaRef.current.permissionDeniedScreen,

            // ✅ (signalLocalMedia 비교/전송에 사용)
            screenPickNonce: Number(mediaRef.current.screenPickNonce || 0),
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
    }, [hasLiveTrack, safeSet, signalLocalMedia]);

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

            if (!isScreen && !!mediaRef.current.permissionDeniedVideo)
                return false;
            if (isScreen && !!mediaRef.current.permissionDeniedScreen)
                return false;

            return true;
        };

        const snapshotIntent = () => {
            const a = !!mediaRef.current.wantAudio;
            const v = !!mediaRef.current.wantVideo;
            const vs = mediaRef.current.videoSource || "camera";
            const ssm = !!mediaRef.current.screenSoftMuted;
            const spn = Number(mediaRef.current.screenPickNonce || 0);

            return { a, v, vs, ssm, spn };
        };

        const isSameAsLast = ({ a, v, vs, ssm, spn }) => {
            const last = lastAppliedIntentRef.current;
            return (
                last.audio === a &&
                last.video === v &&
                last.videoSource === vs &&
                last.screenSoftMuted === ssm &&
                last.screenPickNonce === spn
            );
        };

        const markApplied = ({ a, v, vs, ssm, spn }) => {
            lastAppliedIntentRef.current = {
                audio: a,
                video: v,
                videoSource: vs,
                screenSoftMuted: ssm,
                screenPickNonce: spn,
            };
        };

        const applyOnce = (tag) => {
            if (seq !== applySeqRef.current) return;
            if (!canApply()) return;

            const cur = snapshotIntent();
            if (isSameAsLast(cur)) return;

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

        applyTimerRef.current = window.setTimeout(() => {
            applyTimerRef.current = null;
            applyOnce("apply");

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

            stream.getVideoTracks?.().forEach((track) => {
                const onDead = () => {
                    const recentlyScreenEnded =
                        Date.now() - (mediaRef.current.screenEndingAt || 0) <
                        1500;
                    if (recentlyScreenEnded) return;

                    // ✅ screen 모드의 onended는 picker 트랙에서 처리(아래 getDisplayMedia onended)
                    if (mediaRef.current.videoSource === "screen") return;

                    if (deadRetryTimerRef.current)
                        window.clearTimeout(deadRetryTimerRef.current);

                    deadRetryTimerRef.current = window.setTimeout(() => {
                        deadRetryTimerRef.current = null;

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
                onremotetrack: (track, mid, on) => {
                    const info = janusRef.current.remote[feedId];
                    if (!info) return;

                    // feed별로 stream을 따로 들고 가면서 track add/remove
                    if (!info.stream) info.stream = new MediaStream();

                    if (on) {
                        const exists = info.stream
                            .getTracks()
                            .some((t) => t.id === track.id);
                        if (!exists) info.stream.addTrack(track);
                    } else {
                        info.stream.getTracks().forEach((t) => {
                            if (t.id === track.id) info.stream.removeTrack(t);
                        });
                    }

                    notifyRemoteParticipantsChanged(); // UI에 새 track 반영
                },
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
            if (sessionRef.current.destroying || closingRef.current) {
                return;
            }
            const Janus = window.Janus;
            const handle = janusRef.current.pub;
            if (!Janus || !handle) return;

            const commitNow = (commitReason = "publish-commit") => {
                const s = janusRef.current.localStream;

                const liveAudio = hasLiveTrack(s, "audio");
                const liveVideo = hasLiveTrack(s, "video");

                const wantAudio2 = !!mediaRef.current.wantAudio;
                const wantVideo2 = !!mediaRef.current.wantVideo;

                const screenStream = mediaRef.current.screenStream;
                const screenCapturing = hasLiveTrack(screenStream, "video");

                const videoDeviceLost2 =
                    !!mediaRef.current.videoLost ||
                    (!!wantVideo2 &&
                        !liveVideo &&
                        !!mediaRef.current.hasVideoDevice &&
                        !mediaRef.current.noDevices);

                signalLocalMedia(
                    {
                        audio: wantAudio2,
                        video: wantVideo2,
                        videoDeviceLost: !!videoDeviceLost2,
                        videoSource: mediaRef.current.videoSource || "camera",
                        screenSoftMuted: !!mediaRef.current.screenSoftMuted,
                        screenCapturing: !!screenCapturing,
                        screenPickNonce: Number(
                            mediaRef.current.screenPickNonce || 0
                        ),
                    },
                    {
                        immediate: true,
                        force: true,
                        reason: commitReason,
                        phase: "commit",
                    }
                );
            };

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

            const cameraDenied =
                !!mediaRef.current.permissionDeniedVideo && !isScreen;
            const intentVideoSafe = cameraDenied ? false : !!intentVideo;

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

            const wantVideo =
                !!intentVideoSafe &&
                (isScreen ? (screenSoftMuted ? false : true) : !noDev && hasV);

            if (!wantVideo) {
                mediaRef.current.videoLost = false;
                safeSet(() => setIsVideoDeviceLost(false));
            }

            emitLocalMediaState();

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
                    commitNow("configure-only.commit");
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
            const currentScreenNonce = Number(
                mediaRef.current.screenPickNonce || 0
            );

            const prevMeta = lastVideoMetaRef.current;

            // ✅ PATCH: screenPickNonce 변화도 sourceChanged로 취급 → replaceVideo 강제
            const sourceChanged =
                prevMeta.videoSource !== currentVideoSource ||
                prevMeta.cameraDeviceId !== currentCameraId ||
                (currentVideoSource === "screen" &&
                    prevMeta.screenPickNonce !== currentScreenNonce);

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
                    mediaCfg.video = true;
                } else if (cameraDeviceId) {
                    mediaCfg.video = { deviceId: { exact: cameraDeviceId } };
                } else {
                    mediaCfg.video = true;
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
                            screenPickNonce: currentScreenNonce, // ✅ 유지
                        };

                        const needResub =
                            (!!wantVideo && !prevCfg.video) ||
                            (!!wantVideo && sourceChanged);

                        if (needResub) {
                            const roomNumber =
                                sessionRef.current.lastJoin?.roomNumber;
                            if (roomNumber) {
                                const r =
                                    !prevCfg.video && !!wantVideo
                                        ? "video-on"
                                        : "video-source-changed";
                                window.setTimeout(() => {
                                    if (closingRef.current) return;
                                    if (!connRef.current.isConnected) return;
                                    forceResubscribeAllRef.current?.(
                                        roomNumber,
                                        r
                                    );
                                }, 150);
                            }
                        }

                        offerErrorCountRef.current = 0;

                        if (wantVideo) {
                            mediaRef.current.videoLost = false;

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
                        if (latest) setLocalStream(latest);

                        safeSet(() => setIsConnecting(false));
                        emitLocalMediaState();

                        commitNow("publish-ok.commit");
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
                            {
                                republish: true,
                            }
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

            if (isScreen && !screenSoftMuted && mediaRef.current.screenStream) {
                offerArgs.stream = mediaRef.current.screenStream;
            }

            // ✅ screen 트랙 sender 중복 방지(+안정화)
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
                    // 1) 같은 track 이미 sender에 있으면 configure만 하고 빠져나감
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
                                screenPickNonce: currentScreenNonce, // ✅ PATCH
                            };
                        } catch {}

                        safeSet(() => setIsConnecting(false));
                        emitLocalMediaState();

                        commitNow("already-sender.commit");

                        unlockNegotiation();
                        return;
                    }

                    // ✅ PATCH: replaceTrack(null)로 sender를 흔드는 약한 정리 제거
                    // (레이스/꼬임 유발 가능. nonce 기반 replaceVideo 강제로 충분)
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
            signalLocalMedia,
            hasLiveTrack,
        ]
    );

    useEffect(() => {
        publishLocalStreamRef.current = publishLocalStream;
    }, [publishLocalStream]);

    // =========================================================
    // 11) finalize / cleanup
    // =========================================================
    const finalizedOnceRef = useRef(false);

    const finalize = useCallback(
        (reason = "finalize") => {
            const preserve = preserveScreenOnFinalizeRef.current === true;
            screenPickerLockRef.current = false;

            if (finalizedOnceRef.current) return;
            finalizedOnceRef.current = true;

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
                    screenPickNonce: null,
                };

                if (deadRetryTimerRef.current) {
                    window.clearTimeout(deadRetryTimerRef.current);
                    deadRetryTimerRef.current = null;
                }
            };

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
                mediaRef.current.permissionDeniedScreen = false;

                mediaRef.current.screenTrackId = null;
                mediaRef.current.screenPickNonce =
                    (mediaRef.current.screenPickNonce || 0) + 1;
            };

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

            const cleanupJanus = () => {
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

                try {
                    janusRef.current.pub?.hangup?.();
                } catch {}
                janusRef.current.pub = null;
                janusRef.current.privateId = null;

                janusRef.current.janus = null;
            };

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

                mediaRef.current.screenTrackId = null;
                mediaRef.current.screenPickNonce =
                    (mediaRef.current.screenPickNonce || 0) + 1;

                lastVideoMetaRef.current = {
                    videoSource: null,
                    cameraDeviceId: null,
                    screenPickNonce: null,
                };
                offerErrorCountRef.current = 0;
            };

            sessionRef.current.joined = false;
            sessionRef.current.destroying = false;
            sessionRef.current.bootRetryCount = 0;

            negotiationRef.current.locked = false;
            negotiationRef.current.pending = null;

            publishedRef.current = false;
            lastConfiguredRef.current = { audio: null, video: null };

            connRef.current.isConnected = false;
            connRef.current.isConnecting = false;

            clearAllTimers();
            cleanupScreenStreamIfNeeded();
            cleanupLocalStream();
            cleanupJanus();
            resetIntentIfNeeded();

            safeSet(() => {
                setIsConnecting(false);
                setIsConnected(false);
                setError(null);

                if (!preserve) {
                    setAudioEnabled(DEFAULT_WANT_AUDIO);
                    setVideoEnabled(DEFAULT_WANT_VIDEO);
                    setIsVideoDeviceLost(false);
                }
            });

            emitLocalMediaState();
            closingRef.current = false;

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
    // 12) leaveRoom (ref-safe) + ✅ session op queue (직렬화)
    // =========================================================
    const sessionOpQueueRef = useRef(Promise.resolve());

    const runSessionOp = useCallback((tag, fn) => {
        const run = async () => {
            try {
                return await fn();
            } catch (e) {
                console.warn("[sessionOp] failed:", tag, e);
            }
        };
        const next = sessionOpQueueRef.current.then(run, run);
        sessionOpQueueRef.current = next.finally(() => {});
        return next;
    }, []);

    const leaveRoomRef = useRef(null);

    const leaveRoomImpl = useCallback(
        (reason = "leaveRoom") => {
            return runSessionOp(`leave:${reason}`, () => {
                if (sessionRef.current.destroying)
                    return leaveWaitRef.current.promise;

                sessionRef.current.destroying = true;
                closingRef.current = true;
                bumpGen();

                finalizedOnceRef.current = false;
                clearTimer("boot");

                const janus = janusRef.current.janus;
                const pub = janusRef.current.pub;

                try {
                    pub?.send?.({ message: { request: "leave" } });
                } catch {}

                if (janus) {
                    try {
                        janus.destroy();

                        window.setTimeout(() => {
                            if (!sessionRef.current.destroying) return;
                            finalizeRef.current?.(`${reason}.destroy-fallback`);
                        }, 1200);

                        return leaveWaitRef.current.promise;
                    } catch {}
                }

                finalizeRef.current?.(`${reason}.noJanus`);
                return leaveWaitRef.current.promise;
            });
        },
        [clearTimer, bumpGen, runSessionOp]
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

                                // ✅ screen도 세션 유지: screenStream 있으면 publish, 없으면 picker 후 publish
                                const isScreen =
                                    mediaRef.current.videoSource === "screen";
                                if (!isScreen) {
                                    publishLocalStreamRef.current?.(
                                        mediaRef.current.wantAudio,
                                        mediaRef.current.wantVideo,
                                        { republish: true, reason: "joined" }
                                    );
                                } else {
                                    // screenStream 없으면 publishLocalStream이 early return하므로
                                    // picker가 돌아오면 scheduleApplyIntent로 publish됨
                                    scheduleApplyIntent("joined-screen");
                                }

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
            scheduleApplyIntent,
        ]
    );

    // =========================================================
    // 14) joinRoom (+ boot timeout / 1회 재시도) ✅ 직렬화
    // =========================================================
    const joinRoomRef = useRef(null);

    const joinRoomImpl = useCallback(
        async ({ roomNumber, displayName }) => {
            return runSessionOp(`join:${roomNumber}`, async () => {
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

                if (
                    mediaRef.current.videoSource !== "screen" &&
                    (mediaRef.current.noDevices ||
                        !mediaRef.current.hasVideoDevice)
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
            });
        },
        [
            createSessionAndAttach,
            emitLocalMediaState,
            refreshDeviceAvailability,
            resetRemoteFeeds,
            safeSet,
            clearTimer,
            runSessionOp,
        ]
    );

    useEffect(() => {
        joinRoomRef.current = joinRoomImpl;
    }, [joinRoomImpl]);

    const joinRoom = useCallback((params) => {
        return joinRoomRef.current?.(params);
    }, []);

    // =========================================================
    // 15) recreateSession / hardReconnect ✅ 직렬화
    //    - recreateSession은 남겨두되, screen에서는 호출 안함(카메라/디바이스용)
    // =========================================================
    const recreateSession = useCallback(
        async (reason = "recreate") => {
            return runSessionOp(`recreate:${reason}`, async () => {
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

                await joinRoomRef.current?.(last);
            });
        },
        [safeSet, runSessionOp]
    );

    useEffect(() => {
        recreateSessionRef.current = recreateSession;
    }, [recreateSession]);

    const hardReconnect = useCallback(
        async (reason = "hardReconnect") => {
            return runSessionOp(`hardReconnect:${reason}`, async () => {
                const last = sessionRef.current.lastJoin;
                if (!last) return;

                if (sessionRef.current.destroying || closingRef.current) {
                    await (leaveWaitRef.current.promise || Promise.resolve());
                }

                try {
                    await leaveRoomRef.current?.(reason);
                } catch {}
                await joinRoomRef.current?.(last);
            });
        },
        [runSessionOp]
    );

    useEffect(() => {
        hardReconnectRef.current = hardReconnect;
    }, [hardReconnect]);

    const beforeScreenRef = useRef({
        wantVideo: DEFAULT_WANT_VIDEO,
        cameraDeviceId: null,
    });

    const stopScreenCapture = useCallback((why = "stopScreenCapture") => {
        screenPickerLockRef.current = false;
        mediaRef.current.screenEndingAt = Date.now();

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

        mediaRef.current.screenTrackId = null;
        mediaRef.current.screenPickNonce =
            (mediaRef.current.screenPickNonce || 0) + 1;

        if (mediaRef.current.videoSource === "screen") {
            mediaRef.current.videoSource = "camera";
        }
    }, []);
    // =========================================================
    // 15.1) ✅ mode switch 전용: "의도 유지" 리조인 + 모드 스위치 헬퍼
    // - finalize가 intent를 DEFAULT로 리셋하는 걸 막기 위해 preserveScreenOnFinalizeRef를 "intent preserve"로도 사용
    // - 단, preserve=true면 finalize가 local track stop을 안하므로 여기서 미리 stop 해줌
    // =========================================================
    const rejoinPreserveIntent = useCallback(
        async (reason = "rejoinPreserveIntent") => {
            return runSessionOp(`rejoinPreserveIntent:${reason}`, async () => {
                const last = sessionRef.current.lastJoin;
                if (!last) return;

                safeSet(() => setIsConnecting(true));
                connRef.current.isConnecting = true;

                // preserve=true면 finalize에서 local track stop을 안하므로, 여기서 미리 정리
                try {
                    const s = janusRef.current.localStream;
                    s?.getTracks?.().forEach((t) => {
                        try {
                            t.onended = null;
                            t.oninactive = null;
                            t.stop();
                        } catch {}
                    });
                } catch {}
                try {
                    setLocalStream(null);
                } catch {}

                preserveScreenOnFinalizeRef.current = true;
                try {
                    await leaveRoomRef.current?.(`${reason}.preserveIntent`);
                } finally {
                    preserveScreenOnFinalizeRef.current = false;
                }

                await joinRoomRef.current?.(last);
            });
        },
        [runSessionOp, safeSet, setLocalStream]
    );

    const modeSwitchingRef = useRef(false);
    const switchVideoModeRef = useRef(null);

    const switchVideoModeImpl = useCallback(
        async (nextMode, opts = {}) => {
            const reason = opts?.reason || "switchVideoMode";
            const toCameraDeviceId =
                opts?.cameraDeviceId ??
                beforeScreenRef.current.cameraDeviceId ??
                null;

            if (modeSwitchingRef.current) return;
            if (connRef.current.isConnecting) return;

            const m = mediaRef.current;
            const cur = m.videoSource || "camera";
            if (cur === nextMode) return;

            // 모드 전환은 pending/quiet/offerRetry 다 끊어줌(꼬임 방지)
            applySeqRef.current += 1;
            clearTimer("publishDebounce");
            if (timersRef.current.offerRetry) {
                clearTimeout(timersRef.current.offerRetry);
                timersRef.current.offerRetry = null;
            }
            timersRef.current.offerRetryPending = null;
            negotiationRef.current.pending = null;

            modeSwitchingRef.current = true;
            try {
                // =========================================================
                // camera -> screen : picker로 stream 확보 후 "의도 유지 리조인"
                // =========================================================
                if (nextMode === "screen") {
                    // camera 상태 백업(복귀용)
                    beforeScreenRef.current = {
                        wantVideo: !!m.wantVideo,
                        cameraDeviceId: m.cameraDeviceId ?? null,
                    };

                    // intent 먼저 screen으로 전환
                    m.videoSource = "screen";
                    m.cameraDeviceId = null;
                    m.screenSoftMuted = false;
                    m.wantVideo = true;
                    m.permissionDeniedScreen = false;

                    m.screenPickNonce = (m.screenPickNonce || 0) + 1;
                    m.screenTrackId = null;
                    m.screenStream = null;

                    emitLocalMediaState();

                    const md = navigator.mediaDevices;
                    if (!md?.getDisplayMedia) {
                        m.permissionDeniedScreen = true;
                        m.videoSource = "camera";
                        emitLocalMediaState();
                        safeSet(() =>
                            setError(
                                "이 브라우저는 화면 공유를 지원하지 않습니다."
                            )
                        );
                        return;
                    }

                    if (screenPickerLockRef.current) return;
                    screenPickerLockRef.current = true;

                    let stream = null;
                    try {
                        stream = await md.getDisplayMedia({
                            video: true,
                            audio: false,
                        });
                    } catch (err) {
                        screenPickerLockRef.current = false;

                        // picker 취소/거부 => camera로 복구(리조인 X)
                        m.permissionDeniedScreen = true;

                        m.screenPickNonce = (m.screenPickNonce || 0) + 1;
                        m.screenTrackId = null;

                        m.videoSource = "camera";
                        m.screenSoftMuted = false;
                        m.screenStream = null;

                        m.cameraDeviceId =
                            beforeScreenRef.current.cameraDeviceId ?? null;
                        m.wantVideo = !!beforeScreenRef.current.wantVideo;

                        emitLocalMediaState();
                        safeSet(() =>
                            setError(
                                "화면 공유 권한이 거부되었거나 취소되었습니다."
                            )
                        );

                        if (
                            connRef.current.isConnected &&
                            janusRef.current.pub
                        ) {
                            const restoreVideo =
                                !!beforeScreenRef.current.wantVideo;
                            queuePublish(m.wantAudio, restoreVideo, {
                                republish: true,
                                reason: "screen-cancel-restore-camera",
                            });
                        }
                        return;
                    } finally {
                        screenPickerLockRef.current = false;
                    }

                    // picker 성공
                    m.screenStream = stream;
                    const t = stream.getVideoTracks?.()[0] || null;
                    m.screenTrackId = t?.id || null;
                    m.screenPickNonce = (m.screenPickNonce || 0) + 1;

                    // ✅ screen 종료(브라우저 stop) => screen -> camera 모드 전환 리조인
                    stream.getVideoTracks?.().forEach((track) => {
                        track.onended = () => {
                            if (
                                sessionRef.current.destroying ||
                                closingRef.current
                            )
                                return;
                            switchVideoModeRef.current?.("camera", {
                                reason: "screen-ended",
                            });
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
                            screenPickNonce: Number(m.screenPickNonce || 0),
                        },
                        {
                            immediate: false,
                            reason: "screen-picked.intent",
                            phase: "intent",
                        }
                    );

                    // ✅ picker 성공 즉시: 세션 유지 + republish로 화면공유 반영
                    if (connRef.current.isConnected && janusRef.current.pub) {
                        queuePublish(m.wantAudio, true, {
                            republish: true,
                            reason: `${reason}.screen-picked`,
                        });
                    }
                    return;
                }

                // =========================================================
                // screen -> camera : screen 정리 후 "의도 유지 리조인"
                // =========================================================
                // 화면 캡처 정리(스트림 stop + nonce bump + source camera)
                stopScreenCapture(`${reason}.stopScreen`);

                m.videoSource = "camera";
                m.cameraDeviceId = toCameraDeviceId;

                // 복귀 시 원래 비디오 의도 복원(없으면 현재값 유지)
                if (typeof beforeScreenRef.current.wantVideo === "boolean") {
                    m.wantVideo = !!beforeScreenRef.current.wantVideo;
                }

                m.screenSoftMuted = false;

                emitLocalMediaState();

                signalLocalMedia(
                    {
                        audio: !!m.wantAudio,
                        video: !!m.wantVideo,
                        videoDeviceLost: false,
                        videoSource: "camera",
                        screenSoftMuted: false,
                        screenCapturing: false,
                        screenPickNonce: Number(m.screenPickNonce || 0),
                    },
                    {
                        immediate: true,
                        reason: "switch-to-camera.intent",
                        phase: "intent",
                        force: true,
                    }
                );

                if (connRef.current.isConnected && janusRef.current.pub) {
                    queuePublish(m.wantAudio, !!m.wantVideo, {
                        republish: true,
                        reason: `${reason}.back-to-camera`,
                    });
                }
            } finally {
                modeSwitchingRef.current = false;
            }
        },
        [
            clearTimer,
            emitLocalMediaState,
            queuePublish,
            rejoinPreserveIntent,
            safeSet,
            signalLocalMedia,
            stopScreenCapture,
        ]
    );

    useEffect(() => {
        switchVideoModeRef.current = switchVideoModeImpl;
    }, [switchVideoModeImpl]);

    // =========================================================
    // 16) toggleAudio / toggleVideo / screen helpers
    // =========================================================

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

        stopScreenCapture("toggleVideo->camera");

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
        stopScreenCapture,
    ]);

    // ✅ screen 토글도 세션 재생성 없이 camera처럼
    const toggleScreenShare = useCallback(() => {
        if (isQuietWindowActive()) return;
        if (connRef.current.isConnecting) return;

        const m = mediaRef.current;
        const isScreenMode = m.videoSource === "screen";
        const isSoftOff =
            isScreenMode && m.wantVideo === true && m.screenSoftMuted === true;
        const isOn =
            isScreenMode && m.wantVideo === true && m.screenSoftMuted !== true;

        // 1) ON -> soft off(송출만 끔)
        if (isOn) {
            m.screenSoftMuted = true;
            m.wantVideo = true;
            emitLocalMediaState();

            if (connRef.current.isConnected && janusRef.current.pub) {
                scheduleApplyIntent("screen-soft-off");
            }
            return;
        }

        // 2) soft off -> soft on(송출 다시 켬)
        if (isSoftOff) {
            m.screenSoftMuted = false;
            m.wantVideo = true;
            emitLocalMediaState();

            if (connRef.current.isConnected && janusRef.current.pub) {
                scheduleApplyIntent("screen-soft-on");
            }
            return;
        }

        // 3) camera -> screen 시작 (✅ 모드 전환: picker + 의도 유지 리조인)
        switchVideoModeRef.current?.("screen", { reason: "toggleScreenShare" });
    }, [
        emitLocalMediaState,
        isQuietWindowActive,
        scheduleApplyIntent,
        safeSet,
        setLocalStream,
    ]);

    // ✅ Screen Picker (tick 기반) - 세션 재생성 없이 publish로만 반영
    useEffect(() => {
        const m = mediaRef.current;

        if (!isConnected) return;
        if (sessionRef.current.destroying || closingRef.current) return;
        if (m.videoSource !== "screen") return;
        if (m.screenSoftMuted) return;
        if (m.screenStream) return;

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

                const t = stream.getVideoTracks?.()[0] || null;
                m.screenTrackId = t?.id || null;
                m.screenPickNonce = (m.screenPickNonce || 0) + 1;

                // ✅ screen track 종료 -> camera 복귀 + republish (세션 재생성 X)
                stream.getVideoTracks()?.forEach((track) => {
                    track.onended = () => {
                        if (sessionRef.current.destroying || closingRef.current)
                            return;
                        if (applySeqRef.current === 0) return;

                        m.screenEndingAt = Date.now();

                        // 캡처 정리
                        try {
                            m.screenStream
                                ?.getTracks()
                                ?.forEach((t2) => t2.stop());
                        } catch {}
                        m.screenStream = null;

                        m.videoSource = "camera";
                        m.screenSoftMuted = false;
                        m.permissionDeniedScreen = false;

                        // 복귀 시 원래 카메라/상태로
                        m.cameraDeviceId =
                            beforeScreenRef.current.cameraDeviceId ?? null;
                        m.wantVideo = !!beforeScreenRef.current.wantVideo;

                        m.screenTrackId = null;
                        m.screenPickNonce = (m.screenPickNonce || 0) + 1;

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
                                screenPickNonce: Number(m.screenPickNonce || 0),
                            },
                            {
                                immediate: true,
                                reason: "screen-ended",
                                phase: "intent",
                                force: true,
                            }
                        );

                        // ✅ 기존 세션에서 republish로 카메라 복귀
                        if (
                            connRef.current.isConnected &&
                            janusRef.current.pub
                        ) {
                            scheduleApplyIntent("screen-ended->camera");
                        }
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
                        screenPickNonce: Number(m.screenPickNonce || 0),
                    },
                    {
                        immediate: false,
                        reason: "screen-picked.intent",
                        phase: "intent",
                    }
                );

                // ✅ 기존 세션에서 publish(재협상)
                scheduleApplyIntent("screen-picked");
            } catch (err) {
                screenPickerLockRef.current = false;
                m.permissionDeniedScreen = true;

                m.screenPickNonce = (m.screenPickNonce || 0) + 1;
                m.screenTrackId = null;

                // picker 취소/거부 시 camera로 복구
                m.videoSource = "camera";
                m.screenSoftMuted = false;
                m.screenStream = null;

                // 복구 상태
                m.cameraDeviceId =
                    beforeScreenRef.current.cameraDeviceId ?? null;
                m.wantVideo = !!beforeScreenRef.current.wantVideo;

                emitLocalMediaState();
                safeSet(() =>
                    setError("화면 공유 권한이 거부되었거나 취소되었습니다.")
                );

                if (connRef.current.isConnected && janusRef.current.pub) {
                    const restoreVideo = !!beforeScreenRef.current.wantVideo;
                    queuePublish(m.wantAudio, restoreVideo, {
                        republish: true,
                        reason: "screen-cancel-restore-camera",
                    });
                }
            }
        })();
    }, [
        isConnected,
        screenPickerTick,
        emitLocalMediaState,
        scheduleApplyIntent,
        safeSet,
        signalLocalMedia,
        queuePublish,
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

    useEffect(() => {
        const onResync = (e) => {
            const roomNumber = sessionRef.current.lastJoin?.roomNumber;
            if (!roomNumber) return;
            if (!connRef.current.isConnected) return;
            if (!janusRef.current.pub) return;

            // 수신자가 강제로 listparticipants -> detach/attach 재구독
            forceResubscribeAllRef.current?.(roomNumber, "ws-resync");
        };

        window.addEventListener("janus:resync", onResync);
        return () => window.removeEventListener("janus:resync", onResync);
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

    // ✅ screen 권한 재시도도 세션 재생성 없이 picker -> publish
    const retryScreenPermission = useCallback(() => {
        const m = mediaRef.current;

        m.permissionDeniedScreen = false;
        safeSet(() => setError(null));

        m.videoSource = "screen";
        m.cameraDeviceId = null;
        m.wantVideo = true;
        m.screenSoftMuted = false;

        m.screenPickNonce = (m.screenPickNonce || 0) + 1;
        m.screenTrackId = null;
        m.screenStream = null;

        safeSet(() => setVideoEnabled(true));
        emitLocalMediaState();

        safeSet(() => setScreenPickerTick((v) => v + 1));
    }, [emitLocalMediaState, safeSet]);

    // =========================================================
    // 20) setVideoSource (Picker 강제 + 전환 정책)
    //    - ✅ camera: 기존 세션 유지 + republish
    //    - ✅ screen : 기존 세션 유지 + picker + republish (세션 재생성 X)
    // =========================================================
    const setVideoSource = useCallback(
        async (nextType, deviceId = null) => {
            applySeqRef.current += 1;

            clearTimer("publishDebounce");
            if (timersRef.current.offerRetry) {
                clearTimeout(timersRef.current.offerRetry);
                timersRef.current.offerRetry = null;
            }
            negotiationRef.current.pending = null;

            // 기존 screen 정리
            if (mediaRef.current.videoSource === "screen") {
                try {
                    const ss = mediaRef.current.screenStream;
                    ss?.getTracks?.().forEach((t) => t.stop());
                } catch {}
                mediaRef.current.screenStream = null;
                mediaRef.current.screenSoftMuted = false;
                mediaRef.current.screenTrackId = null;
                mediaRef.current.screenPickNonce =
                    (mediaRef.current.screenPickNonce || 0) + 1;
                screenPickerLockRef.current = false;
            }

            // ===== ✅ CAMERA PATH: 기존 세션 유지 + republish =====
            if (nextType !== "screen") {
                if (connRef.current.isConnected && janusRef.current.pub) {
                    try {
                        janusRef.current.pub.send({
                            message: {
                                request: "configure",
                                audio: !!mediaRef.current.wantAudio,
                                video: false,
                            },
                        });
                    } catch {}
                }

                try {
                    const s = janusRef.current.localStream;
                    s?.getVideoTracks?.()?.forEach((t) => {
                        try {
                            t.onended = null;
                            t.oninactive = null;
                            t.stop();
                        } catch {}
                    });
                } catch {}
                try {
                    setLocalStream(null);
                } catch {}

                mediaRef.current.videoSource = "camera";
                mediaRef.current.cameraDeviceId = deviceId ?? null;
                mediaRef.current.screenSoftMuted = false;
                mediaRef.current.wantVideo = true;

                if (!mediaRef.current.permissionDeniedVideo) {
                    mediaRef.current.videoLost = false;
                }

                emitLocalMediaState();

                if (connRef.current.isConnected && janusRef.current.pub) {
                    queuePublish(mediaRef.current.wantAudio, true, {
                        republish: true,
                        reason: "setVideoSource.camera.republish",
                    });
                }

                return;
            }

            // ===== ✅ SCREEN PATH: 세션 유지 + picker + republish (재생성 X) =====
            switchVideoModeRef.current?.("screen", {
                reason: "setVideoSource.screen",
            });
            return;
        },
        [emitLocalMediaState, clearTimer, safeSet, queuePublish, setLocalStream]
    );

    // =========================================================
    // 21) stopVideo (video 완전 OFF) ✅ 세션 재생성 제거
    // =========================================================
    const stopVideo = useCallback(
        (reason = "stopVideo") => {
            // screen 정리
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

            mediaRef.current.screenTrackId = null;
            mediaRef.current.screenPickNonce =
                (mediaRef.current.screenPickNonce || 0) + 1;

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
                    screenPickNonce: Number(
                        mediaRef.current.screenPickNonce || 0
                    ),
                },
                { immediate: true, reason: "stopVideo" }
            );

            // ✅ 기존 세션에서 video false로 republish
            if (connRef.current.isConnected && janusRef.current.pub) {
                queuePublish(mediaRef.current.wantAudio, false, {
                    republish: true,
                    reason: `${reason}.republish-video-off`,
                });
            } else {
                // 연결 전이면 intent만 유지
            }
        },
        [emitLocalMediaState, safeSet, signalLocalMedia, queuePublish]
    );

    // ✅ restartScreenShare: 세션 재생성 없이 picker -> publish
    const restartScreenShare = useCallback(() => {
        if (isQuietWindowActive()) return;

        // 기존 캡처 정리(이 호출이 videoSource를 camera로 돌려놓기 때문에
        // switchVideoMode("screen")이 정상 동작함)
        stopScreenCapture("restartScreenShare");

        switchVideoModeRef.current?.("screen", {
            reason: "restartScreenShare",
        });
    }, [isQuietWindowActive, stopScreenCapture]);

    // =========================================================
    // 22) Exports
    // =========================================================
    return {
        isSupported,
        isConnecting,
        isConnected,
        error,

        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        noMediaDevices,

        localMedia,

        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        restartScreenShare,

        joinRoom,
        leaveRoom,

        reinjectIfPossible,
        hardReconnect,
        recreateSession, // screen에서는 사용 안함(남겨둠)

        retryVideoPermission,
        retryScreenPermission,

        getVideoInputs,
        setVideoSource,

        stopVideo,
    };
}
