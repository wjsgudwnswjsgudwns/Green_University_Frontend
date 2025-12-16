// src/pages/MeetingJoinPage.js
import React, {
    useCallback,
    useEffect,
    useState,
    useRef,
    useMemo,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles/MeetingJoinPage.css";
import { useJanusLocalOnly } from "../hooks/useJanusLocalOnly";
import MeetingChatPanel from "../components/MeetingChatPanel";
import MeetingParticipantsPanel from "../components/MeetingParticipantsPanel";
import { useMeetingLayout } from "../hooks/useMeetingLayout";
import { useMeetingMediaSignals } from "../hooks/useMeetingMediaSignals";
import { useMeetingPresence } from "../hooks/useMeetingPresence";

function MeetingJoinPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const terminatedRef = useRef(false);
    const leaveRoomRef = useRef(null);

    const [error, setError] = useState("");
    const [scriptsLoaded, setScriptsLoaded] = useState(false);

    const [hasJoined, setHasJoined] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteParticipants, setRemoteParticipants] = useState([]);

    const [sessionKey, setSessionKey] = useState(null);
    const [terminated, setTerminated] = useState(false);

    const [sideTab, setSideTab] = useState("chat");

    const getNavType = () => {
        const nav = performance.getEntriesByType?.("navigation")?.[0];
        if (nav?.type) return nav.type;
        const legacy = performance.navigation?.type;
        if (legacy === 1) return "reload";
        if (legacy === 2) return "back_forward";
        return "navigate";
    };

    const navType = useMemo(() => getNavType(), []);
    const shouldIgnoreState = navType === "reload" || navType === "navigate";
    const stateJoinInfo = shouldIgnoreState
        ? null
        : location.state?.info || null;

    const [joinInfo, setJoinInfo] = useState(stateJoinInfo);
    const [isLoadingJoinInfo, setIsLoadingJoinInfo] = useState(!stateJoinInfo);

    const currentUserId = joinInfo?.userId || null;

    const { participants: presenceParticipants, presenceConnected } =
        useMeetingPresence(meetingId, currentUserId, sessionKey, joinInfo);

    const { mediaStates, sendMediaStateNow, mediaSignalConnected } =
        useMeetingMediaSignals(meetingId, currentUserId, joinInfo?.displayName);
    const sendMediaStateNowRef = useRef(null);

    const mediaSignalConnectedRef = useRef(false);
    useEffect(() => {
        mediaSignalConnectedRef.current = mediaSignalConnected;
    }, [mediaSignalConnected]);

    useEffect(() => {
        sendMediaStateNowRef.current = sendMediaStateNow;
    }, [sendMediaStateNow]);

    // presence 연결이 잠시 끊겼을 때, 마지막 participants 유지용
    const lastPresenceRef = useRef([]);
    useEffect(() => {
        if (
            Array.isArray(presenceParticipants) &&
            presenceParticipants.length > 0
        ) {
            lastPresenceRef.current = presenceParticipants;
        }
    }, [presenceParticipants]);

    function parseDisplay(display) {
        const text = String(display || "");
        try {
            const obj = JSON.parse(text);
            return {
                name: obj?.name || "참가자",
                // role 값 대소문자 무관 비교
                isHost: obj?.role?.toUpperCase?.() === "HOST",
                userId: obj?.userId != null ? Number(obj.userId) : null,
            };
        } catch {}
        const [namePart, rolePart, userIdPart] = text.split("|");
        const name = namePart || "참가자";
        const role = rolePart || "PARTICIPANT";
        const userId = userIdPart ? Number(userIdPart) : null;
        return { name, isHost: role.toUpperCase() === "HOST", userId };
    }

    function sortParticipants(list) {
        return [...list].sort((a, b) => {
            if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
            if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
            return 0;
        });
    }

    const participants = useMemo(() => {
        // remoteParticipants로부터 userId별 스트림 정보 구성 …
        const remoteInfoByUserId = new Map();
        (remoteParticipants || []).forEach((p) => {
            const parsed = parseDisplay(p.display);
            if (parsed.userId != null) {
                remoteInfoByUserId.set(parsed.userId, {
                    stream: p.stream || null,
                    videoDead: !!p.videoDead,
                });
            }
        });

        // presence가 끊겼을 때 마지막 값 유지 …
        const effectivePresence = (() => {
            if (!presenceConnected) return lastPresenceRef.current || [];
            return Array.isArray(presenceParticipants)
                ? presenceParticipants
                : [];
        })();

        // ✅ presence가 비어있어도 최소 “나”는 생성(레이아웃/타일 안정화)
        if (!effectivePresence || effectivePresence.length === 0) {
            if (!joinInfo?.userId) return [];
            return [
                {
                    id: String(joinInfo.userId),
                    name:
                        joinInfo.displayName ||
                        joinInfo.userName ||
                        joinInfo.nickname ||
                        "나",
                    isMe: true,
                    isHost:
                        !!joinInfo.isHost ||
                        joinInfo.userId === joinInfo.hostUserId,
                    userId: joinInfo.userId,
                    stream: localStream || null,
                    videoDead: false,
                },
            ];
        }

        return effectivePresence.map((p, idx) => {
            // 서버에서는 isMe 정보를 주지 않으므로 현재 사용자와 비교해 결정
            const uid = p.userId != null ? p.userId : `temp-${idx}`;
            const isMe =
                p.userId != null &&
                joinInfo?.userId != null &&
                p.userId === joinInfo.userId;
            return {
                id: isMe ? "me" : String(uid),
                userId: p.userId ?? null,
                name: p.displayName || "참가자",
                isMe: isMe,
                isHost: p.role === "HOST",
                // 내 타일이면 localStream 사용, 아니면 remote 스트림
                stream: isMe
                    ? localStream
                    : remoteInfoByUserId.get(p.userId)?.stream || null,
                // 내 화면에서는 카메라 분리 표시를 하지 않음
                videoDead: isMe
                    ? false
                    : remoteInfoByUserId.get(p.userId)?.videoDead || false,
            };
        });
    }, [
        presenceParticipants,
        presenceConnected,
        remoteParticipants,
        localStream,
        joinInfo,
    ]);

    const sortedParticipants = useMemo(
        () => sortParticipants(participants),
        [participants]
    );

    const {
        mode,
        focusId,
        focusedParticipant,
        switchToGrid,
        switchToFocus,
        handleParticipantClick,
    } = useMeetingLayout(participants);

    useEffect(() => {
        terminatedRef.current = terminated;
    }, [terminated]);

    const handleTerminateAndLeave = useCallback(
        (msg) => {
            if (terminatedRef.current) return;
            terminatedRef.current = true;
            setTerminated(true);

            try {
                leaveRoomRef.current?.();
            } catch (e) {
                console.error("leaveRoom 호출 중 오류", e);
            }

            window.setTimeout(() => {
                if (msg) alert(msg);
                navigate("/meetings");
            }, 0);
        },
        [navigate]
    );
    const isConnectedRef2 = useRef(false);
    const {
        isSupported,
        isConnecting,
        isConnected,
        error: janusError,
        joinRoom,
        leaveRoom,
        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        // 새로 반환된 noMediaDevices
        noMediaDevices,
        toggleAudio,
        toggleVideo,
        reinjectIfPossible,
    } = useJanusLocalOnly(undefined, {
        onLocalStream: (stream) => setLocalStream(stream),
        onRemoteParticipantsChanged: (janusRemotes) =>
            setRemoteParticipants(janusRemotes || []),

        onLocalMediaState: (payload) => {
            // Janus 훅이 계산한 "진짜 상태"를 그대로 signals로 브로드캐스트
            if (!mediaSignalConnectedRef.current) return;
            if (!isConnectedRef2.current) return;
            const fn = sendMediaStateNowRef.current;
            if (!fn) return;
            fn(!!payload.audio, !!payload.video, {
                videoDeviceLost: !!payload.videoDeviceLost,
                noMediaDevices: !!payload.noMediaDevices,
                // (선택) 필요하면 확장 필드도 여기에 포함 가능
                // liveAudio: !!payload.liveAudio,
                // liveVideo: !!payload.liveVideo,
            });
        },
    });

    useEffect(() => {
        isConnectedRef2.current = isConnected;
    }, [isConnected]);

    const computeVideoDeviceLostForSignal = useCallback(
        (wantVideo) => {
            // "비디오를 원할 때"만 deviceLost 의미가 있음
            return !!wantVideo && (!!isVideoDeviceLost || !!noMediaDevices);
        },
        [isVideoDeviceLost, noMediaDevices]
    );

    // UI 먼저 반영 → Janus 토글
    const onToggleAudioUiFirst = useCallback(() => {
        const nextAudio = !audioEnabled;
        if (mediaSignalConnected && isConnected) {
        }
        toggleAudio();
    }, [
        isConnected,
        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        sendMediaStateNow,
        toggleAudio,
        mediaSignalConnected,
        computeVideoDeviceLostForSignal,
        noMediaDevices,
    ]);

    const onToggleVideoUiFirst = useCallback(() => {
        const nextVideo = !videoEnabled;
        if (mediaSignalConnected && isConnected) {
        }
        toggleVideo();
    }, [
        isConnected,
        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        sendMediaStateNow,
        toggleVideo,
        mediaSignalConnected,
        computeVideoDeviceLostForSignal,
        noMediaDevices,
    ]);

    useEffect(() => {
        leaveRoomRef.current = leaveRoom;
    }, [leaveRoom]);

    // ✅ 방이 바뀌면 초기 시그널 다시 보내야 함
    const didInitialSignalRef = useRef(false);
    useEffect(() => {
        didInitialSignalRef.current = false;
    }, [meetingId]);

    // ✅ 최초 1회: “현재 내 상태”를 signals로 브로드캐스트
    useEffect(() => {
        if (!joinInfo) return;
        if (!mediaSignalConnected) return;
        if (!isConnected) return;
        if (didInitialSignalRef.current) return;

        didInitialSignalRef.current = true;
    }, [
        joinInfo,
        mediaSignalConnected,
        isConnected,
        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        sendMediaStateNow,
        computeVideoDeviceLostForSignal,
        noMediaDevices,
    ]);

    // joinInfo에 sessionKey 없으면 자동 종료
    useEffect(() => {
        if (hasJoined && !sessionKey && !terminatedRef.current) {
            handleTerminateAndLeave(
                "세션 정보가 유효하지 않아 회의에서 자동으로 나갑니다. 다시 접속해 주세요."
            );
        }
    }, [hasJoined, sessionKey, handleTerminateAndLeave]);

    const loadScript = (src) =>
        new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = (e) => reject(e);
            document.body.appendChild(script);
        });

    const handleJoined = useCallback(async () => {
        if (hasJoined) return;
        if (!meetingId) return;

        try {
            const res = await api.post(
                `/api/meetings/${meetingId}/participants/join`
            );
            setHasJoined(true);

            const serverSessionKey = res.data?.sessionKey;
            if (serverSessionKey) setSessionKey(serverSessionKey);
        } catch (e) {
            console.error("참가자 join API 실패", e);

            const msg =
                e.response?.data?.message ||
                "회의에 참가하는 도중 오류가 발생했습니다.";

            alert(msg);
            leaveRoom();
            navigate("/meetings");
        }
    }, [meetingId, hasJoined, leaveRoom, navigate]);

    const handleLeave = async () => {
        terminatedRef.current = true;
        setTerminated(true);
        try {
            if (hasJoined) {
                await api.post(`/api/meetings/${meetingId}/participants/leave`);
            }
        } catch (e) {
            console.error("참가자 leave API 실패", e);
        } finally {
            leaveRoom();
            navigate("/meetings");
        }
    };

    // pagehide keepalive leave
    useEffect(() => {
        if (!meetingId) return;
        if (!hasJoined) return;
        if (!sessionKey) return;

        const onPageHide = () => {
            if (terminatedRef.current) return;
            terminatedRef.current = true;
            setTerminated(true);

            const token = localStorage.getItem("token");

            fetch(
                `http://localhost:8881/api/meetings/${meetingId}/participants/leave-keepalive`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ sessionKey }),
                    keepalive: true,
                }
            ).catch(() => {});

            try {
                leaveRoomRef.current?.();
            } catch {}
        };

        window.addEventListener("pagehide", onPageHide);
        return () => window.removeEventListener("pagehide", onPageHide);
    }, [meetingId, hasJoined, sessionKey]);

    // Janus script load
    useEffect(() => {
        const loadJanusScripts = async () => {
            try {
                await loadScript("/janus/janus.js");
                setScriptsLoaded(true);
            } catch (e) {
                setError("화상 회의 모듈을 불러오는 데 실패했습니다.");
            }
        };
        loadJanusScripts();
    }, []);

    // joinInfo fetch (state 없으면)
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (joinInfo) {
                setIsLoadingJoinInfo(false);
                return;
            }
            try {
                const res = await api.get(
                    `/api/meetings/${meetingId}/join-info`
                );
                if (cancelled) return;
                setJoinInfo(res.data);
            } catch (err) {
                console.error(err);
                if (!cancelled)
                    setError("회의 입장 정보를 불러오는 데 실패했습니다.");
            } finally {
                if (!cancelled) setIsLoadingJoinInfo(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [meetingId]); // joinInfo 제외(의도)

    // Janus joinRoom
    useEffect(() => {
        if (!joinInfo) return;
        if (!scriptsLoaded) return;
        if (terminatedRef.current) return;

        if (!window.Janus) {
            setError("화상 회의 모듈이 초기화되지 않았습니다.");
            return;
        }

        const roomNumber = joinInfo.roomNumber;
        const baseName =
            joinInfo.displayName ||
            joinInfo.userName ||
            joinInfo.nickname ||
            "User";

        const isHostSelf =
            !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

        const displayName = JSON.stringify({
            name: baseName,
            role: isHostSelf ? "HOST" : "PARTICIPANT",
            userId: joinInfo.userId,
        });

        joinRoom({ roomNumber, displayName });
    }, [joinInfo, scriptsLoaded, joinRoom]);

    // Janus connected -> REST join
    useEffect(() => {
        if (!isConnected) return;
        if (hasJoined) return;
        if (terminatedRef.current) return;
        handleJoined();
    }, [isConnected, hasJoined, handleJoined]);

    // ping
    useEffect(() => {
        if (!meetingId || !sessionKey || terminated) return;

        const interval = setInterval(async () => {
            try {
                const res = await api.post(
                    `/api/meetings/${meetingId}/participants/ping`,
                    {
                        sessionKey,
                    }
                );

                const { active, reason } = res.data || {};
                if (active) return;
                if (terminatedRef.current) return;

                let msg = "회의 연결이 종료되었습니다.";

                if (reason === "SESSION_REPLACED") {
                    msg =
                        "다른 브라우저 또는 기기에서 이 계정으로 다시 회의에 접속하여, 현재 접속이 종료됩니다.";
                } else if (reason === "MEETING_FINISHED") {
                    msg = "회의 시간이 종료되었습니다.";
                } else if (reason === "MEETING_CANCELED") {
                    msg = "회의가 취소되었습니다.";
                } else if (reason === "NOT_JOINED") {
                    msg = "현재 회의 참가자로 등록되어 있지 않습니다.";
                }

                handleTerminateAndLeave(msg);
            } catch (e) {
                console.error("회의 상태 ping 실패", e);
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [
        meetingId,
        sessionKey,
        terminated,
        handleTerminateAndLeave,
        reinjectIfPossible,
    ]);
    const prevPresenceIdsRef = useRef([]);
    useEffect(() => {
        if (!mediaSignalConnected || !isConnected) return;
        const currentIds = (presenceParticipants || [])
            .map((p) => p.userId)
            .filter(Boolean);
        const myId = joinInfo?.userId ?? null;

        const joinedIds = currentIds.filter(
            (id) => !prevPresenceIdsRef.current.includes(id)
        );
        // 본인이 아닌 새로운 참가자가 입장했다면 자신의 상태를 다시 브로드캐스트
        const joinedOthers = myId
            ? joinedIds.filter((id) => id !== myId)
            : joinedIds;
        if (joinedOthers.length > 0) {
        }
        prevPresenceIdsRef.current = currentIds;
    }, [
        presenceParticipants,
        mediaSignalConnected,
        isConnected,
        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        sendMediaStateNow,
        computeVideoDeviceLostForSignal,
        noMediaDevices,
        joinInfo?.userId,
    ]);
    const renderStatusText = () => {
        if (!isSupported) return "이 브라우저는 WebRTC를 지원하지 않습니다.";
        if (isLoadingJoinInfo) return "회의 입장 정보를 불러오는 중입니다...";
        if (error) return error;
        if (janusError) return janusError;
        if (isConnecting) return "회의에 접속 중입니다...";
        if (isConnected) return "회의에 접속되었습니다.";
        return "";
    };

    if (error && !joinInfo) {
        return (
            <div className="meeting-join-page__error-wrap">
                <p className="meeting-join-page__error-text">{error}</p>
                <button
                    className="meeting-join-page__back-button"
                    onClick={() => navigate("/meetings")}
                >
                    목록으로 돌아가기
                </button>
            </div>
        );
    }

    if (!joinInfo) {
        return (
            <div className="meeting-join-page__error-wrap">
                <p>회의 입장 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    const isHostSelf =
        !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

    return (
        <div className="meeting-join-page">
            <div className="meeting-join-page__header">
                <div>
                    <div className="meeting-join-page__subtitle">
                        GREEN LMS · 화상 회의
                    </div>
                    <h2 className="meeting-join-page__title">
                        {joinInfo.title}
                    </h2>

                    <div className="meeting-join-page__meta">
                        방 번호 {joinInfo.roomNumber} · {joinInfo.displayName} (
                        {joinInfo.userRole})
                    </div>

                    <div className="meeting-join-page__status">
                        {renderStatusText()}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    {participants.length > 1 && (
                        <div className="meeting-join-page__layout-toggle">
                            <button
                                className={
                                    mode === "focus"
                                        ? "meeting-join-page__layout-btn meeting-join-page__layout-btn--active"
                                        : "meeting-join-page__layout-btn"
                                }
                                onClick={switchToFocus}
                            >
                                강조 모드
                            </button>
                            <button
                                className={
                                    mode === "grid"
                                        ? "meeting-join-page__layout-btn meeting-join-page__layout-btn--active"
                                        : "meeting-join-page__layout-btn"
                                }
                                onClick={switchToGrid}
                            >
                                그리드 모드
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleLeave}
                        className="meeting-join-page__leave-button"
                    >
                        회의 나가기
                    </button>
                </div>
            </div>

            <div className="meeting-join-page__main">
                <div className="meeting-video">
                    <div className="meeting-video__main">
                        {mode === "solo" && focusedParticipant && (
                            <div className="meeting-video__stage meeting-video__stage--solo">
                                <VideoTile
                                    participant={focusedParticipant}
                                    variant="solo"
                                    isFocused
                                    onClick={() =>
                                        handleParticipantClick(
                                            focusedParticipant.id
                                        )
                                    }
                                    audioEnabled={audioEnabled}
                                    videoEnabled={videoEnabled}
                                    isVideoDeviceLost={isVideoDeviceLost}
                                    mediaStates={mediaStates}
                                    noMediaDevices={noMediaDevices}
                                />
                            </div>
                        )}

                        {mode === "focus" && participants.length >= 2 && (
                            <div className="meeting-video__stage meeting-video__stage--strip">
                                <div className="meeting-video__focus">
                                    {focusedParticipant && (
                                        <VideoTile
                                            participant={focusedParticipant}
                                            variant="focus"
                                            isFocused
                                            onClick={() =>
                                                handleParticipantClick(
                                                    focusedParticipant.id
                                                )
                                            }
                                            audioEnabled={audioEnabled}
                                            videoEnabled={videoEnabled}
                                            isVideoDeviceLost={
                                                isVideoDeviceLost
                                            }
                                            mediaStates={mediaStates}
                                            noMediaDevices={noMediaDevices}
                                        />
                                    )}
                                </div>

                                <div className="meeting-video__thumb-row">
                                    <button className="meeting-video__thumb-nav meeting-video__thumb-nav--prev">
                                        ‹
                                    </button>

                                    <div className="meeting-video__thumb-strip">
                                        {sortedParticipants
                                            .filter((p) => p.id !== focusId)
                                            .map((p) => (
                                                <VideoTile
                                                    key={p.id}
                                                    participant={p}
                                                    variant="thumb"
                                                    onClick={() =>
                                                        handleParticipantClick(
                                                            p.id
                                                        )
                                                    }
                                                    audioEnabled={audioEnabled}
                                                    videoEnabled={videoEnabled}
                                                    isVideoDeviceLost={
                                                        isVideoDeviceLost
                                                    }
                                                    mediaStates={mediaStates}
                                                    noMediaDevices={
                                                        noMediaDevices
                                                    }
                                                />
                                            ))}
                                    </div>

                                    <button className="meeting-video__thumb-nav meeting-video__thumb-nav--next">
                                        ›
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === "grid" && participants.length >= 2 && (
                            <div className="meeting-video__stage meeting-video__stage--grid">
                                <div className="meeting-video__grid">
                                    {sortedParticipants.map((p) => (
                                        <VideoTile
                                            key={p.id}
                                            participant={p}
                                            variant={
                                                p.isMe ? "me-grid" : "grid"
                                            }
                                            isFocused={p.id === focusId}
                                            onClick={() =>
                                                handleParticipantClick(p.id)
                                            }
                                            audioEnabled={audioEnabled}
                                            videoEnabled={videoEnabled}
                                            isVideoDeviceLost={
                                                isVideoDeviceLost
                                            }
                                            mediaStates={mediaStates}
                                            noMediaDevices={noMediaDevices}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {mode === "solo" &&
                            !focusedParticipant &&
                            sortedParticipants[0] && (
                                <div className="meeting-video__stage meeting-video__stage--solo">
                                    <VideoTile
                                        participant={sortedParticipants[0]}
                                        variant="solo"
                                        isFocused
                                        onClick={() =>
                                            handleParticipantClick(
                                                sortedParticipants[0].id
                                            )
                                        }
                                        audioEnabled={audioEnabled}
                                        videoEnabled={videoEnabled}
                                        isVideoDeviceLost={isVideoDeviceLost}
                                        mediaStates={mediaStates}
                                        noMediaDevices={noMediaDevices}
                                    />
                                </div>
                            )}
                    </div>
                    {noMediaDevices && (
                        <div className="meeting-video__device-message">
                            현재 브라우저에 마이크·카메라가 연결되지 않은
                            상태입니다.
                        </div>
                    )}
                    <div className="meeting-video__controls">
                        <button
                            className={`meeting-video__control-btn ${
                                audioEnabled
                                    ? ""
                                    : "meeting-video__control-btn--off"
                            }`}
                            onClick={onToggleAudioUiFirst}
                        >
                            {audioEnabled ? "🎙" : "🔇"}
                        </button>

                        <button
                            className={`meeting-video__control-btn ${
                                videoEnabled
                                    ? ""
                                    : "meeting-video__control-btn--off"
                            }`}
                            onClick={onToggleVideoUiFirst}
                        >
                            {videoEnabled ? "🎥" : "🚫"}
                        </button>

                        <button
                            className="meeting-video__control-btn"
                            disabled
                            title="추후 화면 공유 기능 추가 예정"
                        >
                            🖥
                        </button>

                        <button
                            className="meeting-video__control-btn meeting-video__control-btn--danger"
                            onClick={handleLeave}
                            disabled={!isConnected && !isConnecting}
                        >
                            ⏹
                        </button>
                    </div>
                </div>

                <div className="meeting-side">
                    <div className="meeting-side__tabs">
                        <div
                            className={
                                sideTab === "chat"
                                    ? "meeting-side__tab meeting-side__tab--active"
                                    : "meeting-side__tab"
                            }
                            onClick={() => setSideTab("chat")}
                            style={{ cursor: "pointer" }}
                        >
                            채팅
                        </div>
                        <div
                            className={
                                sideTab === "participants"
                                    ? "meeting-side__tab meeting-side__tab--active"
                                    : "meeting-side__tab"
                            }
                            onClick={() => setSideTab("participants")}
                            style={{ cursor: "pointer" }}
                        >
                            참가자
                        </div>
                    </div>

                    {sideTab === "chat" ? (
                        <MeetingChatPanel
                            meetingId={meetingId}
                            joinInfo={joinInfo}
                            terminated={terminated}
                        />
                    ) : (
                        <div style={{ padding: 12 }}>
                            <MeetingParticipantsPanel
                                participants={sortedParticipants.map((p) => ({
                                    id: p.id,
                                    name: p.name,
                                    isMe: p.isMe,
                                    isHost: p.isHost,
                                }))}
                                isHost={isHostSelf}
                                onInvite={() => alert("초대 기능은 추후 구현")}
                            />
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                presenceConnected: {String(presenceConnected)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===== VideoTile =====
function VideoTile({
    participant,
    variant = "grid",
    isFocused,
    onClick,
    audioEnabled,
    videoEnabled,
    isVideoDeviceLost,
    mediaStates = {},
    noMediaDevices = false,
}) {
    const videoRef = React.useRef(null);

    const hasLiveTrack = (kind) => {
        const s = participant.stream;
        if (!s) return false;
        const getter =
            kind === "video"
                ? s.getVideoTracks?.bind(s)
                : s.getAudioTracks?.bind(s);
        const tracks = getter ? getter() : [];
        if (!tracks.length) return false;
        return tracks.some((t) => t.readyState === "live");
    };

    const mediaState = participant.userId
        ? mediaStates[participant.userId]
        : null;
    const remoteDeviceLost = !!mediaState?.videoDeviceLost;

    const videoOn = participant.isMe
        ? videoEnabled && !isVideoDeviceLost && !noMediaDevices
        : !remoteDeviceLost &&
          (mediaState && typeof mediaState.video === "boolean"
              ? mediaState.video
              : hasLiveTrack("video"));

    const audioOn = participant.isMe
        ? audioEnabled && !noMediaDevices
        : mediaState && typeof mediaState.audio === "boolean"
        ? mediaState.audio
        : hasLiveTrack("audio");

    const showVideo =
        !!videoOn && !!participant.stream && hasLiveTrack("video");

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const Janus = window.Janus;

        if (!showVideo) {
            if (el.srcObject) el.srcObject = null;
            return;
        }

        if (!participant?.stream) return;

        try {
            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, participant.stream);
            } else {
                el.srcObject = participant.stream;
            }

            const playPromise = el.play && el.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch((err) =>
                    console.warn("[VideoTile] video.play() 실패", err)
                );
            }
        } catch (e) {
            console.error("[VideoTile] attachMediaStream 실패", e);
        }
    }, [participant?.stream, showVideo]);

    if (!participant) return null;

    const classes = [
        "meeting-video__remote",
        variant === "solo" && "meeting-video__remote--solo",
        variant === "focus" && "meeting-video__remote--focus",
        variant === "thumb" && "meeting-video__remote--thumb",
        variant === "me-grid" && "meeting-video__remote--me-grid",
        variant === "grid" && "meeting-video__remote--grid",
        isFocused && "meeting-video__remote--focused",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={classes} onClick={onClick}>
            {showVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={participant.isMe}
                    className="meeting-video__video"
                />
            ) : (
                <div className="meeting-video__placeholder">
                    <div className="meeting-video__avatar">
                        {participant.name?.[0] || "?"}
                    </div>
                    <div className="meeting-video__placeholder-name">
                        {participant.name}
                        {participant.isMe && " · 나"}
                        {participant.isHost && " · 주최자"}
                    </div>
                </div>
            )}

            {showVideo && (
                <div className="meeting-video__label">
                    {participant.name}
                    {participant.isMe && " · 나"}
                    {participant.isHost && " · 주최자"}
                </div>
            )}

            <div className="meeting-video__badge-row">
                {!audioOn && <span className="meeting-video__badge">🔇</span>}
                {!videoOn && <span className="meeting-video__badge">📷✕</span>}
                {participant.isHost && (
                    <span className="meeting-video__badge meeting-video__badge--host">
                        H
                    </span>
                )}
            </div>
        </div>
    );
}

export default MeetingJoinPage;
