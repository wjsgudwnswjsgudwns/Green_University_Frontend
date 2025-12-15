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
import { useMeetingLayout } from "../hooks/useMeetingLayout";
import { useMeetingMediaSignals } from "../hooks/useMeetingMediaSignals";
import { useMeetingPresence } from "../hooks/useMeetingPresence";

function MeetingJoinPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const terminatedRef = useRef(false);
    const leaveRoomRef = useRef(null);

    const stateJoinInfo = location.state?.info || null;

    const [joinInfo, setJoinInfo] = useState(stateJoinInfo);
    const [error, setError] = useState("");
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isLoadingJoinInfo, setIsLoadingJoinInfo] = useState(!stateJoinInfo);
    const [hasJoined, setHasJoined] = useState(false);

    const [localStream, setLocalStream] = useState(null);
    const [remoteParticipants, setRemoteParticipants] = useState([]);

    const [sessionKey, setSessionKey] = useState(null);
    const [terminated, setTerminated] = useState(false);
    const currentUserId = joinInfo?.userId || null;

    const { participants: presenceParticipants, presenceConnected } =
        useMeetingPresence(meetingId, currentUserId, joinInfo);

    const { mediaStates, sendMediaState, mediaSignalConnected } =
        useMeetingMediaSignals(meetingId, currentUserId);

    // ===== 참가자 리스트 =====

    // Janus display 파싱: "이름|HOST" 형태
    function parseDisplay(display) {
        const text = String(display || "참가자");
        const [namePart, rolePart, userIdPart] = text.split("|");
        const name = namePart || "참가자";
        const role = rolePart || "PARTICIPANT";
        const userId = userIdPart ? Number(userIdPart) : null;
        return {
            name,
            isHost: role === "HOST",
            userId,
        };
    }

    // HOST / 나 정렬
    function sortParticipants(list) {
        return [...list].sort((a, b) => {
            // 1순위: HOST
            if (a.isHost !== b.isHost) {
                return a.isHost ? -1 : 1;
            }
            // 2순위: 나
            if (a.isMe !== b.isMe) {
                return a.isMe ? -1 : 1;
            }
            return 0;
        });
    }

    const participants = useMemo(() => {
        // 1) Janus remote들을 userId 기준으로 맵핑
        const remoteByUserId = new Map();
        (remoteParticipants || []).forEach((p) => {
            const parsed = parseDisplay(p.display);
            if (parsed.userId) {
                remoteByUserId.set(parsed.userId, {
                    ...p,
                    parsed,
                });
            }
        });

        // 2) presenceParticipants가 있으면 그걸 우선 사용
        if (presenceParticipants && presenceParticipants.length > 0) {
            return presenceParticipants.map((p) => {
                const remote = p.userId ? remoteByUserId.get(p.userId) : null;

                return {
                    id: p.isMe
                        ? "me"
                        : remote
                        ? String(remote.id)
                        : p.userId != null
                        ? String(p.userId)
                        : p.displayName || "remote",
                    name: p.displayName || "참가자",
                    isMe: !!p.isMe,
                    isHost: p.role === "HOST",
                    userId: p.userId,
                    stream: p.isMe
                        ? localStream || null
                        : remote?.stream || null,
                };
            });
        }

        // 3) presence가 아직 비어 있으면 기존 방식으로 fallback
        if (!joinInfo) return [];

        const isHostSelf =
            !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

        const me = {
            id: "me",
            name: joinInfo.displayName || "나",
            isMe: true,
            isHost: !!isHostSelf,
            userId: joinInfo.userId,
            stream: localStream || null,
        };

        const remotes = (remoteParticipants || []).map((p) => {
            const parsed = parseDisplay(p.display);
            return {
                id: String(p.id),
                name: parsed.name,
                isMe: false,
                isHost: parsed.isHost,
                userId: parsed.userId,
                stream: p.stream || null,
            };
        });

        return [me, ...remotes];
    }, [presenceParticipants, remoteParticipants, localStream, joinInfo]);

    const sortedParticipants = useMemo(
        () => sortParticipants(participants),
        [participants]
    );

    // 레이아웃 훅
    const {
        mode, // 'solo' | 'grid' | 'focus'
        focusId,
        focusedParticipant,
        switchToGrid,
        switchToFocus,
        handleParticipantClick,
    } = useMeetingLayout(participants);

    // terminated 상태 ref 동기화
    useEffect(() => {
        terminatedRef.current = terminated;
    }, [terminated]);

    // 공통 종료 처리
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

            console.log("[handleTerminateAndLeave] called with msg:", msg);

            if (msg) {
                window.setTimeout(() => {
                    alert(msg);
                    navigate("/meetings");
                }, 0);
            } else {
                window.setTimeout(() => {
                    navigate("/meetings");
                }, 0);
            }
        },
        [navigate]
    );

    // ===== Janus 훅 =====
    const {
        isSupported,
        isConnecting,
        isConnected,
        error: janusError,
        joinRoom,
        leaveRoom,
        audioEnabled,
        videoEnabled,
        toggleAudio,
        toggleVideo,
    } = useJanusLocalOnly(undefined, {
        onLocalStream: (stream) => {
            setLocalStream(stream);
        },
        onRemoteParticipantsChanged: async (janusRemotes) => {
            console.log(
                "[MeetingJoinPage] remoteParticipantsChanged, meetingId=",
                meetingId,
                "sessionKey=",
                sessionKey,
                "hasJoined=",
                hasJoined
            );

            setRemoteParticipants(janusRemotes || []);

            if (terminatedRef.current) return;

            if (!meetingId) {
                handleTerminateAndLeave(
                    "회의 정보가 유효하지 않아 회의에서 나갑니다."
                );
                return;
            }

            // 이미 join 했는데 sessionKey 없음 → 비정상 세션
            if (!sessionKey && hasJoined) {
                handleTerminateAndLeave(
                    "세션 정보가 유실되어 회의에서 나갑니다. 다시 접속해 주세요."
                );
                return;
            }

            // 아직 join 전인데 sessionKey 없음 → 무시
            if (!sessionKey && !hasJoined) {
                return;
            }

            try {
                const res = await api.post(
                    `/api/meetings/${meetingId}/participants/ping`,
                    { sessionKey }
                );

                const { active, reason } = res.data || {};
                if (active) return;

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
                console.error("회의 상태 ping 실패 (Janus 이벤트 기반)", e);
            }
        },
    });
    // 내 오디오/비디오 상태가 바뀔 때마다 서버로 신호 브로드캐스트
    useEffect(() => {
        if (!joinInfo) return;
        if (!mediaSignalConnected) return;
        if (typeof audioEnabled !== "boolean") return;
        if (typeof videoEnabled !== "boolean") return;

        // 내 현재 상태 브로드캐스트
        sendMediaState(audioEnabled, videoEnabled);
    }, [
        audioEnabled,
        videoEnabled,
        joinInfo,
        mediaSignalConnected,
        sendMediaState,
    ]);

    // join 이후 sessionKey 유실 감시
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
            script.onload = () => {
                console.log("[MeetingJoinPage] script loaded:", src);
                resolve();
            };
            script.onerror = (e) => {
                console.error("[MeetingJoinPage] script load error:", src, e);
                reject(e);
            };
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
            if (serverSessionKey) {
                setSessionKey(serverSessionKey);
            }
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

    // 0) janus.js 로드
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

    // 1) join-info 없으면 서버에서 다시 가져오기
    useEffect(() => {
        const fetchIfNeeded = async () => {
            if (joinInfo) return;
            try {
                const res = await api.get(
                    `/api/meetings/${meetingId}/join-info`
                );
                setJoinInfo(res.data);
            } catch (err) {
                console.error(err);
                setError("회의 입장 정보를 불러오는 데 실패했습니다.");
            } finally {
                setIsLoadingJoinInfo(false);
            }
        };
        fetchIfNeeded();
    }, [joinInfo, meetingId]);

    // 2) joinInfo + scriptsLoaded 기반으로 Janus 시작
    useEffect(() => {
        if (!joinInfo) return;
        if (!scriptsLoaded) {
            console.log("[MeetingJoinPage] scripts 아직 로드 안 됨, 대기");
            return;
        }

        if (terminatedRef.current) {
            console.log(
                "[MeetingJoinPage] 이미 terminated 상태라 joinRoom 스킵"
            );
            return;
        }

        if (!window.Janus) {
            console.error(
                "window.Janus 가 없습니다. janus.js 경로를 확인하세요."
            );
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

        // Janus display 에 역할까지 인코딩
        const displayName = `${baseName}|${
            isHostSelf ? "HOST" : "PARTICIPANT"
        }|${joinInfo.userId}`;

        console.log("[MeetingJoinPage] joinRoom 호출", {
            roomNumber,
            displayName,
            isHostSelf,
            joinInfo,
        });

        joinRoom({ roomNumber, displayName });
    }, [joinInfo, scriptsLoaded, joinRoom]);

    // 3) Janus 연결 완료되면 /participants/join 호출
    useEffect(() => {
        if (!isConnected) return;
        handleJoined();
    }, [isConnected, handleJoined]);

    // 4) 주기적인 ping (백그라운드)
    useEffect(() => {
        if (!meetingId || !sessionKey || terminated) return;

        const interval = setInterval(async () => {
            try {
                const res = await api.post(
                    `/api/meetings/${meetingId}/participants/ping`,
                    { sessionKey }
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
    }, [meetingId, sessionKey, terminated, handleTerminateAndLeave]);

    useEffect(() => {
        leaveRoomRef.current = leaveRoom;
    }, [leaveRoom]);

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

    return (
        <div className="meeting-join-page">
            {/* 상단 헤더 */}
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

            {/* 메인 레이아웃 */}
            <div className="meeting-join-page__main">
                {/* 비디오 영역 */}
                <div className="meeting-video">
                    <div className="meeting-video__main">
                        {/* SOLO 모드 */}
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
                                    mediaStates={mediaStates}
                                />
                            </div>
                        )}

                        {/* FOCUS 모드 */}
                        {mode === "focus" && participants.length >= 2 && (
                            <div className="meeting-video__stage meeting-video__stage--strip">
                                {/* 위: 포커스 */}
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
                                            mediaStates={mediaStates}
                                        />
                                    )}
                                </div>

                                {/* 아래 썸네일 줄 */}
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
                                                    mediaStates={mediaStates}
                                                />
                                            ))}
                                    </div>

                                    <button className="meeting-video__thumb-nav meeting-video__thumb-nav--next">
                                        ›
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* GRID 모드 */}
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
                                            mediaStates={mediaStates}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 참가자 1명일 때 fallback: SOLO */}
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
                                        mediaStates={mediaStates}
                                    />
                                </div>
                            )}
                    </div>

                    {/* 컨트롤 바 */}
                    <div className="meeting-video__controls">
                        <button
                            className={`meeting-video__control-btn ${
                                audioEnabled
                                    ? ""
                                    : "meeting-video__control-btn--off"
                            }`}
                            onClick={toggleAudio}
                            disabled={!isConnected}
                        >
                            {audioEnabled ? "🎙" : "🔇"}
                        </button>

                        <button
                            className={`meeting-video__control-btn ${
                                videoEnabled
                                    ? ""
                                    : "meeting-video__control-btn--off"
                            }`}
                            onClick={toggleVideo}
                            disabled={!isConnected}
                        >
                            {videoEnabled ? "🎥" : "🚫"}
                        </button>

                        {/* 화면 공유 버튼: UX 자리만 잡아두고, 실제 WebRTC 전환은 이후 단계에서 구현 */}
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

                {/* 오른쪽 채팅 패널 */}
                <MeetingChatPanel
                    meetingId={meetingId}
                    joinInfo={joinInfo}
                    terminated={terminated}
                />
            </div>
        </div>
    );
}

// ===== VideoTile: 16:9 고정 + 카메라 OFF 플레이스홀더 + 상태 뱃지 =====

function VideoTile({
    participant,
    variant = "grid",
    isFocused,
    onClick,
    audioEnabled,
    videoEnabled,
    mediaStates = {},
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

        return tracks.some((t) => t.readyState !== "ended");
    };

    const mediaState = participant.userId
        ? mediaStates[participant.userId]
        : null;

    const videoOn = participant.isMe
        ? videoEnabled
        : mediaState && typeof mediaState.video === "boolean"
        ? mediaState.video
        : hasLiveTrack("video");

    const audioOn = participant.isMe
        ? audioEnabled
        : mediaState && typeof mediaState.audio === "boolean"
        ? mediaState.audio
        : hasLiveTrack("audio");

    const showVideo =
        !!videoOn && !!participant.stream && hasLiveTrack("video");
    //  비디오 on/off 또는 스트림이 바뀔 때마다 <video>에 다시 붙여줌

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const Janus = window.Janus;

        // 비디오 OFF 상태면 srcObject 정리
        if (!showVideo) {
            if (el.srcObject) {
                el.srcObject = null;
            }
            return;
        }

        if (!participant?.stream) return;

        try {
            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, participant.stream);
            } else {
                // 혹시 Janus 안 쓸 상황 대비
                el.srcObject = participant.stream;
            }

            const playPromise = el.play && el.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch((err) => {
                    console.warn("[VideoTile] video.play() 실패", err);
                });
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

            {/* 라벨 (비디오 위에도 유지) */}
            {showVideo && (
                <div className="meeting-video__label">
                    {participant.name}
                    {participant.isMe && " · 나"}
                    {participant.isHost && " · 주최자"}
                </div>
            )}

            {/* 마이크 / 카메라 상태 뱃지 */}
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
