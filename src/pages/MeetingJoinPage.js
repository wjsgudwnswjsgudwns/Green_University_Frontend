// src/pages/MeetingJoinPage.js
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles/MeetingJoinPage.css";
import { useJanusLocalOnly } from "../hooks/useJanusLocalOnly";
import MeetingChatPanel from "../components/MeetingChatPanel";

function MeetingJoinPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // 이미 종료 처리했는지 여부 (재진입 방지)
    const terminatedRef = useRef(false);
    const leaveRoomRef = useRef(null);

    // MeetingDetailPage 에서 넘긴 state (info)
    const stateJoinInfo = location.state?.info || null;

    const [joinInfo, setJoinInfo] = useState(stateJoinInfo);
    const [error, setError] = useState("");
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isLoadingJoinInfo, setIsLoadingJoinInfo] = useState(!stateJoinInfo);
    const [hasJoined, setHasJoined] = useState(false); // /join 성공 여부

    const [sessionKey, setSessionKey] = useState(null);
    const [terminated, setTerminated] = useState(false); // 종료 처리 상태

    // terminated 상태를 ref와 동기화
    useEffect(() => {
        terminatedRef.current = terminated;
    }, [terminated]);

    // 회의 종료 공통 처리: 먼저 나가기 → 그 다음 알럿
    const handleTerminateAndLeave = useCallback(
        (msg) => {
            if (terminatedRef.current) return; // 이미 처리됨

            terminatedRef.current = true;
            setTerminated(true);

            try {
                leaveRoomRef.current?.();
            } catch (e) {
                console.error("leaveRoom 호출 중 오류", e);
            }

            // 디버깅 로그
            console.log("[handleTerminateAndLeave] called with msg:", msg);

            // ✅ 비동기 콜백 안에서 React Router랑 부딪히지 않도록
            //    alert + navigate 둘 다 setTimeout 안으로 묶어서 실행
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

    // Janus 훅
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
        onRemoteParticipantsChanged: async () => {
            console.log(
                "[MeetingJoinPage] remoteParticipantsChanged, meetingId=",
                meetingId,
                "sessionKey=",
                sessionKey,
                "hasJoined=",
                hasJoined
            );

            if (terminatedRef.current) return;

            if (!meetingId) {
                handleTerminateAndLeave(
                    "회의 정보가 유효하지 않아 회의에서 나갑니다."
                );
                return;
            }

            // ✅ 이미 join 한 적 있는데 세션키가 없다 → 비정상 세션 → 강제 퇴장
            if (!sessionKey && hasJoined) {
                handleTerminateAndLeave(
                    "세션 정보가 유실되어 회의에서 나갑니다. 다시 접속해 주세요."
                );
                return;
            }

            // 아직 join 전(초기 접속 중)인데 세션키가 없는 건 무시
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
                // 여기선 네트워크 오류는 그냥 무시 (백그라운드 interval ping이 있으니까)
            }
        },
    });

    // 세션키가 join 이후에 유실되면 비정상으로 보고 내보내기 (백업용)
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

    // 1) join-info 없으면 백엔드에서 다시 가져오기
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
        const displayName =
            joinInfo.displayName ||
            joinInfo.userName ||
            joinInfo.nickname ||
            "User";

        console.log("[MeetingJoinPage] joinRoom 호출", {
            roomNumber,
            displayName,
        });

        joinRoom({ roomNumber, displayName });
    }, [joinInfo, scriptsLoaded, joinRoom]);

    // Janus 연결 완료되면 /participants/join 호출
    useEffect(() => {
        if (!isConnected) return;
        handleJoined();
    }, [isConnected, handleJoined]);

    // 주기적으로 세션 유효 여부 / 회의 상태 체크 (백그라운드용)
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
                <button
                    onClick={handleLeave}
                    className="meeting-join-page__leave-button"
                >
                    회의 나가기
                </button>
            </div>

            {/* 메인 레이아웃 */}
            <div className="meeting-join-page__main">
                {/* 비디오 영역 */}
                <div id="videos" className="meeting-video">
                    <div className="meeting-video__grid">
                        <div id="videolocal" className="meeting-video__local">
                            <div className="meeting-video__label">나</div>
                        </div>

                        <div
                            id="remote-grid"
                            className="meeting-video__remote-grid"
                        />
                    </div>

                    {/* 컨트롤 바 */}
                    <div className="meeting-video__controls">
                        <button
                            id="btn-toggle-mic"
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
                            id="btn-toggle-camera"
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

                        <button
                            id="btn-screen-share"
                            className="meeting-video__control-btn"
                            disabled
                        >
                            🖥
                        </button>

                        <button
                            id="btn-end-call"
                            className="meeting-video__control-btn meeting-video__control-btn--danger"
                            onClick={handleLeave}
                            disabled={!isConnected && !isConnecting}
                        >
                            ⏹
                        </button>
                    </div>
                </div>

                {/* 오른쪽 채팅/참가자 패널 */}
                <MeetingChatPanel
                    meetingId={meetingId}
                    joinInfo={joinInfo}
                    terminated={terminated}
                />
            </div>
        </div>
    );
}

export default MeetingJoinPage;
