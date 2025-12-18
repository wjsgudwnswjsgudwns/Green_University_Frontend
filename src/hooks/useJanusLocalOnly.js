// src/hooks/useJanusLocalOnly.js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useJanusLocalOnly (ref-minimized, stable final)
 * - UI 단일 진실: localMedia
 * - 주요 안정화:
 *   1) leaveRoom ref화(항상 최신 finalize)
 *   2) boot timeout(조인 멈춤 1회 복구)
 *   3) display fallback 강화(remote 매칭 깨짐 방지)
 *   4) wantVideo 필터 시 videoLost 강제 해제(“끊김 오판” 방지)
 *
 * ✅ 실무 표준 오토플레이/정책 대응:
 *   - 입장 기본: 마이크 OFF (wantAudio=false)
 *   - 비디오는 가능하면 ON (wantVideo=true)
 *   - 오디오는 "사용자 버튼"으로 toggleAudio 했을 때만 송출 시작
 *
 * ✅ 연타 방지(이번 패치 핵심):
 *   - 토글 버튼 연타 중: "아무 일도" 일어나지 않게(클릭 무시)
 *   - 연타 멈춘 뒤: 마지막 의도 1회만 publish (scheduleApplyIntent)
 *
 * ✅ 이번 추가 핵심(SESSION_REPLACED 방어용):
 *   - "카메라 권한 거부/디바이스 없음" 에러는 즉시 '미디어 없이 참가'로 다운그레이드하고
 *     offerRetry/hardReconnect를 절대 타지 않게 함 (불필요한 재접속 → SESSION_REPLACED 유발 방지)
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

    useEffect(() => {
        callbacksRef.current.onRemoteParticipantsChanged =
            options?.onRemoteParticipantsChanged || null;
    }, [options?.onRemoteParticipantsChanged]);

    useEffect(() => {
        callbacksRef.current.onLocalStream = options?.onLocalStream || null;
    }, [options?.onLocalStream]);

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

    // ✅ 실무 기본값: 입장 마이크 OFF / 비디오 ON
    const DEFAULT_WANT_AUDIO = false;
    const DEFAULT_WANT_VIDEO = true;

    // 호환/디버그용 (UI는 localMedia만 보게 설계)
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
    });

    // =========================================================
    // 2) Refs (최소 덩어리)
    // =========================================================
    // ✅ 세션 세대(이전 async 이벤트 무효화)
    const genRef = useRef(0); // join/leave마다 증가
    const closingRef = useRef(false); // leave 시작~finalize까지 true

    // ✅ leave 완료를 기다릴 수 있게 Promise 제공
    const leaveWaitRef = useRef({
        promise: null,
        resolve: null,
    });

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

    const connRef = useRef({
        isConnected: false,
        isConnecting: false,
    });

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
        lastJoin: null, // {roomNumber, displayName}
        bootRetryCount: 0,
        myFeedId: null,
    });

    const timersRef = useRef({
        notify: null,
        deviceDebounce: null,
        deviceCooldown: 0,
        boot: null, // ✅ boot timeout

        offerRetry: null,
        // ✅ offerRetry 동안 마지막 의도 저장 후 1회 재시도
        offerRetryPending: null, // { audio, video }
        // ✅ 토글 연타 방지용 publish 디바운스(자동 이벤트용)
        publishDebounce: null,
    });
    const pendingPublishRef = useRef(null); // { audio, video, opts }

    /**
     * Tracks how many consecutive createOffer errors have occurred.
     */
    const offerErrorCountRef = useRef(0);

    // “사용자 의도”의 단일 진실
    const mediaRef = useRef({
        wantAudio: DEFAULT_WANT_AUDIO,
        wantVideo: DEFAULT_WANT_VIDEO,

        noDevices: false,
        hasAudioDevice: true,
        hasVideoDevice: true,

        videoLost: false,
        permissionDeniedVideo: false,
    });

    const negotiationRef = useRef({
        locked: false,
        pending: null, // { audio, video }
    });

    const publishedRef = useRef(false);
    const lastConfiguredRef = useRef({ audio: null, video: null });

    // ✅ “수동 재연결 로직”을 훅 내부에서 재사용하기 위한 ref
    const hardReconnectRef = useRef(null);

    // ✅ track dead 이후, devicechange가 안 와도 1회 재시도 트리거용
    const deadRetryTimerRef = useRef(null);

    // =========================================================
    // 3) 토글 연타 코알레싱(quiet window)
    // =========================================================
    const applyTimerRef = useRef(null);
    const bumpTimerRef = useRef(null);
    const applySeqRef = useRef(0);

    // 마지막으로 Janus에 "적용"한 의도(중복 publish 방지)
    const lastAppliedIntentRef = useRef({ audio: null, video: null });

    // 튜닝값
    const QUIET_MS = 650; // 연타 멈춘 뒤 적용까지 대기
    const SAFE_BUMP_MS = 900; // 적용 후 보수적 1회 추가 republish

    const publishLocalStreamRef = useRef(null);
    const forceResubscribeAllRef = useRef(null);

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

        applyTimerRef.current = window.setTimeout(() => {
            applyTimerRef.current = null;

            // 최신 스케줄만 실행
            if (seq !== applySeqRef.current) return;

            if (!connRef.current.isConnected) return;
            if (!janusRef.current.pub) return;
            if (closingRef.current || sessionRef.current.destroying) return;
            if (mediaRef.current.permissionDeniedVideo) return;

            const a = !!mediaRef.current.wantAudio;
            const v = !!mediaRef.current.wantVideo;

            // 이미 같은 의도를 적용했으면 skip
            if (
                lastAppliedIntentRef.current.audio === a &&
                lastAppliedIntentRef.current.video === v
            ) {
                return;
            }

            // 협상 중/offerRetry 중이면 pending으로만 저장하고 종료
            if (negotiationRef.current.locked || timersRef.current.offerRetry) {
                negotiationRef.current.pending = { audio: a, video: v };
                return;
            }

            lastAppliedIntentRef.current = { audio: a, video: v };

            publishLocalStreamRef.current?.(a, v, { republish: true });

            // ✅ 보수적 1회 bump
            bumpTimerRef.current = window.setTimeout(() => {
                bumpTimerRef.current = null;

                if (seq !== applySeqRef.current) return;

                if (!connRef.current.isConnected) return;
                if (!janusRef.current.pub) return;
                if (closingRef.current || sessionRef.current.destroying) return;
                if (mediaRef.current.permissionDeniedVideo) return;

                if (
                    negotiationRef.current.locked ||
                    timersRef.current.offerRetry
                ) {
                    negotiationRef.current.pending = { audio: a, video: v };
                    return;
                }

                publishLocalStreamRef.current?.(a, v, { republish: true });
            }, SAFE_BUMP_MS);
        }, QUIET_MS);
    }, []);

    // ✅ 연타 중 클릭 무시(“아무 일도 없음”)
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

    const clearTimer = useCallback((key) => {
        const t = timersRef.current[key];
        if (t) {
            window.clearTimeout(t);
            timersRef.current[key] = null;
        }
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

    // =========================================================
    // 5) Local media snapshot (UI 단일 진실 갱신)
    // =========================================================
    const emitLocalMediaState = useCallback(() => {
        const s = janusRef.current.localStream;
        const liveAudio = hasLiveTrack(s, "audio");
        const liveVideo = hasLiveTrack(s, "video");

        const wantAudio = !!mediaRef.current.wantAudio;
        const wantVideo = !!mediaRef.current.wantVideo;

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
        };

        safeSet(() => {
            setLocalMedia((prev) => {
                const same =
                    prev.audio === next.audio &&
                    prev.video === next.video &&
                    prev.videoDeviceLost === next.videoDeviceLost &&
                    prev.noMediaDevices === next.noMediaDevices &&
                    prev.liveAudio === next.liveAudio &&
                    prev.liveVideo === next.liveVideo;
                return same ? prev : next;
            });

            // 호환 state도 정렬
            setAudioEnabled(wantAudio);
            setVideoEnabled(wantVideo);
            setIsVideoDeviceLost(!!videoDeviceLost);
            setNoMediaDevices(!!mediaRef.current.noDevices);
        });
    }, [hasLiveTrack, safeSet]);

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
    // 7) publish 디바운스(자동 이벤트용) + reinject
    // =========================================================
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
        if (mediaRef.current.permissionDeniedVideo) return;
        if (negotiationRef.current.locked) return;

        queuePublish(mediaRef.current.wantAudio, mediaRef.current.wantVideo, {
            republish: true,
        });
    }, [queuePublish]);

    // =========================================================
    // 8) Local stream setter (track dead 감지)
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
                    if (deadRetryTimerRef.current)
                        window.clearTimeout(deadRetryTimerRef.current);

                    deadRetryTimerRef.current = window.setTimeout(() => {
                        deadRetryTimerRef.current = null;

                        if (closingRef.current || sessionRef.current.destroying)
                            return;
                        if (!connRef.current.isConnected) return;
                        if (mediaRef.current.permissionDeniedVideo) return;
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

    useEffect(() => {
        emitLocalMediaState();
    }, [emitLocalMediaState]);

    // =========================================================
    // 9) Negotiation helpers
    // =========================================================
    const lockNegotiation = useCallback(() => {
        if (negotiationRef.current.locked) return false;
        negotiationRef.current.locked = true;
        return true;
    }, []);

    const unlockNegotiation = useCallback(() => {
        negotiationRef.current.locked = false;

        const pending = negotiationRef.current.pending;
        if (!pending) return;
        if (mediaRef.current.permissionDeniedVideo) {
            negotiationRef.current.pending = null;
            return;
        }
        negotiationRef.current.pending = null;
        scheduleApplyIntent("unlock-pending");
    }, [scheduleApplyIntent]);

    // =========================================================
    // 10) Remote feed attach/detach/reset
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

                        if (janusRef.current.remote?.[p.id]) {
                            detachRemoteFeed(p.id);
                        }
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
    // 11) publish / republish (의도값 -> 실제값)
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

            const intentVideoSafe = mediaRef.current.permissionDeniedVideo
                ? false
                : !!intentVideo;

            mediaRef.current.wantAudio = !!intentAudio;
            mediaRef.current.wantVideo = !!intentVideo;

            safeSet(() => {
                setAudioEnabled(!!intentAudio);
                setVideoEnabled(!!intentVideo);
            });

            await refreshDeviceAvailability().catch(() => null);

            const noDev = !!mediaRef.current.noDevices;
            const hasA = !!mediaRef.current.hasAudioDevice;
            const hasV = !!mediaRef.current.hasVideoDevice;

            const wantAudio = !!intentAudio && !noDev && hasA;
            const wantVideo = !!intentVideoSafe && !noDev && hasV;

            // wantVideo가 false면 lost는 무조건 false
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
                    safeSet(() =>
                        setError(
                            "미디어 없이 참가 처리 중 오류가 발생했습니다."
                        )
                    );
                    safeSet(() => setIsConnecting(false));
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

            const replaceAudio = republish ? prev.audio !== !!wantAudio : true;
            const replaceVideo = republish ? prev.video !== !!wantVideo : true;

            handle.createOffer({
                media: {
                    audioRecv: false,
                    videoRecv: false,
                    audioSend: !!wantAudio,
                    videoSend: !!wantVideo,
                    replaceAudio,
                    replaceVideo,
                },
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

                        // 비디오 OFF→ON 이면 resub 트리거
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
                            mediaRef.current.permissionDeniedVideo = false;
                            safeSet(() => setIsVideoDeviceLost(false));
                        }

                        const latest =
                            handle?.webrtcStuff?.myStream ||
                            handle?.webrtcStuff?.stream ||
                            null;
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

                    // ---- 에러 분류(먼저) ----
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

                    // ✅ 1) 권한 거부/디바이스 없음은 즉시 다운그레이드(재시도/리커넥트 금지)
                    if (isPermissionDenied || isDeviceNotFound) {
                        // 예약된 offerRetry가 있다면 취소
                        if (timersRef.current.offerRetry) {
                            clearTimeout(timersRef.current.offerRetry);
                            timersRef.current.offerRetry = null;
                        }
                        timersRef.current.offerRetryPending = null;

                        negotiationRef.current.pending = null;
                        negotiationRef.current.locked = false;

                        if (isPermissionDenied) {
                            mediaRef.current.videoLost = true;
                            mediaRef.current.permissionDeniedVideo = true;

                            try {
                                setLocalStream(null);
                            } catch {}

                            safeSet(() => {
                                setVideoEnabled(true);
                                setIsVideoDeviceLost(true);
                                setIsConnecting(false);
                                setError(
                                    "카메라 권한이 거부되어 영상 송출이 불가능합니다. 브라우저 권한을 확인해 주세요."
                                );
                            });
                        } else {
                            // device not found
                            await refreshDeviceAvailability().catch(() => null);
                            mediaRef.current.videoLost = false;
                            mediaRef.current.permissionDeniedVideo = false;

                            try {
                                setLocalStream(null);
                            } catch {}

                            safeSet(() => {
                                setIsVideoDeviceLost(false);
                                setIsConnecting(false);
                            });
                        }

                        // ✅ 미디어 없이 참가로 안정화
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

                    // offerRetry는 1개만 유지
                    if (timersRef.current.offerRetry) {
                        clearTimeout(timersRef.current.offerRetry);
                        timersRef.current.offerRetry = null;
                    }

                    // pc dead 판단(권한/디바이스는 위에서 이미 return)
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

                    // ✅ 2.5초 재시도: 마지막 의도 1회만 적용
                    timersRef.current.offerRetry = window.setTimeout(() => {
                        timersRef.current.offerRetry = null;

                        const p = negotiationRef.current.pending;
                        if (!p) return;

                        negotiationRef.current.pending = null;

                        if (closingRef.current || sessionRef.current.destroying)
                            return;
                        if (!connRef.current.isConnected) return;
                        if (mediaRef.current.permissionDeniedVideo) return;

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
                        if (mediaRef.current.permissionDeniedVideo) return;

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

                    // 3회 이상 누적이면 비디오 포기(세션은 유지)
                    if (offerErrorCountRef.current >= 3) {
                        mediaRef.current.videoLost = true;
                        // 권한 거부로 확정은 아님 → permissionDeniedVideo는 false 유지
                        try {
                            setLocalStream(null);
                        } catch {}
                        safeSet(() => {
                            setIsVideoDeviceLost(true);
                            setIsConnecting(false);
                            setError(
                                "영상 송출 재협상이 반복 실패했습니다. 카메라 상태(점유/드라이버/권한)를 확인해 주세요."
                            );
                        });

                        // 미디어 없이 참가로 다운그레이드
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

                    // wantVideo였는데 실패 → lost만 표시하고 세션 유지
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
            });
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
    // 12) finalize / cleanup (연결만 정리)
    // =========================================================
    const finalize = useCallback(
        (reason = "finalize") => {
            sessionRef.current.joined = false;
            sessionRef.current.destroying = false;
            sessionRef.current.bootRetryCount = 0;

            clearTimer("notify");
            clearTimer("deviceDebounce");
            clearTimer("boot");
            clearTimer("publishDebounce");

            // offerRetry 정리
            if (timersRef.current.offerRetry) {
                window.clearTimeout(timersRef.current.offerRetry);
                timersRef.current.offerRetry = null;
            }

            timersRef.current.offerRetryPending = null;
            pendingPublishRef.current = null;

            // ✅ 토글 코알레싱 타이머 정리
            if (applyTimerRef.current) {
                window.clearTimeout(applyTimerRef.current);
                applyTimerRef.current = null;
            }
            if (bumpTimerRef.current) {
                window.clearTimeout(bumpTimerRef.current);
                bumpTimerRef.current = null;
            }
            applySeqRef.current += 1;
            lastAppliedIntentRef.current = { audio: null, video: null };

            resetRemoteFeeds();

            // local stream stop
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
            janusRef.current.localStream = null;
            setLocalStream(null);

            // plugin/janus
            try {
                janusRef.current.pub?.hangup?.();
            } catch {}
            janusRef.current.pub = null;
            janusRef.current.privateId = null;
            janusRef.current.janus = null;

            // negotiation
            negotiationRef.current.locked = false;
            negotiationRef.current.pending = null;

            // publish state
            publishedRef.current = false;
            lastConfiguredRef.current = { audio: null, video: null };

            // 기본값 복구
            mediaRef.current.wantAudio = DEFAULT_WANT_AUDIO;
            mediaRef.current.wantVideo = DEFAULT_WANT_VIDEO;
            mediaRef.current.videoLost = false;

            safeSet(() => {
                setIsConnecting(false);
                setIsConnected(false);
                setError(null);

                setAudioEnabled(DEFAULT_WANT_AUDIO);
                setVideoEnabled(DEFAULT_WANT_VIDEO);
                setIsVideoDeviceLost(false);
            });

            if (deadRetryTimerRef.current) {
                window.clearTimeout(deadRetryTimerRef.current);
                deadRetryTimerRef.current = null;
            }

            connRef.current.isConnected = false;
            connRef.current.isConnecting = false;

            emitLocalMediaState();
            closingRef.current = false;
            leaveWaitRef.current.resolve?.();
            resetLeaveWait();
        },
        [
            clearTimer,
            emitLocalMediaState,
            resetRemoteFeeds,
            safeSet,
            setLocalStream,
            resetLeaveWait,
        ]
    );

    const finalizeRef = useRef(finalize);
    useEffect(() => {
        finalizeRef.current = finalize;
    }, [finalize]);

    // =========================================================
    // 13) leaveRoom (ref-safe)
    // =========================================================
    const leaveRoomRef = useRef(null);

    const leaveRoomImpl = useCallback(
        (reason = "leaveRoom") => {
            if (sessionRef.current.destroying)
                return leaveWaitRef.current.promise;

            sessionRef.current.destroying = true;

            closingRef.current = true;
            bumpGen();

            clearTimer("boot");

            const janus = janusRef.current.janus;
            const pub = janusRef.current.pub;

            try {
                pub?.send?.({ message: { request: "leave" } });
            } catch {}

            if (janus) {
                try {
                    janus.destroy();
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
    // 14) Create session & publisher attach (+ boot timeout mark)
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

                                // 입장 직후 publish
                                publishLocalStreamRef.current?.(
                                    mediaRef.current.wantAudio,
                                    mediaRef.current.wantVideo,
                                    { republish: true }
                                );

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
        ]
    );

    // =========================================================
    // 15) joinRoom (+ boot timeout / 1회 재시도)
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
                mediaRef.current.noDevices ||
                !mediaRef.current.hasVideoDevice
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
    // 16) toggleAudio / toggleVideo (✅ 연타 중 완전 무시)
    // =========================================================
    const toggleAudio = useCallback(() => {
        // ✅ 연타 중이면 “아무 일도 없음”
        if (isQuietWindowActive()) return;

        const next = !mediaRef.current.wantAudio;
        mediaRef.current.wantAudio = next;

        // UI 의도는 반영
        safeSet(() => setAudioEnabled(next));
        emitLocalMediaState();

        if (!connRef.current.isConnected || !janusRef.current.pub) return;

        // ✅ publish는 즉시 하지 않고 quiet 이후 1회만
        scheduleApplyIntent("toggleAudio");
    }, [
        emitLocalMediaState,
        safeSet,
        scheduleApplyIntent,
        isQuietWindowActive,
    ]);

    const toggleVideo = useCallback(() => {
        // ✅ 연타 중이면 “아무 일도 없음”
        if (isQuietWindowActive()) return;

        const next = !mediaRef.current.wantVideo;
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

        // ✅ publish는 즉시 하지 않고 quiet 이후 1회만
        scheduleApplyIntent("toggleVideo");
    }, [
        emitLocalMediaState,
        safeSet,
        scheduleApplyIntent,
        isQuietWindowActive,
    ]);

    // =========================================================
    // 17) devicechange  (force hardReconnect)
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

    // =========================================================
    // 19) hardReconnect / retryVideoPermission
    // =========================================================
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

    const retryVideoPermission = useCallback(() => {
        mediaRef.current.permissionDeniedVideo = false;
        mediaRef.current.videoLost = false;
        safeSet(() => setIsVideoDeviceLost(false));
        setError(null);
        setIsConnecting(true);
        emitLocalMediaState();

        reinjectIfPossible();
    }, [emitLocalMediaState, reinjectIfPossible, safeSet]);

    // =========================================================
    // 20) Exports
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
        joinRoom,
        leaveRoom,
        reinjectIfPossible,
        hardReconnect,
        retryVideoPermission,
    };
}
