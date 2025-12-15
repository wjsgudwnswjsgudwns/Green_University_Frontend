// src/hooks/useJanusLocalOnly.js
import { useCallback, useEffect, useRef, useState } from "react";

export function useJanusLocalOnly(
    serverUrl = "https://janus.jsflux.co.kr/janus",
    options = {}
) {
    const { onRemoteParticipantsChanged, onLocalStream } = options || {};

    const remoteChangedRef = useRef(null);
    const localStreamChangedRef = useRef(null);

    // 훅 존재 여부
    const mountedRef = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        remoteChangedRef.current = onRemoteParticipantsChanged;
    }, [onRemoteParticipantsChanged]);

    useEffect(() => {
        localStreamChangedRef.current = onLocalStream;
    }, [onLocalStream]);

    // ========== Janus 내부 객체 ==========
    const janusRef = useRef(null); // Janus 세션
    const pluginRef = useRef(null); // videoroom 플러그인 핸들
    const localStreamRef = useRef(null); // 내 카메라/마이크 스트림
    const initedRef = useRef(false); // Janus.init 했는지
    const privateIdRef = useRef(null); // publisher joined 시 받은 private_id

    // subscriber / remote feed 관리: feedId -> { handle, feedId, display, stream }
    const remoteFeedsRef = useRef({});

    const cameraLostRef = useRef(false);

    // ========== 참가자 이벤트 콜백 ==========
    const notifyRemoteParticipantsChanged = useCallback(() => {
        const fn = remoteChangedRef.current;
        if (typeof fn === "function") {
            const list = Object.values(remoteFeedsRef.current || {}).map(
                (info) => ({
                    id: info.feedId,
                    display: info.display,
                    stream: info.stream || null,
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
        }
    }, []);

    const notifyLocalStreamChanged = useCallback((stream) => {
        const fn = localStreamChangedRef.current;
        if (typeof fn === "function") {
            try {
                fn(stream);
            } catch (e) {
                console.error("[useJanusLocalOnly] onLocalStream error", e);
            }
        }
    }, []);

    const setLocalStreamSafe = useCallback(
        (stream) => {
            // ref & 상위 콜백 동기화
            localStreamRef.current = stream || null;
            notifyLocalStreamChanged(stream || null);

            // 새 스트림이 들어왔으면 "카메라 복구됨"
            if (stream) {
                cameraLostRef.current = false;
            }

            // 스트림이 없으면 더 할 일 없음 (초기화 상황)
            if (!stream) return;

            // 비디오 트랙에 강제 종료 이벤트 핸들러 달기
            stream.getVideoTracks().forEach((track) => {
                track.onended = () => {
                    console.log(
                        "[useJanusLocalOnly] local video track ended (device unplugged?)"
                    );
                    if (!mountedRef.current) return;

                    cameraLostRef.current = true;

                    // 1) 내부 ref/상태 정리
                    localStreamRef.current = null;
                    notifyLocalStreamChanged(null);
                };

                // 브라우저마다 oninactive만 타는 경우 대비해서 같이 묶어줌
                if (track.oninactive === null) {
                    track.oninactive = track.onended;
                }
            });
        },
        [notifyLocalStreamChanged]
    );

    // ========== React 상태 (UI) ==========
    const [isSupported, setIsSupported] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);

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

    // ========== remote feed 정리 ==========
    const detachRemoteFeed = useCallback(
        (feedId, { skipHandleCleanup = false } = {}) => {
            const feedInfo = remoteFeedsRef.current[feedId];
            if (!feedInfo) return;

            console.log("[subscriber] detachRemoteFeed:", feedId);

            if (!skipHandleCleanup) {
                try {
                    feedInfo.handle?.hangup?.();
                    feedInfo.handle?.detach?.();
                } catch (e) {
                    console.warn(
                        "[subscriber] detachRemoteFeed handle cleanup error",
                        e
                    );
                }
            }

            delete remoteFeedsRef.current[feedId];
            notifyRemoteParticipantsChanged();
        },
        [notifyRemoteParticipantsChanged]
    );

    const resetAllRemoteFeeds = useCallback(() => {
        console.log("[useJanusLocalOnly] resetAllRemoteFeeds");

        Object.keys(remoteFeedsRef.current).forEach((feedId) => {
            detachRemoteFeed(feedId);
        });

        remoteFeedsRef.current = {};
        notifyRemoteParticipantsChanged();
    }, [detachRemoteFeed, notifyRemoteParticipantsChanged]);

    // ========== 공통 정리 로직 ==========
    const cleanup = useCallback(
        (fromJanus = false) => {
            console.log("[useJanusLocalOnly] cleanup, fromJanus =", fromJanus);

            // remote feeds
            resetAllRemoteFeeds();

            // local stream 정리
            try {
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => t.stop());
                }
            } catch (e) {
                console.warn("local stream cleanup error", e);
            }
            setLocalStreamSafe(null);
            cameraLostRef.current = false;

            privateIdRef.current = null;

            // 플러그인 / 세션 정리
            try {
                if (pluginRef.current) {
                    pluginRef.current.hangup();
                }
            } catch (e) {
                console.warn("plugin hangup error", e);
            }

            try {
                if (janusRef.current && !fromJanus) {
                    janusRef.current.destroy();
                }
            } catch (e) {
                console.warn("janus destroy error", e);
            }

            janusRef.current = null;
            pluginRef.current = null;

            setIsConnecting(false);
            setIsConnected(false);
            isConnectedRef.current = false;
        },
        [resetAllRemoteFeeds, setLocalStreamSafe]
    );

    // ========== publishLocalStream ==========
    const publishLocalStream = useCallback(
        (useAudio = true, useVideo = true) => {
            const Janus = window.Janus;
            const handle = pluginRef.current;
            if (!Janus || !handle) return;

            console.log(
                "[useJanusLocalOnly] publishLocalStream, audio =",
                useAudio,
                ", video =",
                useVideo
            );

            handle.createOffer({
                media: {
                    audioRecv: false,
                    videoRecv: false,
                    audioSend: useAudio,
                    videoSend: useVideo,
                },
                success: (jsep) => {
                    const body = {
                        request: "configure",
                        audio: useAudio,
                        video: useVideo,
                    };
                    handle.send({ message: body, jsep });
                    setIsConnected(true);
                    setIsConnecting(false);
                    setAudioEnabled(useAudio);
                    setVideoEnabled(useVideo);
                },
                error: (err) => {
                    console.error("createOffer error:", err);
                    if (useAudio) {
                        // 오디오 문제면 audio 끄고 재시도
                        publishLocalStream(false, useVideo);
                    } else {
                        setError("로컬 미디어 설정 중 에러가 발생했습니다.");
                        setIsConnecting(false);
                    }
                },
            });
        },
        []
    );

    useEffect(() => {
        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.addEventListener
        ) {
            console.log(
                "[useJanusLocalOnly] mediaDevices.addEventListener 없음"
            );
            return;
        }

        const handleDeviceChange = () => {
            console.log("[useJanusLocalOnly] devicechange fired", {
                cameraLost: cameraLostRef.current,
                isConnected: isConnectedRef.current,
                hasPlugin: !!pluginRef.current,
            });

            // 카메라가 끊어진 상태가 아니면 무시
            if (!cameraLostRef.current) return;

            // 회의에 붙어 있지 않으면 무시
            if (!isConnectedRef.current) return;
            if (!pluginRef.current) return;

            //  유저가 이미 카메라를 OFF로 끈 상태면, 자동 복구/재협상 자체를 스킵
            if (!videoEnabledRef.current) {
                console.log(
                    "[useJanusLocalOnly] camera was OFF by user, skip auto republish"
                );
                // 한 번 처리했다고 표시만 해두고 끝
                cameraLostRef.current = false;
                return;
            }
            console.log(
                "[useJanusLocalOnly] devicechange detected, try to republish video (no hangup)"
            );

            // 한 번 재시도했다고 표시
            cameraLostRef.current = false;

            // 그냥 재협상만 시도 (기존 PeerConnection 유지)
            publishLocalStream(
                audioEnabledRef.current,
                videoEnabledRef.current
            );
        };

        navigator.mediaDevices.addEventListener(
            "devicechange",
            handleDeviceChange
        );

        return () => {
            navigator.mediaDevices.removeEventListener(
                "devicechange",
                handleDeviceChange
            );
        };
    }, [publishLocalStream]);
    // ========== remote feed attach ==========

    const newRemoteFeed = useCallback(
        (feedId, display, roomNumber) => {
            const Janus = window.Janus;
            if (!Janus || !janusRef.current) return;

            // 이미 구독 중이면 무시
            if (remoteFeedsRef.current[feedId]) {
                console.log("[subscriber] already attached for feed", feedId);
                return;
            }

            // 같은 display 가진 기존 feed 정리
            Object.entries(remoteFeedsRef.current).forEach(
                ([oldFeedId, info]) => {
                    if (
                        info.display === display &&
                        String(oldFeedId) !== String(feedId)
                    ) {
                        console.log(
                            "[subscriber] same display, remove old feed:",
                            oldFeedId,
                            "->",
                            feedId,
                            display
                        );
                        detachRemoteFeed(oldFeedId);
                    }
                }
            );

            console.log("[subscriber] attaching new feed:", feedId, display);

            janusRef.current.attach({
                plugin: "janus.plugin.videoroom",

                success: (handle) => {
                    remoteFeedsRef.current[feedId] = {
                        ...(remoteFeedsRef.current[feedId] || {}),
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
                    if (privateIdRef.current) {
                        subscribe.private_id = privateIdRef.current;
                    }

                    handle.send({ message: subscribe });
                    notifyRemoteParticipantsChanged();
                },

                error: (err) => {
                    console.error("[subscriber] attach error:", err);
                },

                onmessage: (msg, jsep) => {
                    console.log("[subscriber] onmessage:", msg);

                    if (jsep) {
                        const feedInfo = remoteFeedsRef.current[feedId];
                        const handle = feedInfo?.handle;
                        if (!handle) return;

                        handle.createAnswer({
                            jsep,
                            media: {
                                audioSend: false,
                                videoSend: false,
                            },
                            success: (jsepAnswer) => {
                                const body = {
                                    request: "start",
                                    room: Number(roomNumber),
                                };
                                handle.send({
                                    message: body,
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
                    }
                },

                onremotestream: (stream) => {
                    console.log(
                        "[subscriber] onremotestream feed",
                        feedId,
                        stream
                    );

                    remoteFeedsRef.current[feedId] = {
                        ...(remoteFeedsRef.current[feedId] || {}),
                        feedId,
                        display,
                        stream,
                    };
                    // 2) remote 비디오 트랙 상태 감시
                    const videoTracks = stream.getVideoTracks
                        ? stream.getVideoTracks()
                        : [];
                    if (videoTracks.length > 0) {
                        const [videoTrack] = videoTracks;

                        // (1) 트랙이 진짜 끊겼을 때 → 이 참가자 화면을 플레이스홀더로 전환
                        videoTrack.onended = () => {
                            console.log(
                                "[subscriber] remote video track ENDED for feed",
                                feedId
                            );
                            const cur = remoteFeedsRef.current[feedId];
                            if (!cur) return;
                            remoteFeedsRef.current[feedId] = {
                                ...cur,
                                stream: null, // 스트림 끊겼다고 표시
                            };
                            notifyRemoteParticipantsChanged();
                        };

                        // (선택) mute/unmute 이벤트도 보고 싶으면
                        videoTrack.onmute = () => {
                            console.log(
                                "[subscriber] remote video track MUTED for feed",
                                feedId
                            );
                        };
                        videoTrack.onunmute = () => {
                            console.log(
                                "[subscriber] remote video track UNMUTED for feed",
                                feedId
                            );
                        };
                    }

                    notifyRemoteParticipantsChanged();
                },

                oncleanup: () => {
                    console.log("[subscriber] oncleanup feed", feedId);
                    detachRemoteFeed(feedId, { skipHandleCleanup: true });
                },
            });
        },
        [detachRemoteFeed, notifyRemoteParticipantsChanged]
    );

    // ========== Janus 세션 / 플러그인 ==========
    const createSessionAndAttach = useCallback(
        ({ roomNumber, displayName }) => {
            const Janus = window.Janus;
            if (!Janus) return;

            const janus = new Janus({
                server: serverUrl,

                success: () => {
                    console.log("[useJanusLocalOnly] Janus 세션 생성 성공");

                    if (!mountedRef.current) {
                        console.warn(
                            "[useJanusLocalOnly] unmounted 상태에서 세션 성공 콜백"
                        );
                        janus.destroy({
                            success: () =>
                                console.log(
                                    "[useJanusLocalOnly] orphan janus destroyed (unmounted)"
                                ),
                        });
                        return;
                    }

                    if (!janusRef.current) {
                        console.warn(
                            "[useJanusLocalOnly] 세션 성공 콜백 시점에 janusRef가 null"
                        );
                        janus.destroy({
                            success: () =>
                                console.log(
                                    "[useJanusLocalOnly] orphan janus destroyed (janusRef null)"
                                ),
                        });
                        setIsConnecting(false);
                        return;
                    }

                    janusRef.current.attach({
                        plugin: "janus.plugin.videoroom",

                        success: (handle) => {
                            console.log("[publisher] handle attached");
                            pluginRef.current = handle;

                            const joinMsg = {
                                request: "join",
                                room: Number(roomNumber),
                                ptype: "publisher",
                                display: displayName || "User",
                            };
                            handle.send({ message: joinMsg });
                        },

                        error: (err) => {
                            console.error("publisher attach error:", err);
                            setError(
                                "videoroom attach 중 에러가 발생했습니다."
                            );
                            setIsConnecting(false);
                        },

                        onmessage: (msg, jsep) => {
                            console.log("[publisher] onmessage raw:", msg);

                            const data =
                                (msg.plugindata && msg.plugindata.data) || msg;
                            const event = data["videoroom"];
                            const errorCode = data["error_code"];

                            console.log(
                                "[publisher] videoroom event:",
                                event,
                                "errorCode:",
                                errorCode
                            );

                            // 방이 없으면 create → join
                            if (event === "event" && errorCode === 426) {
                                console.error(
                                    "[publisher] No such room, create room first:",
                                    roomNumber
                                );

                                const createBody = {
                                    request: "create",
                                    room: Number(roomNumber),
                                    publishers: 10,
                                    bitrate: 512000,
                                };
                                if (pluginRef.current) {
                                    pluginRef.current.send({
                                        message: createBody,
                                        success: (result) => {
                                            const data =
                                                (result.plugindata &&
                                                    result.plugindata.data) ||
                                                result ||
                                                {};
                                            console.log(
                                                "[publisher] room create success:",
                                                data
                                            );

                                            if (data.videoroom === "created") {
                                                const newRoom = data.room;
                                                console.log(
                                                    "[publisher] room created:",
                                                    newRoom
                                                );

                                                const joinMsg = {
                                                    request: "join",
                                                    room: newRoom,
                                                    ptype: "publisher",
                                                    display:
                                                        displayName || "User",
                                                };
                                                try {
                                                    pluginRef.current.send({
                                                        message: joinMsg,
                                                    });
                                                } catch (e) {
                                                    console.error(
                                                        "[publisher] send join after create error:",
                                                        e
                                                    );
                                                }
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
                                }
                                return;
                            }

                            if (event === "created") {
                                const newRoom = data["room"];
                                console.log(
                                    "[publisher] room created:",
                                    newRoom
                                );

                                const joinMsg = {
                                    request: "join",
                                    room: newRoom,
                                    ptype: "publisher",
                                    display: displayName || "User",
                                };
                                if (pluginRef.current) {
                                    pluginRef.current.send({
                                        message: joinMsg,
                                    });
                                }
                                return;
                            }

                            if (event === "joined") {
                                console.log(
                                    "[publisher] joined room, publishing local stream"
                                );
                                privateIdRef.current = data["private_id"];

                                publishLocalStream(true);

                                const list = data["publishers"] || [];
                                if (list.length > 0) {
                                    list.slice()
                                        .sort((a, b) => a.id - b.id)
                                        .forEach((p) => {
                                            newRemoteFeed(
                                                p.id,
                                                p.display,
                                                roomNumber
                                            );
                                        });
                                    notifyRemoteParticipantsChanged();
                                }
                            }

                            if (event === "event") {
                                console.log("[publisher] event data:", data);
                                let changed = false;
                                const list = data["publishers"] || [];
                                console.log(
                                    "[publisher] publishers list:",
                                    list
                                );
                                if (list.length > 0) {
                                    list.forEach((p) => {
                                        console.log(
                                            "[publisher] new publisher event:",
                                            p.id,
                                            p.display
                                        );
                                        newRemoteFeed(
                                            p.id,
                                            p.display,
                                            roomNumber
                                        );
                                    });
                                    changed = true;
                                }

                                const leaving = data["leaving"];
                                if (leaving) {
                                    console.log(
                                        "[publisher] publisher leaving:",
                                        leaving
                                    );
                                    detachRemoteFeed(leaving);
                                    changed = true;
                                }

                                const unpublished = data["unpublished"];
                                if (unpublished && unpublished !== "ok") {
                                    console.log(
                                        "[publisher] publisher unpublished:",
                                        unpublished
                                    );
                                    detachRemoteFeed(unpublished);
                                    changed = true;
                                }

                                if (changed) {
                                    notifyRemoteParticipantsChanged();
                                }

                                if (data["error"] === "Room not found") {
                                    console.error(
                                        "[publisher] room not found (destroyed)"
                                    );
                                    setError("회의 방이 종료되었습니다.");
                                    cleanup(false);
                                    return;
                                }
                            }

                            if (jsep && pluginRef.current) {
                                pluginRef.current.handleRemoteJsep({ jsep });
                            }
                        },

                        onlocalstream: (stream) => {
                            console.log("[publisher] onlocalstream", stream);
                            setLocalStreamSafe(stream);
                        },

                        oncleanup: () => {
                            console.log("[publisher] oncleanup");
                        },
                    });
                },

                error: (err) => {
                    console.error("Janus error raw:", err);
                    setError("Janus 세션 생성 중 에러가 발생했습니다.");
                    setIsConnecting(false);
                },

                destroyed: () => {
                    console.log("[useJanusLocalOnly] Janus destroyed");
                    cleanup(true);
                },
            });
            janusRef.current = janus;
        },
        [
            serverUrl,
            cleanup,
            newRemoteFeed,
            notifyRemoteParticipantsChanged,
            publishLocalStream,
            setLocalStreamSafe,
        ]
    );

    // ========== 토글 ==========
    const toggleAudio = useCallback(() => {
        const Janus = window.Janus;
        const handle = pluginRef.current;
        if (!Janus || !handle) return;

        if (!isConnectedRef.current) {
            console.log("[useJanusLocalOnly] 아직 연결 전이라 audio 토글 무시");
            return;
        }

        const nextAudio = !audioEnabledRef.current;
        console.log("[useJanusLocalOnly] toggleAudio ->", nextAudio);

        publishLocalStream(nextAudio, videoEnabledRef.current);

        try {
            if (localStreamRef.current) {
                localStreamRef.current
                    .getAudioTracks()
                    .forEach((t) => (t.enabled = nextAudio));
            }
        } catch (e) {
            console.warn("toggleAudio local track error", e);
        }
    }, [publishLocalStream]);

    const toggleVideo = useCallback(() => {
        const Janus = window.Janus;
        const handle = pluginRef.current;
        if (!Janus || !handle) return;

        if (!isConnectedRef.current) {
            console.log("[useJanusLocalOnly] 아직 연결 전이라 video 토글 무시");
            return;
        }

        const nextVideo = !videoEnabledRef.current;
        console.log("[useJanusLocalOnly] toggleVideo ->", nextVideo);

        publishLocalStream(audioEnabledRef.current, nextVideo);

        try {
            if (localStreamRef.current) {
                localStreamRef.current
                    .getVideoTracks()
                    .forEach((t) => (t.enabled = nextVideo));
            }
        } catch (e) {
            console.warn("toggleVideo local track error", e);
        }
    }, [publishLocalStream]);

    // ========== joinRoom ==========
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

            if (isConnecting || isConnected) {
                console.log("[useJanusLocalOnly] 이미 접속 중/완료 상태");
                return;
            }

            resetAllRemoteFeeds();
            setError(null);
            setIsConnecting(true);

            const start = () => {
                if (!mountedRef.current) {
                    console.log(
                        "[useJanusLocalOnly] unmounted 상태에서 start 호출, 스킵"
                    );
                    setIsConnecting(false);
                    return;
                }
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
        [isConnecting, isConnected, resetAllRemoteFeeds, createSessionAndAttach]
    );

    // ========== leaveRoom / 언마운트 ==========
    const leaveRoom = useCallback(() => {
        console.log("[useJanusLocalOnly] leaveRoom");
        if (
            !janusRef.current &&
            !pluginRef.current &&
            !localStreamRef.current
        ) {
            console.log(
                "[useJanusLocalOnly] 이미 정리된 상태라 leaveRoom 스킵"
            );
            return;
        }
        try {
            if (pluginRef.current) {
                pluginRef.current.send({ message: { request: "leave" } });
            }
        } catch (e) {
            console.warn("leave request error", e);
        }
        cleanup(false);
    }, [cleanup]);

    useEffect(() => {
        return () => {
            leaveRoom();
        };
    }, [leaveRoom]);

    return {
        isSupported,
        isConnecting,
        isConnected,
        error,
        audioEnabled,
        videoEnabled,
        toggleAudio,
        toggleVideo,
        joinRoom,
        leaveRoom,
    };
}
