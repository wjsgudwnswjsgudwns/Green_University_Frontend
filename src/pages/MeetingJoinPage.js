// src/pages/MeetingJoinPage.js
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
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
import InviteParticipantsModal from "../components/InviteParticipantsModal";

import MediaPanel from "../components/MediaPanel";

function MeetingJoinPage() {
    // =========================================================
    // 1) Router / Refs
    // =========================================================
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const terminatedRef = useRef(false);
    const leaveRoomRef = useRef(null);
    const manualReconnectLockRef = useRef(false);

    // =========================================================
    // 2) UI State
    // =========================================================
    const [error, setError] = useState("");
    const [scriptsLoaded, setScriptsLoaded] = useState(false);

    const [hasJoined, setHasJoined] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteParticipants, setRemoteParticipants] = useState([]);

    const [sessionKey, setSessionKey] = useState(null);
    const [terminated, setTerminated] = useState(false);

    const [sideTab, setSideTab] = useState("chat");
    const [inviteOpen, setInviteOpen] = useState(false);

    const [rosterParticipants, setRosterParticipants] = useState([]);

    // ✅ MediaPanel에 넘길 playNonce(오토플레이 게이트 트리거)
    const [playNonce, setPlayNonce] = useState(0);

    // =========================================================
    // 3) Navigation / joinInfo State
    // =========================================================
    const getNavType = () => {
        const nav = performance.getEntriesByType?.("navigation")?.[0];
        if (nav?.type) return nav.type;

        const legacy = performance.navigation?.type;
        if (legacy === 1) return "reload";
        if (legacy === 2) return "back_forward";
        return "navigate";
    };

    const navType = useMemo(() => getNavType(), []);
    const shouldIgnoreState = navType === "reload";
    const stateJoinInfo = shouldIgnoreState
        ? null
        : location.state?.info || null;

    const [joinInfo, setJoinInfo] = useState(stateJoinInfo);
    const [isLoadingJoinInfo, setIsLoadingJoinInfo] = useState(!stateJoinInfo);

    const currentUserId = joinInfo?.userId || null;

    // =========================================================
    // 4) Presence / Signals Hooks + Bridge Refs
    // =========================================================
    const readyForRealtime = !!meetingId && !!joinInfo && !!currentUserId;
    const readyForPresence = readyForRealtime && !!sessionKey;

    const myDisplayName =
        joinInfo?.displayName || joinInfo?.userName || joinInfo?.nickname || "";

    const presenceMeetingId = readyForPresence ? meetingId : null;
    const presenceUserId = readyForPresence ? currentUserId : null;

    const signalsMeetingId = readyForRealtime ? meetingId : null;
    const signalsUserId = readyForRealtime ? currentUserId : null;

    const { participants: presenceParticipants, presenceConnected } =
        useMeetingPresence(
            presenceMeetingId,
            presenceUserId,
            sessionKey,
            joinInfo
        );

    const {
        mediaStates,
        sendMediaStateNow,
        sendMediaState,
        mediaSignalConnected,
    } = useMeetingMediaSignals(signalsMeetingId, signalsUserId, myDisplayName);

    const sendMediaStateNowRef = useRef(null);
    const sendMediaStateRef = useRef(null);
    const mediaSignalConnectedRef = useRef(false);

    useEffect(() => {
        mediaSignalConnectedRef.current = mediaSignalConnected;
    }, [mediaSignalConnected]);

    useEffect(() => {
        sendMediaStateNowRef.current = sendMediaStateNow;
    }, [sendMediaStateNow]);
    useEffect(() => {
        sendMediaStateRef.current = sendMediaState; // ✅ 추가
    }, [sendMediaState]);
    // =========================================================
    // 5) Presence 안정화 (lastPresenceRef)
    // =========================================================
    const lastPresenceRef = useRef([]);
    useEffect(() => {
        if (
            Array.isArray(presenceParticipants) &&
            presenceParticipants.length > 0
        ) {
            lastPresenceRef.current = presenceParticipants;
        }
    }, [presenceParticipants]);

    // =========================================================
    // 6) Participants ViewModel (parse/sort/merge)
    // =========================================================
    function parseDisplay(display) {
        const text = String(display || "");
        try {
            const obj = JSON.parse(text);
            return {
                name: obj?.name || "참가자",
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
        // 1) remote map 먼저
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

        // 2) effectivePresence
        const effectivePresence = (() => {
            if (!presenceConnected) return lastPresenceRef.current || [];
            return Array.isArray(presenceParticipants)
                ? presenceParticipants
                : [];
        })();

        // ✅ 공통: 내 정보는 항상 "me"로 고정
        const myUserIdNum =
            joinInfo?.userId != null && joinInfo.userId !== ""
                ? Number(joinInfo.userId)
                : null;

        const myName =
            joinInfo?.displayName ||
            joinInfo?.userName ||
            joinInfo?.nickname ||
            "나";

        const myIsHost =
            !!joinInfo?.isHost || joinInfo?.userId === joinInfo?.hostUserId;

        // ✅ presence가 비었어도 me 타일 유지
        if (!effectivePresence || effectivePresence.length === 0) {
            if (!myUserIdNum) return [];
            return [
                {
                    id: "me",
                    userId: myUserIdNum,
                    name: myName,
                    isMe: true,
                    isHost: myIsHost,
                    stream: localStream || null,
                    videoDead: false,
                },
            ];
        }

        const mapped = effectivePresence.map((p, idx) => {
            const userIdNum =
                p.userId != null && p.userId !== "" ? Number(p.userId) : null;

            const isMe =
                userIdNum != null &&
                myUserIdNum != null &&
                userIdNum === myUserIdNum;

            const remoteInfo =
                userIdNum != null ? remoteInfoByUserId.get(userIdNum) : null;

            const stableId = isMe
                ? "me"
                : userIdNum != null
                ? String(userIdNum)
                : `temp-${idx}`;

            return {
                id: stableId,
                userId: userIdNum,
                name: p.displayName || "참가자",
                isMe,
                isHost: p.role === "HOST",
                stream: isMe ? localStream : remoteInfo?.stream || null,
                videoDead: isMe ? false : remoteInfo?.videoDead || false,
            };
        });

        // ✅ 내 타일 강제 유지(순간 누락 방어)
        const hasMeAlready = mapped.some((x) => x.id === "me");
        if (!hasMeAlready && myUserIdNum != null) {
            mapped.unshift({
                id: "me",
                userId: myUserIdNum,
                name: myName,
                isMe: true,
                isHost: myIsHost,
                stream: localStream || null,
                videoDead: false,
            });
        }

        return mapped;
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

    // =========================================================
    // 7) Layout Hook
    // - focus 기본 + 참가자 수 변동으로 mode가 강제 변경되지 않도록 hook도 그 정책으로 맞춰야 함
    // =========================================================
    const {
        mode,
        focusId,
        focusedParticipant,
        switchToGrid,
        switchToFocus,
        handleMainClick,
        handleParticipantClick,
    } = useMeetingLayout(participants);

    // =========================================================
    // 8) Terminate / Leave handlers
    // =========================================================
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

    const handleLeave = useCallback(async () => {
        terminatedRef.current = true;
        setTerminated(true);
        try {
            if (hasJoined) {
                await api.post(`/api/meetings/${meetingId}/participants/leave`);
            }
        } catch (e) {
            console.error("참가자 leave API 실패", e);
        } finally {
            leaveRoomRef.current?.();
            navigate("/meetings");
        }
    }, [hasJoined, meetingId, navigate]);

    // =========================================================
    // 8-1) Roster fetch (joined/invited 목록)
    // =========================================================
    const fetchRosterParticipants = useCallback(async () => {
        if (!meetingId) return;

        try {
            const res = await api.get(
                `/api/meetings/${meetingId}/participants`
            );
            setRosterParticipants(res.data || []);
        } catch (e) {
            console.error("[roster] fetch failed", e);
        }
    }, [meetingId]);

    useEffect(() => {
        fetchRosterParticipants();
    }, [fetchRosterParticipants]);

    const participantRosterView = useMemo(() => {
        const presenceSet = new Set(
            (presenceParticipants || [])
                .map((p) => Number(p.userId))
                .filter((n) => Number.isFinite(n))
        );

        const list = (rosterParticipants || []).map((r) => {
            const userId = Number(r.userId);

            const status = String(
                r.inviteStatus || r.status || "JOINED"
            ).toUpperCase();
            const joined = status === "JOINED";
            const invited = status === "INVITED";

            return {
                userId,
                name: r.displayName || r.name || "참가자",
                role: r.role,
                status,
                online:
                    joined && Number.isFinite(userId)
                        ? presenceSet.has(userId)
                        : false,
                joined,
                invited,
            };
        });

        return {
            joined: list.filter((x) => x.joined),
            invited: list.filter((x) => x.invited),
        };
    }, [rosterParticipants, presenceParticipants]);

    // =========================================================
    // 9) Janus Hook Binding + Controls
    // =========================================================
    const {
        isSupported,
        isConnecting,
        isConnected,
        error: janusError,

        joinRoom,
        leaveRoom,

        localMedia,

        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        getVideoInputs,
        setVideoSource,
        restartScreenShare,
    } = useJanusLocalOnly(undefined, {
        onLocalStream: (stream) => {
            if (!stream) return setLocalStream(null);
            try {
                const cloned = new MediaStream(stream.getTracks());
                setLocalStream(cloned);
            } catch {
                setLocalStream(stream);
            }
        },
        onRemoteParticipantsChanged: (janusRemotes) =>
            setRemoteParticipants(janusRemotes || []),
    });
    const onChangeVideoSource = useCallback(
        (type, deviceId) => setVideoSource?.(type, deviceId),
        [setVideoSource]
    );
    useEffect(() => {
        leaveRoomRef.current = leaveRoom;
    }, [leaveRoom]);

    const uiMedia = useMemo(() => {
        const m = localMedia || {};
        return {
            audio: !!m.audio,
            video: !!m.video,
            videoDeviceLost: !!m.videoDeviceLost,
            noMediaDevices: !!m.noMediaDevices,
            liveAudio: !!m.liveAudio,
            liveVideo: !!m.liveVideo,

            videoSource: m.videoSource || "camera",
            cameraDeviceId: m.cameraDeviceId ?? null,

            screenSoftMuted: !!m.screenSoftMuted,
            screenCapturing: !!m.screenCapturing,

            permissionDeniedVideo: !!m.permissionDeniedVideo,
            permissionDeniedScreen: !!m.permissionDeniedScreen,
        };
    }, [localMedia]);

    // const handleChangeVideoSource = useCallback(
    //     (nextType, deviceId = null) => {
    //         // nextType: "camera" | "screen"
    //         // deviceId: 카메라 선택시만 사용
    //         setVideoSource?.(nextType, deviceId);
    //     },
    //     [setVideoSource]
    // );
    const onToggleAudioUiFirst = useCallback(() => {
        toggleAudio();
    }, [toggleAudio]);

    const onToggleVideoUiFirst = useCallback(() => {
        toggleVideo();
    }, [toggleVideo]);

    const onToggleScreenShareWithSignal = useCallback(() => {
        const isCurrentlyScreen =
            uiMedia.videoSource === "screen" &&
            uiMedia.video === true &&
            uiMedia.screenSoftMuted !== true;

        // 👉 토글 후 의도
        const willBeScreen = !isCurrentlyScreen;

        toggleScreenShare();

        sendMediaStateNowRef.current?.(!!uiMedia.audio, willBeScreen, {
            videoSource: willBeScreen ? "screen" : "camera",
            screenCapturing: willBeScreen,
            screenSoftMuted: false,
            type: "MEDIA_STATE",
            reason: willBeScreen ? "screen-on" : "screen-off",
        });
    }, [toggleScreenShare, uiMedia]);
    const onRestartScreenShareWithSignal = useCallback(() => {
        // 1️⃣ 먼저 OFF 알림
        sendMediaStateNowRef.current?.(!!uiMedia.audio, false, {
            videoSource: "camera",
            screenCapturing: false,
            screenSoftMuted: false,
            type: "MEDIA_STATE",
            reason: "screen-restart-off",
        });

        // 2️⃣ 실제 Janus 재선택 (세션 재생성)
        restartScreenShare();
    }, [restartScreenShare, uiMedia]);

    // =========================================================
    // 10) Signals Send Triggers (simple + stable)
    // =========================================================

    // ✅ 훅이 지원하는 필드만 보냄
    const buildSignalExtra = useCallback((m, reason) => {
        const x = m || {};
        return {
            videoDeviceLost: !!x.videoDeviceLost,
            videoSource: x.videoSource || "camera",
            screenSoftMuted: !!x.screenSoftMuted,
            screenCapturing: !!x.screenCapturing,
            reason,
            type: "MEDIA_STATE",
        };
    }, []);

    const lastSentKeyRef = useRef("");

    useEffect(() => {
        lastSentKeyRef.current = "";
    }, [meetingId]);

    useEffect(() => {
        if (!joinInfo) return;
        if (!mediaSignalConnected) return;
        if (!isConnected) return;

        // ✅ 변화 감지 키 (훅이 관리하는 것만)
        const key = [
            uiMedia.audio ? 1 : 0,
            uiMedia.video ? 1 : 0,
            uiMedia.videoDeviceLost ? 1 : 0,
            // uiMedia.videoSource || "camera",
            // uiMedia.screenSoftMuted ? 1 : 0,
            // uiMedia.screenCapturing ? 1 : 0,
        ].join("|");

        // ✅ 첫 1회는 즉시, 이후는 디바운스
        const isFirst = lastSentKeyRef.current === "";
        const changed = key !== lastSentKeyRef.current;
        if (!changed) return;

        lastSentKeyRef.current = key;

        const extra = buildSignalExtra(
            uiMedia,
            isFirst ? "initial" : "localChanged"
        );

        if (isFirst) {
            sendMediaStateNowRef.current?.(
                !!uiMedia.audio,
                !!uiMedia.video,
                extra
            );
        } else {
            // ✅ 연타/짧은 토글은 디바운스로 처리
            sendMediaStateRef.current?.(
                !!uiMedia.audio,
                !!uiMedia.video,
                extra
            );
        }
    }, [
        joinInfo,
        mediaSignalConnected,
        isConnected,
        uiMedia,
        buildSignalExtra,
    ]);

    // =========================================================
    // 11) Script Loader
    // =========================================================
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

    // =========================================================
    // 12) JoinInfo Fetch
    // =========================================================
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

    // =========================================================
    // 13) Join Flow (Janus -> REST)
    // =========================================================
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

        const isHostSelfNow =
            !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

        const displayName = JSON.stringify({
            name: baseName,
            role: isHostSelfNow ? "HOST" : "PARTICIPANT",
            userId: joinInfo.userId,
        });

        joinRoom({ roomNumber, displayName });
    }, [joinInfo, scriptsLoaded, joinRoom]);

    useEffect(() => {
        if (!isConnected) return;
        if (hasJoined) return;
        if (terminatedRef.current) return;
        handleJoined();
    }, [isConnected, hasJoined, handleJoined]);

    useEffect(() => {
        if (hasJoined && !sessionKey && !terminatedRef.current) {
            handleTerminateAndLeave(
                "세션 정보가 유효하지 않아 회의에서 자동으로 나갑니다. 다시 접속해 주세요."
            );
        }
    }, [hasJoined, sessionKey, handleTerminateAndLeave]);

    // =========================================================
    // 14) Keepalive / Ping
    // =========================================================
    useEffect(() => {
        if (!meetingId) return;
        if (!hasJoined) return;
        if (!sessionKey) return;

        const onPageHide = () => {
            if (terminatedRef.current) return;
            terminatedRef.current = true;
            setTerminated(true);

            const token = localStorage.getItem("token");

            fetch(`/api/meetings/${meetingId}/participants/leave-keepalive`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ sessionKey }),
                keepalive: true,
            }).catch(() => {});

            try {
                leaveRoomRef.current?.();
            } catch {}
        };

        window.addEventListener("pagehide", onPageHide);
        return () => window.removeEventListener("pagehide", onPageHide);
    }, [meetingId, hasJoined, sessionKey]);

    useEffect(() => {
        if (!meetingId) return;
        if (!sessionKey) return;
        if (terminated) return;

        let alive = true;

        const tick = async () => {
            if (!alive) return;
            if (terminatedRef.current) return;

            try {
                const res = await api.post(
                    `/api/meetings/${meetingId}/participants/ping`,
                    {
                        sessionKey,
                    }
                );

                const { active, reason } = res.data || {};
                if (!active) {
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
                }
            } catch (e) {
                console.error("회의 상태 ping 실패", e);
            }
        };

        tick();
        const interval = setInterval(tick, 10000);

        return () => {
            alive = false;
            clearInterval(interval);
        };
    }, [meetingId, sessionKey, terminated, handleTerminateAndLeave]);

    // =========================================================
    // 15) Render helpers
    // =========================================================
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

    const isHostSelfRender =
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
                    <button
                        onClick={handleLeave}
                        className="meeting-join-page__leave-button"
                    >
                        회의 나가기
                    </button>
                </div>
            </div>

            <div className="meeting-join-page__main">
                <MediaPanel
                    participants={participants}
                    sortedParticipants={sortedParticipants}
                    mode={mode}
                    focusId={focusId}
                    focusedParticipant={focusedParticipant}
                    handleParticipantClick={handleParticipantClick}
                    onMainClick={handleMainClick}
                    uiMedia={uiMedia}
                    mediaStates={mediaStates}
                    playNonce={playNonce}
                    setPlayNonce={setPlayNonce}
                    onToggleAudio={onToggleAudioUiFirst}
                    onToggleVideo={onToggleVideoUiFirst}
                    onToggleScreenShare={onToggleScreenShareWithSignal}
                    onLeave={handleLeave}
                    isConnected={isConnected}
                    isConnecting={isConnecting}
                    getVideoInputs={getVideoInputs}
                    onChangeVideoSource={onChangeVideoSource}
                    onRestartScreenShare={onRestartScreenShareWithSignal}
                />

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
                                joined={(
                                    participantRosterView?.joined || []
                                ).map((p) => ({
                                    id: String(p.userId),
                                    name: p.name,
                                    isMe:
                                        Number(p.userId) ===
                                        Number(joinInfo?.userId),
                                    isHost: p.role === "HOST",
                                    online: !!p.online,
                                }))}
                                invited={(
                                    participantRosterView?.invited || []
                                ).map((p) => ({
                                    id: String(p.userId),
                                    name: p.name,
                                    isHost: p.role === "HOST",
                                }))}
                                isHost={isHostSelfRender}
                                onInvite={() => setInviteOpen(true)}
                            />

                            <InviteParticipantsModal
                                open={inviteOpen}
                                onClose={() => setInviteOpen(false)}
                                meetingId={meetingId}
                                onInvited={() => {
                                    // 필요하면 여기서 fetchRosterParticipants() 호출
                                    // fetchRosterParticipants();
                                }}
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

export default MeetingJoinPage;
