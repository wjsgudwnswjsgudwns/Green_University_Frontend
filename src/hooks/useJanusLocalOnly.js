// src/hooks/useJanusLocalOnly.js
import { useCallback, useEffect, useRef, useState } from "react";

export function useJanusLocalOnly(
    serverUrl = "https://janus.jsflux.co.kr/janus",
    options = {}
) {
    const { onRemoteParticipantsChanged, onLocalStream, onLocalMediaState } =
        options || {};

    const remoteChangedRef = useRef(null);
    const localStreamChangedRef = useRef(null);

    const localMediaStateRef = useRef(null);
    localMediaStateRef.current = onLocalMediaState;

    useEffect(() => {
        remoteChangedRef.current = onRemoteParticipantsChanged;
    }, [onRemoteParticipantsChanged]);

    useEffect(() => {
        localStreamChangedRef.current = onLocalStream;
    }, [onLocalStream]);

    // mounted guard
    const mountedRef = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => (mountedRef.current = false);
    }, []);

    // ===== Janus refs =====
    const janusRef = useRef(null);
    const pluginRef = useRef(null);
    const localStreamRef = useRef(null);
    const initedRef = useRef(false);
    const privateIdRef = useRef(null);

    // offer/negotiation lock (중복 createOffer 방지)
    const negotiatingRef = useRef(false);
    const pendingPublishRef = useRef(null);
    const publishFnRef = useRef(null);

    // subscriber / remote feeds: feedId -> { handle, feedId, display, stream }
    const remoteFeedsRef = useRef({});

    const publishedRef = useRef(false);
    const wantVideoRef = useRef(true);

    const finalizedRef = useRef(false);
    const lastConfiguredRef = useRef({ audio: null, video: null });

    // reinject loop guard
    const reinjectCooldownRef = useRef(0);
    const awaitingDeviceReturnRef = useRef(false);
    const deviceRetryTimerRef = useRef(null);
    const reinjectBlockedRef = useRef(false);

    // ===== React state =====
    const [isSupported, setIsSupported] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [isVideoDeviceLost, setIsVideoDeviceLost] = useState(false);

    // 장치가 아예 없는지(마이크/카메라 둘 다 없음)
    const [noMediaDevices, setNoMediaDevices] = useState(false);

    const audioEnabledRef = useRef(true);
    const videoEnabledRef = useRef(true);
    const isConnectedRef = useRef(false);

    useEffect(() => {
        audioEnabledRef.current = audioEnabled;
    }, [audioEnabled]);

    useEffect(() => {
        videoEnabledRef.current = videoEnabled;
    }, [videoEnabled]);

    useEffect(() => {
        isConnectedRef.current = isConnected;
    }, [isConnected]);

    // ===== helpers =====
    function hasLiveTrack(stream, kind) {
        if (!stream) return false;
        const tracks =
            kind === "video"
                ? stream.getVideoTracks?.()
                : stream.getAudioTracks?.();
        return (
            Array.isArray(tracks) && tracks.some((t) => t.readyState === "live")
        );
    }

    // 장치 탐지(초기 1회)
    useEffect(() => {
        const md = navigator.mediaDevices;
        if (!md?.enumerateDevices) return;

        md.enumerateDevices()
            .then((devices) => {
                const hasAudio = devices.some((d) => d.kind === "audioinput");
                const hasVideo = devices.some((d) => d.kind === "videoinput");
                setNoMediaDevices(!hasAudio && !hasVideo);
            })
            .catch(() => {});
    }, []);

    // "현재 내 상태를 외부로 알리는" helper
    const emitLocalMediaState = useCallback(() => {
        const fn = localMediaStateRef.current;
        if (typeof fn !== "function") return;

        const wantAudio = !!audioEnabledRef.current;
        const wantVideo = !!videoEnabledRef.current;

        const s = localStreamRef.current;
        const liveAudio = hasLiveTrack(s, "audio");
        const liveVideo = hasLiveTrack(s, "video");

        const videoLostForSignal =
            !!isVideoDeviceLost ||
            (!!wantVideo && (!liveVideo || noMediaDevices));

        fn({
            audio: wantAudio,
            video: wantVideo,
            videoDeviceLost: videoLostForSignal,
            noMediaDevices: !!noMediaDevices,
            liveAudio,
            liveVideo,
        });
    }, [noMediaDevices, isVideoDeviceLost]);

    const lockNegotiation = () => {
        if (negotiatingRef.current) return false;
        negotiatingRef.current = true;
        return true;
    };

    const runPublishQueued = useCallback(() => {
        const pending = pendingPublishRef.current;
        if (!pending) return;
        pendingPublishRef.current = null;
        publishFnRef.current?.(!!pending.audio, !!pending.video);
    }, []);

    const unlockNegotiation = useCallback(() => {
        negotiatingRef.current = false;
        runPublishQueued();
    }, [runPublishQueued]);

    // ===== notify remotes debounce =====
    const notifyTimerRef = useRef(null);

    const flushRemoteParticipantsChanged = useCallback(() => {
        notifyTimerRef.current = null;

        const fn = remoteChangedRef.current;
        if (typeof fn !== "function") return;

        const list = Object.values(remoteFeedsRef.current || {}).map(
            (info) => ({
                id: info.feedId,
                display: info.display,
                stream: info.stream || null,
                videoDead: !info.stream,
            })
        );

        try {
            fn(list);
        } catch (e) {
            console.error(
                "[useJanusLocalOnly] onRemoteParticipantsChanged error",
                e
            );
        }
    }, []);

    const notifyRemoteParticipantsChanged = useCallback(() => {
        if (notifyTimerRef.current) return;
        notifyTimerRef.current = window.setTimeout(
            flushRemoteParticipantsChanged,
            80
        );
    }, [flushRemoteParticipantsChanged]);

    const notifyLocalStreamChanged = useCallback((stream) => {
        const fn = localStreamChangedRef.current;
        if (typeof fn !== "function") return;
        try {
            fn(stream);
        } catch (e) {
            console.error("[useJanusLocalOnly] onLocalStream error", e);
        }
    }, []);

    const setLocalStreamSafe = useCallback(
        (stream) => {
            localStreamRef.current = stream || null;
            notifyLocalStreamChanged(stream || null);

            if (!stream) {
                emitLocalMediaState();
                return;
            }

            stream.getVideoTracks?.().forEach((track) => {
                track.onended = () => {
                    if (!mountedRef.current) return;

                    if (!videoEnabledRef.current) return;
                    if (reinjectBlockedRef.current) return;
                    reinjectBlockedRef.current = true;

                    setIsVideoDeviceLost(true);

                    //  트랙 죽었음: "딜레이 후 1회"만 시도하고 멈춤
                    awaitingDeviceReturnRef.current = true;

                    // 이미 타이머 있으면 중복 예약 방지
                    if (deviceRetryTimerRef.current) return;

                    deviceRetryTimerRef.current = window.setTimeout(() => {
                        deviceRetryTimerRef.current = null;
                        reinjectIfPossible?.({ source: "track-dead" });
                    }, 2500);
                };
                if (track.oninactive === null) track.oninactive = track.onended;
            });

            emitLocalMediaState();
        },
        [notifyLocalStreamChanged, emitLocalMediaState]
    );

    // ===== remote feed detach/reset =====
    const detachRemoteFeed = useCallback(
        (feedId, { skipHandleCleanup = false, silent = false } = {}) => {
            const feedInfo = remoteFeedsRef.current[feedId];
            if (!feedInfo) return;

            if (!skipHandleCleanup) {
                try {
                    feedInfo.handle?.hangup?.();
                    feedInfo.handle?.detach?.();
                } catch (e) {
                    console.warn(
                        "[subscriber] detachRemoteFeed cleanup error",
                        e
                    );
                }
            }

            delete remoteFeedsRef.current[feedId];
            if (!silent) notifyRemoteParticipantsChanged();
        },
        [notifyRemoteParticipantsChanged]
    );

    const resetAllRemoteFeeds = useCallback(
        ({ silent = false } = {}) => {
            const ids = Object.keys(remoteFeedsRef.current);
            ids.forEach((feedId) => detachRemoteFeed(feedId, { silent: true }));
            remoteFeedsRef.current = {};
            if (!silent) notifyRemoteParticipantsChanged();
        },
        [detachRemoteFeed, notifyRemoteParticipantsChanged]
    );

    // ===== finalize =====
    const finalize = useCallback(
        (reason = "unknown") => {
            if (finalizedRef.current) return;
            finalizedRef.current = true;

            // negotiation state reset
            negotiatingRef.current = false;
            pendingPublishRef.current = null;

            // timer
            if (notifyTimerRef.current) {
                window.clearTimeout(notifyTimerRef.current);
                notifyTimerRef.current = null;
            }

            if (deviceRetryTimerRef.current) {
                window.clearTimeout(deviceRetryTimerRef.current);
                deviceRetryTimerRef.current = null;
            }
            // remote feeds
            resetAllRemoteFeeds({ silent: true });
            notifyRemoteParticipantsChanged();

            // local tracks stop
            try {
                localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
            } catch {}

            setLocalStreamSafe(null);

            privateIdRef.current = null;

            try {
                pluginRef.current?.hangup?.();
            } catch {}
            pluginRef.current = null;

            janusRef.current = null;

            lastConfiguredRef.current = { audio: null, video: null };
            publishedRef.current = false;
            wantVideoRef.current = true;

            // reinject guards
            reinjectBlockedRef.current = false;
            reinjectCooldownRef.current = 0;

            setIsConnecting(false);
            setIsConnected(false);
            isConnectedRef.current = false;

            // UI state
            setAudioEnabled(true);
            setVideoEnabled(true);
            audioEnabledRef.current = true;
            videoEnabledRef.current = true;

            setIsVideoDeviceLost(false);
            setError(null);
        },
        [
            notifyRemoteParticipantsChanged,
            resetAllRemoteFeeds,
            setLocalStreamSafe,
        ]
    );

    // ===== publish/republish =====
    const republishSafe = useCallback(
        (useAudio, useVideo, attempt = 0) => {
            const Janus = window.Janus;
            const handle = pluginRef.current;
            if (!Janus || !handle) return;

            if (!lockNegotiation()) {
                pendingPublishRef.current = {
                    audio: !!useAudio,
                    video: !!useVideo,
                };
                return;
            }

            const prev = lastConfiguredRef.current || {
                audio: null,
                video: null,
            };
            const replaceAudio = prev.audio !== useAudio;
            const replaceVideo = prev.video !== useVideo;

            handle.createOffer({
                media: {
                    audioRecv: false,
                    videoRecv: false,
                    audioSend: !!useAudio,
                    videoSend: !!useVideo,
                    replaceAudio,
                    replaceVideo,
                },
                success: (jsep) => {
                    try {
                        handle.send({
                            message: {
                                request: "configure",
                                audio: !!useAudio,
                                video: !!useVideo,
                            },
                            jsep,
                        });

                        lastConfiguredRef.current = {
                            audio: !!useAudio,
                            video: !!useVideo,
                        };

                        // 여기서는 "미디어 재구성 성공" 의미로 상태만 보강
                        setIsConnecting(false);
                        if (useVideo) setIsVideoDeviceLost(false);

                        const latest =
                            handle?.webrtcStuff?.myStream ||
                            handle?.webrtcStuff?.stream ||
                            null;
                        if (latest) setLocalStreamSafe(latest);

                        emitLocalMediaState();
                    } finally {
                        unlockNegotiation();
                    }
                },
                error: (err) => {
                    console.error(
                        "[useJanusLocalOnly] republishSafe error:",
                        err
                    );

                    const isPermissionDenied =
                        err?.name === "NotAllowedError" ||
                        err?.name === "PermissionDeniedError" ||
                        String(err?.message || "")
                            .toLowerCase()
                            .includes("permission");

                    unlockNegotiation();

                    if (isPermissionDenied) {
                        setIsConnecting(false);
                        return;
                    }

                    if (attempt >= 1) {
                        if (useVideo) setIsVideoDeviceLost(true);
                        setIsConnecting(false);
                        return;
                    }

                    if (useVideo) {
                        setIsVideoDeviceLost(true);
                        return republishSafe(useAudio, false, attempt + 1);
                    }
                    if (useAudio)
                        return republishSafe(false, false, attempt + 1);

                    setIsConnecting(false);
                },
            });
        },
        [setLocalStreamSafe, emitLocalMediaState, unlockNegotiation]
    );

    const publishLocalStream = useCallback(
        (useAudio = true, useVideo = true) => {
            const Janus = window.Janus;
            const handle = pluginRef.current;
            if (!Janus || !handle) return;

            wantVideoRef.current = !!useVideo;

            // 이미 publish 성공했으면 republish
            if (publishedRef.current || isConnectedRef.current) {
                return republishSafe(!!useAudio, !!useVideo, 0);
            }

            // 둘 다 false면 configure만
            if (!useAudio && !useVideo) {
                try {
                    handle.send({
                        message: {
                            request: "configure",
                            audio: false,
                            video: false,
                        },
                    });
                    publishedRef.current = true;
                    setIsConnecting(false);
                    emitLocalMediaState();
                } catch (e) {
                    setError("미디어 없이 참가 처리 중 오류가 발생했습니다.");
                    setIsConnecting(false);
                }
                return;
            }

            if (!lockNegotiation()) {
                pendingPublishRef.current = {
                    audio: !!useAudio,
                    video: !!useVideo,
                };
                return;
            }

            handle.createOffer({
                media: {
                    audioRecv: false,
                    videoRecv: false,
                    audioSend: !!useAudio,
                    videoSend: !!useVideo,
                },
                success: (jsep) => {
                    try {
                        handle.send({
                            message: {
                                request: "configure",
                                audio: !!useAudio,
                                video: !!useVideo,
                            },
                            jsep,
                        });

                        publishedRef.current = true;
                        setIsConnecting(false);

                        lastConfiguredRef.current = {
                            audio: !!useAudio,
                            video: !!useVideo,
                        };

                        if (useVideo) setIsVideoDeviceLost(false);

                        const latest =
                            handle?.webrtcStuff?.myStream ||
                            handle?.webrtcStuff?.stream ||
                            null;
                        if (latest) setLocalStreamSafe(latest);

                        emitLocalMediaState();
                    } finally {
                        unlockNegotiation();
                    }
                },
                error: (err) => {
                    console.error(
                        "[useJanusLocalOnly] createOffer error:",
                        err
                    );

                    const isPermissionDenied =
                        err?.name === "NotAllowedError" ||
                        err?.name === "PermissionDeniedError" ||
                        String(err?.message || "")
                            .toLowerCase()
                            .includes("permission");

                    unlockNegotiation();

                    if (isPermissionDenied) {
                        setIsConnecting(false);
                        return;
                    }

                    if (useVideo) {
                        setIsVideoDeviceLost(true);
                        return publishLocalStream(useAudio, false);
                    }
                    if (useAudio) {
                        setAudioEnabled(false);
                        audioEnabledRef.current = false;
                        return publishLocalStream(false, false);
                    }

                    setIsConnecting(false);
                },
            });
        },
        [
            republishSafe,
            setLocalStreamSafe,
            emitLocalMediaState,
            unlockNegotiation,
        ]
    );

    useEffect(() => {
        publishFnRef.current = publishLocalStream;
    }, [publishLocalStream]);

    // ===== remote feed attach =====
    const newRemoteFeed = useCallback(
        (feedId, display, roomNumber) => {
            const Janus = window.Janus;
            if (!Janus || !janusRef.current) return;
            if (remoteFeedsRef.current[feedId]) return;

            janusRef.current.attach({
                plugin: "janus.plugin.videoroom",

                success: (handle) => {
                    remoteFeedsRef.current[feedId] = {
                        handle,
                        feedId,
                        display,
                        stream: null,
                    };

                    const subscribe = {
                        request: "join",
                        room: Number(roomNumber),
                        ptype: "subscriber",
                        feed: feedId,
                    };
                    if (privateIdRef.current)
                        subscribe.private_id = privateIdRef.current;

                    handle.send({ message: subscribe });
                    notifyRemoteParticipantsChanged();
                },

                error: (err) => {
                    console.error("[subscriber] attach error:", err);
                },

                onmessage: (msg, jsep) => {
                    if (!jsep) return;

                    const feedInfo = remoteFeedsRef.current[feedId];
                    const handle = feedInfo?.handle;
                    if (!handle) return;

                    handle.createAnswer({
                        jsep,
                        media: { audioSend: false, videoSend: false },
                        success: (jsepAnswer) => {
                            handle.send({
                                message: {
                                    request: "start",
                                    room: Number(roomNumber),
                                },
                                jsep: jsepAnswer,
                            });
                        },
                        error: (err) => {
                            console.error(
                                "[subscriber] createAnswer error:",
                                err
                            );
                        },
                    });
                },

                onremotestream: (stream) => {
                    const prev = remoteFeedsRef.current[feedId];
                    if (!prev) return;
                    remoteFeedsRef.current[feedId] = { ...prev, stream };
                    notifyRemoteParticipantsChanged();
                },

                oncleanup: () => {
                    detachRemoteFeed(feedId, { skipHandleCleanup: true });
                },
            });
        },
        [detachRemoteFeed, notifyRemoteParticipantsChanged]
    );

    // ===== create session & attach publisher =====
    const createSessionAndAttach = useCallback(
        ({ roomNumber, displayName }) => {
            const Janus = window.Janus;
            if (!Janus) return;

            finalizedRef.current = false;
            publishedRef.current = false;

            const janus = new Janus({
                server: serverUrl,

                success: () => {
                    if (!mountedRef.current) {
                        try {
                            janus.destroy();
                        } catch {}
                        return;
                    }

                    janusRef.current = janus;

                    janus.attach({
                        plugin: "janus.plugin.videoroom",

                        success: (handle) => {
                            pluginRef.current = handle;
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
                            console.error("[publisher] attach error:", err);
                            setError(
                                "videoroom attach 중 에러가 발생했습니다."
                            );
                            setIsConnecting(false);
                        },

                        onmessage: (msg, jsep) => {
                            const data = msg?.plugindata?.data || msg || {};
                            const event = data.videoroom;
                            const errorCode = data.error_code;

                            // 방 없으면(426) 만들고 join
                            if (event === "event" && errorCode === 426) {
                                const createBody = {
                                    request: "create",
                                    room: Number(roomNumber),
                                    publishers: 10,
                                    bitrate: 512000,
                                };

                                pluginRef.current?.send({
                                    message: createBody,
                                    success: (result) => {
                                        const d =
                                            result?.plugindata?.data ||
                                            result ||
                                            {};
                                        if (d.videoroom === "created") {
                                            pluginRef.current?.send({
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
                                        setError(
                                            "회의 방 생성 중 오류가 발생했습니다."
                                        );
                                        setIsConnecting(false);
                                    },
                                });
                                return;
                            }

                            // ✅ 핵심: "joined"를 연결 성공으로 본다 (publish 성공 여부와 분리)
                            if (event === "joined") {
                                privateIdRef.current = data.private_id;

                                setIsConnected(true);
                                setIsConnecting(false);
                                isConnectedRef.current = true;

                                // 초기 publish: 현재 상태에 맞춰 진행
                                publishLocalStream(
                                    audioEnabledRef.current,
                                    videoEnabledRef.current
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
                                    setError("회의 방이 종료되었습니다.");
                                    try {
                                        janusRef.current?.destroy();
                                    } catch {}
                                    return;
                                }
                            }

                            if (jsep && pluginRef.current) {
                                pluginRef.current.handleRemoteJsep({ jsep });
                            }
                        },

                        onlocalstream: (stream) => {
                            setLocalStreamSafe(stream);
                        },

                        oncleanup: () => {
                            // publisher cleanup (필요하면 로그만)
                        },
                    });
                },

                error: (err) => {
                    console.error("[useJanusLocalOnly] Janus error:", err);
                    setError("Janus 세션 생성 중 에러가 발생했습니다.");
                    setIsConnecting(false);
                },

                destroyed: () => {
                    finalize("janus.destroyed");
                },
            });
        },
        [
            serverUrl,
            detachRemoteFeed,
            finalize,
            newRemoteFeed,
            notifyRemoteParticipantsChanged,
            publishLocalStream,
            setLocalStreamSafe,
        ]
    );

    // ===== toggles =====
    const toggleAudio = useCallback(() => {
        // 장치 없음이면 상태만 토글
        if (noMediaDevices) {
            const nextAudio = !audioEnabledRef.current;
            setAudioEnabled(nextAudio);
            audioEnabledRef.current = nextAudio;
            emitLocalMediaState();
            reinjectBlockedRef.current = false;
            return;
        }

        const nextAudio = !audioEnabledRef.current;
        setAudioEnabled(nextAudio);
        audioEnabledRef.current = nextAudio;

        emitLocalMediaState();

        if (!pluginRef.current || !isConnectedRef.current) return;
        publishLocalStream(nextAudio, videoEnabledRef.current);
    }, [publishLocalStream, noMediaDevices, emitLocalMediaState]);

    const toggleVideo = useCallback(() => {
        // 장치 없음이면 상태만 토글
        if (noMediaDevices) {
            const nextVideo = !videoEnabledRef.current;
            setVideoEnabled(nextVideo);
            videoEnabledRef.current = nextVideo;
            if (nextVideo) {
                setIsVideoDeviceLost(false);
                reinjectBlockedRef.current = false;
            }

            emitLocalMediaState();

            if (!nextVideo) reinjectBlockedRef.current = false;
            return;
        }

        const nextVideo = !videoEnabledRef.current;

        if (!nextVideo) reinjectBlockedRef.current = false;
        wantVideoRef.current = nextVideo;
        if (nextVideo) setIsVideoDeviceLost(false);

        setVideoEnabled(nextVideo);
        videoEnabledRef.current = nextVideo;

        emitLocalMediaState();

        if (!pluginRef.current || !isConnectedRef.current) return;
        publishLocalStream(audioEnabledRef.current, nextVideo);
    }, [publishLocalStream, noMediaDevices, emitLocalMediaState]);

    // ===== joinRoom =====
    const joinRoom = useCallback(
        ({ roomNumber, displayName }) => {
            const Janus = window.Janus;

            if (!Janus) {
                setError("Janus 라이브러리가 아직 로드되지 않았습니다.");
                return;
            }

            if (!Janus.isWebrtcSupported()) {
                setIsSupported(false);
                setError("이 브라우저는 WebRTC를 지원하지 않습니다.");
                return;
            }

            if (isConnecting || isConnected) return;

            resetAllRemoteFeeds({ silent: true });
            notifyRemoteParticipantsChanged();

            setError(null);
            setIsConnecting(true);

            const start = () => {
                if (!mountedRef.current) {
                    setIsConnecting(false);
                    return;
                }

                finalizedRef.current = false;
                publishedRef.current = false;

                if (!initedRef.current) {
                    Janus.init({
                        debug: "all",
                        callback: () => {
                            initedRef.current = true;
                            createSessionAndAttach({ roomNumber, displayName });
                        },
                    });
                } else {
                    createSessionAndAttach({ roomNumber, displayName });
                }
            };

            start();
        },
        [
            isConnecting,
            isConnected,
            resetAllRemoteFeeds,
            notifyRemoteParticipantsChanged,
            createSessionAndAttach,
        ]
    );

    // ===== leaveRoom =====
    const leaveRoom = useCallback(() => {
        if (finalizedRef.current) return;

        const janus = janusRef.current;
        const plugin = pluginRef.current;

        try {
            plugin?.send?.({ message: { request: "leave" } });
        } catch {}

        if (janus) {
            try {
                janus.destroy();
                return;
            } catch (e) {
                console.warn("[useJanusLocalOnly] janus.destroy error", e);
            }
        }

        finalize("leaveRoom.noJanus");
    }, [finalize]);

    useEffect(() => {
        return () => {
            leaveRoom();
        };
    }, [leaveRoom]);

    const reinjectIfPossible = useCallback(
        async ({ source } = {}) => {
            if (!isConnectedRef.current || !pluginRef.current) return;
            // "복귀 대기(awaiting)" 상태일 때만 reinject 허용
            // (ping 등에서 불필요한 반복 재협상 방지)
            if (
                !awaitingDeviceReturnRef.current &&
                source !== "track-dead" &&
                source !== "devicechange"
            ) {
                return;
            }

            //track-dead 이후 잠금 상태면 devicechange 전까지 재시도 금지
            if (reinjectBlockedRef.current && source !== "devicechange") {
                return;
            }
            const wantAudio = !!audioEnabledRef.current;
            const wantVideo = !!videoEnabledRef.current;
            if (!wantAudio && !wantVideo) return;

            const md = navigator.mediaDevices;
            if (!md?.enumerateDevices) return;

            const devices = await md.enumerateDevices().catch(() => null);
            if (!devices) return;

            const hasAudioDev = devices.some((d) => d.kind === "audioinput");
            const hasVideoDev = devices.some((d) => d.kind === "videoinput");

            // ✅ 장치가 아예 없으면: "아무것도 하지 않음" (시도 자체 금지)
            if (!hasAudioDev && !hasVideoDev) {
                setNoMediaDevices(true);
                emitLocalMediaState();
                // track-dead 이후라면 계속 "복귀 대기" 상태 유지
                awaitingDeviceReturnRef.current = true;
                return;
            }

            setNoMediaDevices(false);

            //  쿨타임(15초)
            const now = Date.now();
            if (now - reinjectCooldownRef.current < 15000) return;

            // ✅ 트랙이 진짜 죽었는지 확인
            const s = localStreamRef.current;
            const needAudio = wantAudio && !hasLiveTrack(s, "audio");
            const needVideo = wantVideo && !hasLiveTrack(s, "video");
            if (!needAudio && !needVideo) {
                // 이미 살아났으면 대기 해제
                awaitingDeviceReturnRef.current = false;
                return;
            }

            // ✅ 이번 시도 기록 (쿨타임 시작)
            reinjectCooldownRef.current = now;

            const nextAudio = wantAudio && hasAudioDev;
            const nextVideo = wantVideo && hasVideoDev;

            publishLocalStream(nextAudio, nextVideo);
            emitLocalMediaState();

            // ✅ track-dead로 들어온 재시도는 "1번으로 종료"
            if (source === "track-dead") {
                // 이후는 devicechange에서만 다시 시도
                awaitingDeviceReturnRef.current = true;
                return;
            }

            // devicechange로 들어온 시도는 성공/실패와 무관하게 1회로 끝
            awaitingDeviceReturnRef.current = false;
        },
        [publishLocalStream, emitLocalMediaState]
    );

    // 장치 변경 시 즉시 reinject 트리거
    useEffect(() => {
        const md = navigator.mediaDevices;
        if (!md?.addEventListener) return;

        const onDeviceChange = () => {
            //  트랙 죽어서 복귀 기다리는 중이 아니면 아무것도 안 함
            if (!awaitingDeviceReturnRef.current) return;
            reinjectBlockedRef.current = false;

            // 중복 예약 방지
            if (deviceRetryTimerRef.current) {
                window.clearTimeout(deviceRetryTimerRef.current);
                deviceRetryTimerRef.current = null;
            }

            deviceRetryTimerRef.current = window.setTimeout(() => {
                deviceRetryTimerRef.current = null;
                reinjectIfPossible?.({ source: "devicechange" });
            }, 2500);
        };

        md.addEventListener("devicechange", onDeviceChange);
        return () => {
            md.removeEventListener("devicechange", onDeviceChange);
            if (deviceRetryTimerRef.current) {
                window.clearTimeout(deviceRetryTimerRef.current);
                deviceRetryTimerRef.current = null;
            }
        };
    }, [reinjectIfPossible]);

    // 상태 변화 시 외부 싱크
    useEffect(() => {
        emitLocalMediaState();
    }, [isVideoDeviceLost, emitLocalMediaState]);

    useEffect(() => {
        emitLocalMediaState();
    }, [noMediaDevices, emitLocalMediaState]);

    return {
        isSupported,
        isConnecting,
        isConnected,
        error,

        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        noMediaDevices,

        toggleAudio,
        toggleVideo,
        joinRoom,
        leaveRoom,
        reinjectIfPossible,
    };
}
