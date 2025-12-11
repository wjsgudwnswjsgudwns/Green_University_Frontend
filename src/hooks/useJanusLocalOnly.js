import { useCallback, useEffect, useRef, useState } from "react";

export function useJanusLocalOnly(
    serverUrl = "https://janus.jsflux.co.kr/janus",
    options = {}
) {
    const { onRemoteParticipantsChanged } = options || {};

    const remoteChangedRef = useRef(null);

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

    // 현재 오디오/비디오 활성 상태
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);

    // 토글에서 최신 값을 쓰기 위한 ref
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

    // ========== Janus 내부 객체 ==========
    const janusRef = useRef(null); // Janus 세션
    const pluginRef = useRef(null); // videoroom 플러그인 핸들
    const localStreamRef = useRef(null); // 내 카메라/마이크 스트림
    const initedRef = useRef(false); // Janus.init을 이미 했는지

    // subscriber / remote feed 관리
    // feedId -> { handle, slotId }
    const remoteFeedsRef = useRef({});
    const privateIdRef = useRef(null); // publisher joined 시 받은 private_id

    function resetAllRemoteFeeds() {
        console.log("[useJanusLocalOnly] resetAllRemoteFeeds");

        Object.keys(remoteFeedsRef.current).forEach((feedId) => {
            // 여기서는 우리가 주도적으로 정리하는 거니까
            // skipHandleCleanup: false (기본값) → handle까지 정리
            detachRemoteFeed(feedId);
        });

        const grid = document.getElementById("remote-grid");
        if (grid) {
            grid.innerHTML = "";
        }

        remoteFeedsRef.current = {};
    }
    function syncRemoteDomWithFeeds() {
        const grid = document.getElementById("remote-grid");
        if (!grid) return;

        // 1) 현재 살아있는 feedId 기준으로 유효한 DOM id 리스트 만들기
        const validIds = new Set(
            Object.keys(remoteFeedsRef.current).map(
                (feedId) => `remote-${feedId}`
            )
        );

        console.log("[syncRemoteDomWithFeeds] feeds =", remoteFeedsRef.current);
        console.log(
            "[syncRemoteDomWithFeeds] DOM children =",
            Array.from(grid.children).map((c) => c.id)
        );

        // 2) remote-grid 아래의 자식들 중
        //    validIds에 없는 것들은 전부 제거
        Array.from(grid.children).forEach((child) => {
            if (
                child.id &&
                child.id.startsWith("remote-") &&
                !validIds.has(child.id)
            ) {
                console.log("[subscriber] stray remote DOM 제거:", child.id);
                grid.removeChild(child);
            }
        });
    }
    // ========== 공통 정리 로직 ==========
    // fromJanus === true : Janus.destroy() 이후 콜백에서 호출
    // fromJanus === false: 우리가 직접 정리할 때 호출
    const cleanup = useCallback((fromJanus = false) => {
        console.log("[useJanusLocalOnly] cleanup, fromJanus =", fromJanus);

        // ✅ remote feed + remote DOM 전부 정리
        resetAllRemoteFeeds();

        // ✅ 로컬 미디어 정리
        try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
        } catch (e) {
            console.warn("local stream cleanup error", e);
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

        try {
            if (janusRef.current && !fromJanus) {
                janusRef.current.destroy();
            }
        } catch (e) {
            console.warn("janus destroy error", e);
        }

        janusRef.current = null;
        pluginRef.current = null;
        localStreamRef.current = null;

        setIsConnecting(false);
        setIsConnected(false);
        isConnectedRef.current = false;
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
                    setAudioEnabled(useAudio);
                    setVideoEnabled(useVideo);
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
    function getOrCreateRemoteContainer(feedId, display) {
        const grid = document.getElementById("remote-grid");
        if (!grid) {
            console.error("#remote-grid element not found");
            return null;
        }

        const containerId = `remote-${feedId}`;
        let container = document.getElementById(containerId);

        if (!container) {
            container = document.createElement("div");
            container.id = containerId;
            container.className = "meeting-video__remote";

            // 필요하면 label 같은 것도 여기서 추가 가능
            // const label = document.createElement("div");
            // label.className = "meeting-video__remote-label";
            // label.innerText = display || "참가자";
            // container.appendChild(label);

            grid.appendChild(container);
        }

        return container;
    }

    const detachRemoteFeed = (feedId, options = {}) => {
        const { skipHandleCleanup = false } = options;

        const feedInfo = remoteFeedsRef.current[feedId];
        if (!feedInfo) return;

        console.log("[subscriber] detachRemoteFeed:", feedId);

        // 🔹 1) Janus 핸들 정리 (oncleanup에서 호출된 경우는 생략)
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

        // 🔹 2) DOM 제거
        const containerId = `remote-${feedId}`;
        const container = document.getElementById(containerId);
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }

        // 🔹 3) ref에서 제거
        delete remoteFeedsRef.current[feedId];

        // 🔹 4) 싱크 & 콜백
        syncRemoteDomWithFeeds();
        notifyRemoteParticipantsChanged();
    };

    const newRemoteFeed = (feedId, display, roomNumber, forcedSlotId) => {
        const Janus = window.Janus;
        if (!Janus || !janusRef.current) return;

        // 이미 구독 중이면 다시 attach 안 함
        if (remoteFeedsRef.current[feedId]) {
            console.log("[subscriber] already attached for feed", feedId);
            return;
        }

        // 🔥 같은 display 가진 기존 feed 정리 (이 로직 살릴 수 있게 info.display를 유지)
        Object.entries(remoteFeedsRef.current).forEach(([oldFeedId, info]) => {
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
                detachRemoteFeed(oldFeedId); // ✅ 여기서도 handle까지 같이 정리
            }
        });

        syncRemoteDomWithFeeds();

        console.log("[subscriber] attaching new feed:", feedId, display);

        janusRef.current.attach({
            plugin: "janus.plugin.videoroom",

            success: (handle) => {
                // feedId -> { handle, slotId } 저장
                remoteFeedsRef.current[feedId] = {
                    ...(remoteFeedsRef.current[feedId] || {}),
                    handle,
                    feedId,
                    display,
                };

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

                const container = getOrCreateRemoteContainer(feedId, display);
                if (!container) return;

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
                detachRemoteFeed(feedId, { skipHandleCleanup: true });
            },
        });
    };
    // ========== Janus 세션 플러그인 생성 ==========

    const createSessionAndAttach = useCallback(
        ({ roomNumber, displayName }) => {
            const Janus = window.Janus;
            if (!Janus) return;

            const janus = new Janus({
                server: serverUrl,

                // 세션 생성 성공
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
                            "[useJanusLocalOnly] 세션 성공 콜백 시점에 janusRef가 null (이미 정리된 상태)"
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
                                        success: (result) => {
                                            // ⬇️ 여기로 아까 로그에 나온 "created" 응답이 들어옴
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

                                publishLocalStream(true); // audio=true, video=true

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
                                let changed = false;

                                // Janus가 현재 publisher 리스트를 내려주는 경우:
                                const list = data["publishers"] || [];
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

                                // 🔹 누가 나갔을 때
                                const leaving = data["leaving"];
                                if (leaving) {
                                    console.log(
                                        "[publisher] publisher leaving:",
                                        leaving
                                    );
                                    detachRemoteFeed(leaving);
                                    changed = true;
                                }

                                // 🔹 방송 중단(unpublished)
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
                                    syncRemoteDomWithFeeds();
                                    notifyRemoteParticipantsChanged();
                                }

                                // 🔹 방 자체가 사라진 경우
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
                    cleanup(true);
                },
            });
            janusRef.current = janus;
        },
        [serverUrl, cleanup, publishLocalStream]
    );
    // ========== 오디오/비디오 토글 ==========

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

        // Janus에 재설정 (새 offer로 재협상)
        publishLocalStream(nextAudio, videoEnabledRef.current);

        // 로컬 트랙에도 바로 반영 (UX용)
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

        // Janus에 재설정 (새 offer로 재협상)
        publishLocalStream(audioEnabledRef.current, nextVideo);

        // 로컬 트랙에도 바로 반영
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

            resetAllRemoteFeeds();

            syncRemoteDomWithFeeds();
            setError(null);
            setIsConnecting(true);

            // Janus 연결 가능 상태 => 세션 플러그인 생성 시작
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
        audioEnabled,
        videoEnabled,
        toggleAudio,
        toggleVideo,
        joinRoom,
        leaveRoom,
    };
}
