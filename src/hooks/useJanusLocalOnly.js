import { useCallback, useEffect, useRef, useState } from "react";

const REMOTE_SLOT_IDS = [
    "videoremote1",
    "videoremote2",
    "videoremote3",
    "videoremote4",
    "videoremote5",
    "videoremote6",
];

export function useJanusLocalOnly(
    serverUrl = "https://janus.jsflux.co.kr/janus",
    options = {}
) {
    const { onRemoteParticipantsChanged } = options || {};

    const remoteChangedRef = useRef(null);

    useEffect(() => {
        remoteChangedRef.current = onRemoteParticipantsChanged;
    }, [onRemoteParticipantsChanged]);

    //  이 함수 자체는 한 번만 만들어지고,
    // 내부에서 ref.current를 통해 "최신" 콜백을 호출
    const notifyRemoteParticipantsChanged = useCallback(() => {
        console.log("[useJanusLocalOnly] notifyRemoteParticipantsChanged 호출");
        const fn = remoteChangedRef.current;
        if (typeof fn === "function") {
            try {
                fn();
            } catch (e) {
                console.error(
                    "[useJanusLocalOnly] onRemoteParticipantsChanged error",
                    e
                );
            }
        }
    }, []);

    // ==========  React 상태 (UI 관련) ==========
    const [isSupported, setIsSupported] = useState(true); // 브라우저 지원 여부
    const [isConnecting, setIsConnecting] = useState(false); // 접속 여부
    const [isConnected, setIsConnected] = useState(false); // 방 여부
    const [error, setError] = useState(null); // 에러메세지

    // ========== Janus 내부 객체 ==========
    const janusRef = useRef(null); // Janus 세션
    const pluginRef = useRef(null); // videoroom 플러그인 핸들
    const localStreamRef = useRef(null); // 내 카메라/마이크 스트림
    const initedRef = useRef(false); // Janus.init을 이미 했는지

    // subscriber / remote feed 관리
    // feedId -> { handle, slotId }
    const remoteFeedsRef = useRef({});
    const privateIdRef = useRef(null); // publisher joined 시 받은 private_id

    // ========== 공통 정리 로직 ==========
    // fromJanus === true : Janus.destroy() 이후 콜백에서 호출
    // fromJanus === false: 우리가 직접 정리할 때 호출
    const cleanup = useCallback((fromJanus = false) => {
        console.log("[useJanusLocalOnly] cleanup, fromJanus =", fromJanus);

        // 로컬 미디어 정리
        try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
        } catch (e) {
            console.warn("local stream cleanup error", e);
        }
        // remote feed 정리
        try {
            Object.values(remoteFeedsRef.current).forEach((feedInfo) => {
                try {
                    feedInfo.handle.hangup?.();
                    feedInfo.handle.detach?.();
                } catch (e) {
                    console.warn("remote feed cleanup error", e);
                }
                const container = document.getElementById(feedInfo.slotId);
                if (container) {
                    container.innerHTML = "";
                }
            });
        } catch (e) {
            console.warn("remoteFeeds cleanup error", e);
        }
        remoteFeedsRef.current = {};
        privateIdRef.current = null;

        // 플러그인 / 세션 정리
        try {
            if (pluginRef.current) {
                pluginRef.current.hangup();
            }
        } catch (e) {
            console.warn("plugin hangup error", e);
        }

        // fromJanus=false 일 때만 destroy 호출 (무한루프 방지)
        try {
            if (janusRef.current && !fromJanus) {
                janusRef.current.destroy();
            }
        } catch (e) {
            console.warn("janus destroy error", e);
        }

        // ref / 상태 초기화
        janusRef.current = null;
        pluginRef.current = null;
        localStreamRef.current = null;

        setIsConnecting(false);
        setIsConnected(false);
    }, []);
    // ========== 송출 시작 ==========
    // 세션에 영상, 음성을 보냄
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
                },
                error: (err) => {
                    console.error("createOffer error:", err);
                    // 오디오 문제면 audio 끄고 재시도
                    if (useAudio) {
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
    // ========== remote feed 유틸 ==========
    const getFreeSlotId = () => {
        const used = new Set(
            Object.values(remoteFeedsRef.current).map((f) => f.slotId)
        );
        return REMOTE_SLOT_IDS.find((id) => !used.has(id)) || null;
    };

    const detachRemoteFeed = (feedId) => {
        const feedInfo = remoteFeedsRef.current[feedId];
        if (!feedInfo) return;

        console.log(
            "[subscriber] detachRemoteFeed (DOM only):",
            feedId,
            feedInfo.slotId
        );

        const container = document.getElementById(feedInfo.slotId);
        if (container) {
            container.innerHTML = "";
        }
        delete remoteFeedsRef.current[feedId];

        notifyRemoteParticipantsChanged();
    };

    const newRemoteFeed = (feedId, display, roomNumber) => {
        const Janus = window.Janus;
        if (!Janus || !janusRef.current) return;

        // 이미 구독 중이면 다시 attach 안 함
        if (remoteFeedsRef.current[feedId]) {
            console.log("[subscriber] already attached for feed", feedId);
            return;
        }

        const slotId = getFreeSlotId();
        if (!slotId) {
            console.warn("[subscriber] no free remote slot for feed", feedId);
            return;
        }

        console.log(
            "[subscriber] attaching new feed:",
            feedId,
            "to slot",
            slotId,
            "display:",
            display
        );

        janusRef.current.attach({
            plugin: "janus.plugin.videoroom",

            success: (handle) => {
                // feedId -> { handle, slotId } 저장
                remoteFeedsRef.current[feedId] = { handle, slotId };

                const subscribe = {
                    request: "join",
                    room: Number(roomNumber),
                    ptype: "subscriber",
                    feed: feedId,
                };
                // publisher joined 때 받은 private_id가 있으면 같이 넘김
                if (privateIdRef.current) {
                    subscribe.private_id = privateIdRef.current;
                }

                handle.send({ message: subscribe });
            },

            error: (err) => {
                console.error("[subscriber] attach error:", err);
            },

            onmessage: (msg, jsep) => {
                console.log("[subscriber] onmessage:", msg);

                // subscriber 쪽도 JSEP를 받으므로, 여기서 answer 생성
                if (jsep) {
                    const feedInfo = remoteFeedsRef.current[feedId];
                    const handle = feedInfo?.handle;
                    if (!handle) return;

                    handle.createAnswer({
                        jsep,
                        media: {
                            audioSend: false,
                            videoSend: false, // 우리는 받기만
                        },
                        success: (jsepAnswer) => {
                            const body = {
                                request: "start",
                                room: Number(roomNumber),
                            };
                            handle.send({ message: body, jsep: jsepAnswer });
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
                console.log("[subscriber] onremotestream feed", feedId, stream);

                const container = document.getElementById(slotId);
                if (!container) {
                    console.error(
                        "[subscriber] container not found for slot",
                        slotId
                    );
                    return;
                }

                // 기존 내용 제거 후 비디오 태그 새로 생성
                container.innerHTML = "";
                const video = document.createElement("video");
                video.autoplay = true;
                video.playsInline = true;
                video.muted = false; // remote는 muted 필요 X
                video.style.width = "100%";
                video.style.height = "100%";
                video.style.objectFit = "cover";

                container.appendChild(video);
                Janus.attachMediaStream(video, stream);
            },

            oncleanup: () => {
                console.log("[subscriber] oncleanup feed", feedId);
                // 정리 시 해당 feed도 같이 제거
                detachRemoteFeed(feedId);
            },
        });
    };
    // ========== Janus 세션 플러그인 생성 ==========

    const createSessionAndAttach = useCallback(
        ({ roomNumber, displayName }) => {
            const Janus = window.Janus;
            if (!Janus) return;

            janusRef.current = new Janus({
                server: serverUrl,

                // 세션 생성 성공
                success: () => {
                    console.log("[useJanusLocalOnly] Janus 세션 생성 성공");

                    if (!janusRef.current) {
                        console.warn(
                            "[useJanusLocalOnly] 세션 성공 콜백 시점에 janusRef가 null (이미 정리된 상태)"
                        );
                        setIsConnecting(false);
                        return;
                    }

                    // 핸들 연결
                    janusRef.current.attach({
                        plugin: "janus.plugin.videoroom",

                        // 핸들 연결 성공
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

                        // 핸들연결 실패
                        error: (err) => {
                            console.error("publisher attach error:", err);
                            setError(
                                "videoroom attach 중 에러가 발생했습니다."
                            );
                            setIsConnecting(false);
                        },

                        // Janus에서 오는 이벤트
                        // joined, event, destroyed중 joined만 사용
                        onmessage: (msg, jsep) => {
                            console.log("[publisher] onmessage raw:", msg);

                            // videoroom 플러그인의 실제 데이터 부분만 뽑기
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

                            if (event === "event" && errorCode === 426) {
                                console.error(
                                    "[publisher] No such room, create room first:",
                                    roomNumber
                                );

                                const createBody = {
                                    request: "create",
                                    room: Number(roomNumber), // 백엔드에서 준 번호 그대로 사용
                                    publishers: 10,
                                    bitrate: 512000,
                                };
                                if (pluginRef.current) {
                                    pluginRef.current.send({
                                        message: createBody,
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

                                publishLocalStream(true); // audio=true, video=true

                                const list = data["publishers"] || [];
                                list.forEach((p) => {
                                    console.log(
                                        "[publisher] existing publisher:",
                                        p.id,
                                        p.display
                                    );
                                    newRemoteFeed(p.id, p.display, roomNumber);
                                });

                                if (list.length > 0) {
                                    notifyRemoteParticipantsChanged();
                                }
                            }

                            if (event === "event") {
                                //  새로 들어온 퍼블리셔들 (list)
                                const list = data["publishers"] || [];
                                list.forEach((p) => {
                                    console.log(
                                        "[publisher] new publisher event:",
                                        p.id,
                                        p.display
                                    );
                                    newRemoteFeed(p.id, p.display, roomNumber);
                                });

                                if (list.length > 0) {
                                    notifyRemoteParticipantsChanged();
                                }
                                //  누가 나갔을 때 (leaving)
                                const leaving = data["leaving"];
                                if (leaving) {
                                    console.log(
                                        "[publisher] publisher leaving:",
                                        leaving
                                    );
                                    const feedInfo =
                                        remoteFeedsRef.current[leaving];
                                    if (feedInfo) {
                                        try {
                                            console.log(
                                                "[publisher] detaching remote feed handle:",
                                                leaving
                                            );
                                            // 서버에 detach 요청 한 번만
                                            feedInfo.handle.detach();
                                        } catch (e) {
                                            console.warn(
                                                "[publisher] remote feed detach error",
                                                e
                                            );
                                        }
                                    } else {
                                        // 혹시라도 이미 oncleanup 등에서 제거된 경우,
                                        // DOM이 남아있으면 마지막으로 한 번 더 정리
                                        detachRemoteFeed(leaving);
                                    }

                                    notifyRemoteParticipantsChanged();
                                }

                                //  방송 중단(unpublished)
                                const unpublished = data["unpublished"];
                                if (unpublished && unpublished !== "ok") {
                                    console.log(
                                        "[publisher] publisher unpublished:",
                                        unpublished
                                    );
                                    const feedInfo =
                                        remoteFeedsRef.current[unpublished];
                                    if (feedInfo) {
                                        try {
                                            console.log(
                                                "[publisher] detaching remote feed handle (unpublished):",
                                                unpublished
                                            );
                                            feedInfo.handle.detach();
                                        } catch (e) {
                                            console.warn(
                                                "[publisher] remote feed detach error (unpublished)",
                                                e
                                            );
                                        }
                                    } else {
                                        detachRemoteFeed(unpublished);
                                    }

                                    notifyRemoteParticipantsChanged();
                                }

                                //  방 자체가 사라진 경우
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

                        // 내 스트림(캠, 마이크)을 브라우저에 출력
                        onlocalstream: (stream) => {
                            console.log("[publisher] onlocalstream", stream);
                            localStreamRef.current = stream;

                            // <div id="videolocal"></div> 내부에 비디오 태그 생성
                            const container =
                                document.getElementById("videolocal");
                            if (!container) {
                                console.error("#videolocal element not found");
                                return;
                            }

                            container.innerHTML = "";

                            // 비디오 태그 설정
                            const video = document.createElement("video");
                            video.autoplay = true;
                            video.playsInline = true;
                            video.muted = true; // 에코 방지
                            video.style.width = "100%";
                            video.style.height = "100%";
                            video.style.objectFit = "cover";

                            container.appendChild(video);
                            Janus.attachMediaStream(video, stream);
                        },

                        oncleanup: () => {
                            console.log("[publisher] oncleanup");
                        },
                    });
                },

                // 세션 생성 실패
                error: (err) => {
                    console.error("Janus error raw:", err);
                    if (err && err.response) {
                        console.log("Janus error status:", err.response.status);
                    }
                    setError("Janus 세션 생성 중 에러가 발생했습니다.");
                    setIsConnecting(false);
                },

                // 세션 삭제
                destroyed: () => {
                    console.log("[useJanusLocalOnly] Janus destroyed");
                    setIsConnecting(false);
                    setIsConnected(false);
                },
            });
        },
        [serverUrl, cleanup, publishLocalStream]
    );
    // ========== 회의 입장 시작 ==========

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

            setError(null);
            setIsConnecting(true);

            // Janus 연결 가능 상태 => 세션 플러그인 생성 시작
            const start = () => {
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
        [isConnecting, isConnected, createSessionAndAttach]
    );
    // ========== 방 나가기, 언마운트 시 정리 ==========
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
        joinRoom,
        leaveRoom,
    };
}
