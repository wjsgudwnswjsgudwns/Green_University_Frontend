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

    const { mediaStates, sendMediaStateNow, mediaSignalConnected } =
        useMeetingMediaSignals(signalsMeetingId, signalsUserId, myDisplayName);

    const sendMediaStateNowRef = useRef(null);
    const mediaSignalConnectedRef = useRef(false);

    useEffect(() => {
        mediaSignalConnectedRef.current = mediaSignalConnected;
    }, [mediaSignalConnected]);

    useEffect(() => {
        sendMediaStateNowRef.current = sendMediaStateNow;
    }, [sendMediaStateNow]);

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

        // 2) effectivePresence 먼저
        const effectivePresence = (() => {
            if (!presenceConnected) return lastPresenceRef.current || [];
            return Array.isArray(presenceParticipants)
                ? presenceParticipants
                : [];
        })();

        // 3) 이제 로그
        console.log(
            "[presence] userId type:",
            typeof effectivePresence?.[0]?.userId,
            effectivePresence?.[0]?.userId
        );
        console.log(
            "[remote] parsed keys:",
            [...remoteInfoByUserId.keys()].slice(0, 5)
        );

        const firstUid = effectivePresence?.[0]?.userId;
        const firstUidNum =
            firstUid != null && firstUid !== "" ? Number(firstUid) : null;

        console.log(
            "[lookup test]",
            firstUid,
            "num=",
            firstUidNum,
            "=>",
            firstUidNum != null ? remoteInfoByUserId.get(firstUidNum) : null
        );

        // presence가 아직 없으면 "나"만이라도 보여주기
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
                    userId: Number(joinInfo.userId),
                    stream: localStream || null,
                    videoDead: false,
                },
            ];
        }

        // 4) 매핑 (정규화 적용)
        return effectivePresence.map((p, idx) => {
            const userIdNum =
                p.userId != null && p.userId !== "" ? Number(p.userId) : null;

            const uid = userIdNum != null ? userIdNum : `temp-${idx}`;

            const isMe =
                userIdNum != null &&
                joinInfo?.userId != null &&
                userIdNum === Number(joinInfo.userId);

            const remoteInfo =
                userIdNum != null ? remoteInfoByUserId.get(userIdNum) : null;

            return {
                id: isMe ? "me" : String(uid),
                userId: userIdNum,
                name: p.displayName || "참가자",
                isMe,
                isHost: p.role === "HOST",
                stream: isMe ? localStream : remoteInfo?.stream || null,
                videoDead: isMe ? false : remoteInfo?.videoDead || false,
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

    // =========================================================
    // 7) Layout Hook
    // =========================================================
    const {
        mode,
        focusId,
        focusedParticipant,
        switchToGrid,
        switchToFocus,
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
            leaveRoomRef.current?.();
            navigate("/meetings");
        }
    };

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

        noMediaDevices,
        localMedia,

        toggleAudio,
        toggleVideo,
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
        };
    }, [localMedia]);

    const onToggleAudioUiFirst = useCallback(() => {
        // ✅ 유저 제스처: 마이크 ON/OFF
        toggleAudio();
    }, [toggleAudio]);

    const onToggleVideoUiFirst = useCallback(() => {
        toggleVideo();
    }, [toggleVideo]);

    // =========================================================
    // 9-1) Autoplay Gate (유저 제스처로만 해결)
    // =========================================================
    const [autoplayGateOpen, setAutoplayGateOpen] = useState(false);
    const [playNonce, setPlayNonce] = useState(0);

    const autoplayGateShownRef = useRef(false);

    const openAutoplayGate = useCallback(() => {
        if (autoplayGateShownRef.current) return;
        autoplayGateShownRef.current = true;
        setAutoplayGateOpen(true);
    }, []);

    const requestUserGesturePlay = useCallback(() => {
        // ✅ 이 클릭이 “유저 제스처”
        setPlayNonce((n) => n + 1);
        setAutoplayGateOpen(false);
    }, []);

    // =========================================================
    // 10) Signals Send Triggers
    // =========================================================
    const broadcastMyMediaState = useCallback(
        (reason = "unknown") => {
            if (!mediaSignalConnectedRef.current) return;
            if (!isConnected) return;

            const fn = sendMediaStateNowRef.current;
            if (!fn) return;

            fn(!!uiMedia.audio, !!uiMedia.video, {
                videoDeviceLost: !!uiMedia.videoDeviceLost,
                noMediaDevices: !!uiMedia.noMediaDevices,
                reason,
            });
        },
        [isConnected, uiMedia]
    );

    const broadcastCtlRef = useRef({
        didInitial: false,
        lastLocalKey: "",
        lastPresenceKey: "",
        lastSentAt: 0,
    });

    useEffect(() => {
        broadcastCtlRef.current = {
            didInitial: false,
            lastLocalKey: "",
            lastPresenceKey: "",
            lastSentAt: 0,
        };
    }, [meetingId]);

    useEffect(() => {
        if (!joinInfo) return;
        if (!mediaSignalConnected) return;
        if (!isConnected) return;

        const makeLocalKey = (m) => {
            const x = m || {};
            return [
                x.audio ? 1 : 0,
                x.video ? 1 : 0,
                x.videoDeviceLost ? 1 : 0,
                x.noMediaDevices ? 1 : 0,
            ].join("|");
        };

        const makePresenceKey = (list) => {
            return (list || [])
                .map((p) => p.userId)
                .filter(Boolean)
                .slice()
                .sort((a, b) => a - b)
                .join(",");
        };

        const ctl = broadcastCtlRef.current;
        const now = Date.now();

        const localKey = makeLocalKey(uiMedia);
        const presenceKey = makePresenceKey(presenceParticipants);

        if (!ctl.didInitial) {
            ctl.didInitial = true;
            ctl.lastLocalKey = localKey;
            ctl.lastPresenceKey = presenceKey;
            ctl.lastSentAt = now;
            broadcastMyMediaState("initial");
            return;
        }

        const localChanged = localKey !== ctl.lastLocalKey;
        const presenceChanged = presenceKey !== ctl.lastPresenceKey;

        const throttleOk = now - (ctl.lastSentAt || 0) >= 400;
        if (!throttleOk) return;

        if (localChanged || presenceChanged) {
            ctl.lastLocalKey = localKey;
            ctl.lastPresenceKey = presenceKey;
            ctl.lastSentAt = now;

            broadcastMyMediaState(
                localChanged ? "localMediaChanged" : "presenceChanged"
            );
        }
    }, [
        joinInfo,
        mediaSignalConnected,
        isConnected,
        uiMedia,
        presenceParticipants,
        broadcastMyMediaState,
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

        const isHostSelf =
            !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

        const displayName = JSON.stringify({
            name: baseName,
            role: isHostSelf ? "HOST" : "PARTICIPANT",
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
                    { sessionKey }
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

    const isHostSelf =
        !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

    return (
        <div className="meeting-join-page">
            {/* ✅ 오토플레이 게이트: 유저 제스처 버튼 */}
            {autoplayGateOpen && (
                <AutoplayGate
                    onConfirm={requestUserGesturePlay}
                    onClose={() => setAutoplayGateOpen(false)}
                />
            )}

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
                                    localMedia={uiMedia}
                                    mediaStates={mediaStates}
                                    playNonce={playNonce}
                                    onAutoplayBlocked={openAutoplayGate}
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
                                            localMedia={uiMedia}
                                            mediaStates={mediaStates}
                                            playNonce={playNonce}
                                            onAutoplayBlocked={openAutoplayGate}
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
                                                    localMedia={uiMedia}
                                                    mediaStates={mediaStates}
                                                    playNonce={playNonce}
                                                    onAutoplayBlocked={
                                                        openAutoplayGate
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
                                            localMedia={uiMedia}
                                            mediaStates={mediaStates}
                                            playNonce={playNonce}
                                            onAutoplayBlocked={openAutoplayGate}
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
                                        localMedia={uiMedia}
                                        mediaStates={mediaStates}
                                        playNonce={playNonce}
                                        onAutoplayBlocked={openAutoplayGate}
                                    />
                                </div>
                            )}
                    </div>

                    {uiMedia.noMediaDevices && (
                        <div className="meeting-video__device-message">
                            현재 브라우저에 마이크·카메라가 연결되지 않은
                            상태입니다.
                        </div>
                    )}

                    <div className="meeting-video__controls">
                        <button
                            className={`meeting-video__control-btn ${
                                uiMedia.audio
                                    ? ""
                                    : "meeting-video__control-btn--off"
                            }`}
                            onClick={onToggleAudioUiFirst}
                            title="마이크 토글"
                        >
                            {uiMedia.audio ? "🎙" : "🔇"}
                        </button>

                        <button
                            className={`meeting-video__control-btn ${
                                uiMedia.video
                                    ? ""
                                    : "meeting-video__control-btn--off"
                            }`}
                            onClick={onToggleVideoUiFirst}
                            title="카메라 토글"
                        >
                            {uiMedia.video ? "🎥" : "🚫"}
                        </button>

                        <button
                            className="meeting-video__control-btn"
                            onClick={() => {
                                if (manualReconnectLockRef.current) return;
                                manualReconnectLockRef.current = true;

                                try {
                                    leaveRoomRef.current?.();
                                } catch {}

                                const roomNumber = joinInfo.roomNumber;

                                const displayName = JSON.stringify({
                                    name: joinInfo.displayName || "User",
                                    role: isHostSelf ? "HOST" : "PARTICIPANT",
                                    userId: joinInfo.userId,
                                });

                                window.setTimeout(() => {
                                    joinRoom({ roomNumber, displayName });
                                    manualReconnectLockRef.current = false;
                                }, 500);
                            }}
                            title="수동 재연결"
                        >
                            🔄
                        </button>

                        <button
                            className="meeting-video__control-btn meeting-video__control-btn--danger"
                            onClick={handleLeave}
                            disabled={!isConnected && !isConnecting}
                            title="나가기"
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

// =========================================================
// AutoplayGate (유저 제스처 모달)
// =========================================================
function AutoplayGate({ onConfirm, onClose }) {
    return (
        <div
            style={{
                position: "fixed",
                zIndex: 9999,
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "min(520px, 100%)",
                    background: "#111",
                    color: "#fff",
                    borderRadius: 12,
                    padding: 16,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                    브라우저 자동재생이 차단되었습니다
                </div>
                <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
                    영상/오디오 재생을 시작하려면 한 번의 사용자 조작이
                    필요합니다.
                    <br />
                    아래 버튼을 눌러 재생을 시작해 주세요.
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 14,
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.25)",
                            background: "transparent",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        닫기
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.25)",
                            background: "#fff",
                            color: "#000",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                    >
                        재생 시작
                    </button>
                </div>
            </div>
        </div>
    );
}

// =========================================================
// VideoTile (실무형: video는 muted autoplay, audio는 별도 <audio>로 분리)
// =========================================================
function VideoTile({
    participant,
    variant = "grid",
    isFocused,
    onClick,
    localMedia,
    mediaStates = {},
    playNonce,
    onAutoplayBlocked,
}) {
    const noMediaDevices = !!localMedia?.noMediaDevices;
    const audioEnabled = !!localMedia?.audio; // 내 "마이크 송출" 상태
    const videoEnabled = !!localMedia?.video;
    const isVideoDeviceLost = !!localMedia?.videoDeviceLost;

    const videoRef = useRef(null);
    const audioRef = useRef(null);

    // ✅ stream 내부 변화(addtrack/unmute 등)에도 UI가 반응하게 만드는 트리거
    const [streamTick, setStreamTick] = useState(0);
    const bumpStreamTick = useCallback(() => setStreamTick((n) => n + 1), []);

    const getTracks = useCallback((stream, kind) => {
        if (!stream) return [];
        try {
            return kind === "video"
                ? stream.getVideoTracks?.() || []
                : stream.getAudioTracks?.() || [];
        } catch {
            return [];
        }
    }, []);

    const hasAnyTrack = useCallback(
        (kind) => {
            const s = participant?.stream;
            if (!s) return false;
            return getTracks(s, kind).length > 0;
        },
        [participant?.stream, getTracks]
    );

    const mediaState = participant?.userId
        ? mediaStates[participant.userId]
        : null;

    const isKnown =
        mediaState &&
        (mediaState.known === true ||
            typeof mediaState.receivedAt === "number");

    const remoteDeviceLost = !!mediaState?.videoDeviceLost;

    // ✅ 핵심 수정:
    // - signal이 오기 전(isKnown=false)에는 "live"가 아니라 "track 존재"로 ON 판정
    // - 즉, 새로 들어온 참가자도 video track만 있으면 바로 켜진 것으로 취급
    const videoOn = participant?.isMe
        ? videoEnabled && !isVideoDeviceLost && !noMediaDevices
        : !remoteDeviceLost &&
          (isKnown && typeof mediaState.video === "boolean"
              ? mediaState.video
              : hasAnyTrack("video"));

    const audioOn = participant?.isMe
        ? audioEnabled && !noMediaDevices
        : isKnown && typeof mediaState.audio === "boolean"
        ? mediaState.audio
        : hasAnyTrack("audio");

    const showVideo =
        !!videoOn && !!participant?.stream && hasAnyTrack("video");

    const canHearRemote =
        !participant?.isMe &&
        !!participant?.stream &&
        getTracks(participant.stream, "audio").length > 0;

    const isAutoplayBlockedError = (err) => {
        const name = err?.name || "";
        const msg = String(err?.message || "").toLowerCase();
        return (
            name === "NotAllowedError" ||
            msg.includes("notallowed") ||
            msg.includes("play() failed") ||
            msg.includes("user gesture") ||
            msg.includes("gesture")
        );
    };

    const tryPlayEl = useCallback(
        (el) => {
            if (!el) return;
            const p = el.play?.();
            if (p && p.catch) {
                p.catch((err) => {
                    if (isAutoplayBlockedError(err)) {
                        onAutoplayBlocked?.();
                    }
                });
            }
        },
        [onAutoplayBlocked]
    );

    const tryPlay = useCallback(() => {
        tryPlayEl(videoRef.current);
        if (!participant?.isMe) tryPlayEl(audioRef.current);
    }, [tryPlayEl, participant?.isMe]);

    // ✅ stream 내부 변화(addtrack/unmute/mute/ended)에 반응해서 UI 재평가
    useEffect(() => {
        const s = participant?.stream;
        if (!s) return;

        const onAddTrack = () => bumpStreamTick();

        s.addEventListener?.("addtrack", onAddTrack);

        const bindTrack = (t) => {
            if (!t) return;
            const prevUnmute = t.onunmute;
            const prevMute = t.onmute;
            const prevEnded = t.onended;

            t.onunmute = (...args) => {
                bumpStreamTick();
                if (typeof prevUnmute === "function") prevUnmute(...args);
            };
            t.onmute = (...args) => {
                bumpStreamTick();
                if (typeof prevMute === "function") prevMute(...args);
            };
            t.onended = (...args) => {
                bumpStreamTick();
                if (typeof prevEnded === "function") prevEnded(...args);
            };

            return () => {
                // 원복은 선택사항(대부분 문제 없음). 안전하게 하려면 저장/복원 로직을 더 둬도 됨.
            };
        };

        const tracks = [...getTracks(s, "video"), ...getTracks(s, "audio")];
        tracks.forEach(bindTrack);

        // 초기 1회도 갱신(중간 참여 직후 첫 프레임 보정)
        bumpStreamTick();

        return () => {
            s.removeEventListener?.("addtrack", onAddTrack);
        };
    }, [participant?.stream, bumpStreamTick, getTracks]);

    // stream attach (video)
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
            // ✅ video는 항상 muted로 (원격도 muted)
            el.muted = true;

            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, participant.stream);
            } else {
                el.srcObject = participant.stream;
            }
            tryPlayEl(el);
        } catch (e) {
            console.error("[VideoTile] video attach 실패", e);
        }
        // ✅ streamTick 포함: track 상태 변화에도 재시도
    }, [participant?.stream, showVideo, tryPlayEl, streamTick]);

    // stream attach (audio - remote only)
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const Janus = window.Janus;

        if (participant?.isMe) {
            if (el.srcObject) el.srcObject = null;
            return;
        }

        if (!participant?.stream) return;

        try {
            el.muted = false;

            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, participant.stream);
            } else {
                el.srcObject = participant.stream;
            }

            if (canHearRemote) tryPlayEl(el);
        } catch (e) {
            console.error("[VideoTile] audio attach 실패", e);
        }
        // ✅ streamTick 포함
    }, [
        participant?.stream,
        participant?.isMe,
        canHearRemote,
        tryPlayEl,
        streamTick,
    ]);

    // 유저 제스처(게이트 버튼) 이후 재시도
    useEffect(() => {
        if (!participant?.stream) return;
        tryPlay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playNonce]);

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

    const handleClick = () => {
        tryPlay(); // 타일 클릭도 유저 제스처로 재시도
        onClick?.();
    };

    return (
        <div className={classes} onClick={handleClick}>
            <audio
                ref={audioRef}
                autoPlay
                playsInline
                style={{ display: "none" }}
            />

            {showVideo ? (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="meeting-video__video"
                    />
                    <div className="meeting-video__label">
                        {participant.name}
                        {participant.isMe && " · 나"}
                        {participant.isHost && " · 주최자"}
                    </div>
                </>
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
