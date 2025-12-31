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
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const terminatedRef = useRef(false);
    const leaveRoomRef = useRef(null);

    // ✅ resync용: 마지막 join 인자 + joinRoom 함수 참조
    const joinRoomRef = useRef(null);
    const lastJoinArgsRef = useRef(null);

    // =========================================================
    // UI State
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

    // ✅ MediaPanel autoplay gate
    const [playNonce, setPlayNonce] = useState(0);

    // =========================================================
    // UI click-lock
    // =========================================================
    const uiLockUntilRef = useRef(0);
    const lockUi = useCallback((ms = 1200) => {
        uiLockUntilRef.current = Date.now() + ms;
    }, []);
    const isUiLocked = useCallback(
        () => Date.now() < uiLockUntilRef.current,
        []
    );

    // =========================================================
    // joinInfo
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
    // Presence / Signals
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
        sendMediaStateRef.current = sendMediaState;
    }, [sendMediaState]);

    // =========================================================
    // Presence 안정화
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
    // Participants ViewModel
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

        const effectivePresence = (() => {
            if (!presenceConnected) return lastPresenceRef.current || [];
            return Array.isArray(presenceParticipants)
                ? presenceParticipants
                : [];
        })();

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
    // Layout Hook
    // =========================================================
    const {
        mode,
        focusId,
        focusedParticipant,
        handleMainClick,
        handleParticipantClick,
    } = useMeetingLayout(participants);

    // =========================================================
    // Terminate / Leave
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
    // Roster fetch
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
    // Janus Hook
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

        // ✅ 토글(soft on/off)은 이걸 사용
        toggleScreenShare,
        // ✅ 드롭(재선택)은 기존 로직 유지 (아래 requestHardSwitch 경로)
        restartScreenShare,

        getVideoInputs,
        setVideoSource,
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
        joinRoomRef.current = joinRoom;
    }, [joinRoom]);

    useEffect(() => {
        leaveRoomRef.current = leaveRoom;
    }, [leaveRoom]);

    const uiMedia = useMemo(() => {
        const m = localMedia || {};
        return {
            audio: !!m.audio,
            video: !!m.video,

            liveAudio: !!m.liveAudio,
            liveVideo: !!m.liveVideo,

            videoDeviceLost: !!m.videoDeviceLost,
            noMediaDevices: !!m.noMediaDevices,

            videoSource: m.videoSource || "camera",
            cameraDeviceId: m.cameraDeviceId ?? null,

            screenSoftMuted: !!m.screenSoftMuted,
            screenCapturing: !!m.screenCapturing,

            permissionDeniedVideo: !!m.permissionDeniedVideo,
            permissionDeniedScreen: !!m.permissionDeniedScreen,
        };
    }, [localMedia]);

    // =========================================================
    // Signals helper
    // =========================================================
    const buildSignalExtra = useCallback((m, reason, phase, extra2 = {}) => {
        const x = m || {};
        return {
            type: "MEDIA_STATE",
            phase,
            videoDeviceLost: !!x.videoDeviceLost,
            videoSource: x.videoSource || "camera",
            screenSoftMuted: !!x.screenSoftMuted,
            screenCapturing: !!x.screenCapturing,
            reason,
            ...extra2,
        };
    }, []);

    const sendIntent = useCallback(
        (nextAudio, nextVideo, predictedUiMedia, reason = "intent") => {
            if (!joinInfo) return;
            if (!mediaSignalConnectedRef.current) return;
            const fn = sendMediaStateNowRef.current;
            if (!fn) return;

            const extra = buildSignalExtra(predictedUiMedia, reason, "intent");
            fn(!!nextAudio, !!nextVideo, extra);
        },
        [joinInfo, buildSignalExtra]
    );

    // =========================================================
    // ✅ 드롭/모드전환용 하드 리조인 로직 (그대로 유지)
    // =========================================================
    const pendingAfterJoinRef = useRef(null); // { source, deviceId, ensureVideo, reason }
    const rejoinSeqRef = useRef(0);

    const hardRejoin = useCallback(
        (reason = "hard-rejoin") => {
            if (terminatedRef.current) return;
            const args = lastJoinArgsRef.current;
            if (!args) return;

            const seq = ++rejoinSeqRef.current;

            lockUi(1800);
            setPlayNonce((n) => n + 1);

            try {
                leaveRoomRef.current?.();
            } catch {}

            window.setTimeout(() => {
                if (terminatedRef.current) return;
                if (seq !== rejoinSeqRef.current) return;
                joinRoomRef.current?.(args);
            }, 250);
        },
        [lockUi]
    );

    const requestHardSwitch = useCallback(
        (source, deviceId, reason) => {
            if (isUiLocked()) return;

            const predicted = {
                ...uiMedia,
                videoSource: source,
                screenCapturing: source === "screen",
                screenSoftMuted: false,
            };
            const predictedVideo = true;
            sendIntent(uiMedia.audio, predictedVideo, predicted, reason);

            pendingAfterJoinRef.current = {
                source,
                deviceId: deviceId || null,
                ensureVideo: true,
                reason,
            };

            try {
                sendMediaStateNowRef.current?.(
                    uiMedia.audio,
                    predictedVideo,
                    buildSignalExtra(predicted, `commit:${reason}`, "commit", {
                        forceResync: true,
                    })
                );
            } catch {}

            hardRejoin(reason);
        },
        [isUiLocked, uiMedia, sendIntent, hardRejoin, buildSignalExtra]
    );

    useEffect(() => {
        if (!isConnected) return;
        const p = pendingAfterJoinRef.current;
        if (!p) return;
        pendingAfterJoinRef.current = null;

        window.setTimeout(() => {
            if (terminatedRef.current) return;

            if (p.source === "screen") {
                setVideoSource?.("screen");
            } else {
                const did = p.deviceId || uiMedia.cameraDeviceId || null;
                setVideoSource?.("camera", did);
            }

            if (p.ensureVideo && !uiMedia.video) {
                toggleVideo?.();
            }

            setPlayNonce((n) => n + 1);

            try {
                const predicted2 = {
                    ...uiMedia,
                    videoSource: p.source,
                    screenCapturing: p.source === "screen",
                    screenSoftMuted: false,
                };
                sendMediaStateNowRef.current?.(
                    uiMedia.audio,
                    true,
                    buildSignalExtra(
                        predicted2,
                        `post-join:${p.reason}`,
                        "commit",
                        { forceResync: true }
                    )
                );
                window.setTimeout(() => {
                    sendMediaStateNowRef.current?.(
                        uiMedia.audio,
                        true,
                        buildSignalExtra(
                            predicted2,
                            `post-join:${p.reason}:t1`,
                            "commit",
                            { forceResync: true }
                        )
                    );
                }, 900);
            } catch {}
        }, 450);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    useEffect(() => {
        pendingAfterJoinRef.current = null;
        rejoinSeqRef.current = 0;
    }, [meetingId]);

    // =========================================================
    // UI handlers
    // =========================================================
    const onToggleAudioUiFirst = useCallback(() => {
        if (isUiLocked()) return;
        lockUi(350);

        const nextAudio = !uiMedia.audio;
        sendIntent(nextAudio, uiMedia.video, uiMedia, "click-audio");

        toggleAudio();
    }, [toggleAudio, isUiLocked, lockUi, uiMedia, sendIntent]);

    const onToggleVideoUiFirst = useCallback(() => {
        if (isUiLocked()) return;
        lockUi(700);

        const nextVideo = !uiMedia.video;
        sendIntent(uiMedia.audio, nextVideo, uiMedia, "click-video");

        toggleVideo();
    }, [toggleVideo, isUiLocked, lockUi, uiMedia, sendIntent]);

    // =========================================================
    // ✅ 핵심 수정: "토글(soft on/off)"만 고침
    // - 드롭(재선택/교체) 로직은 아래 onRestart/onChange 그대로 둠
    // =========================================================
    const onToggleScreenShareWithSignal = useCallback(() => {
        if (isUiLocked()) return;
        lockUi(1100);

        const isScreen = uiMedia.videoSource === "screen";
        const capturing = !!uiMedia.screenCapturing;
        const softMuted = !!uiMedia.screenSoftMuted;

        // ✅ 토글 의도 예측 (soft on/off)
        // 1) camera -> screen 시작
        // 2) screen (on) -> stop(=camera로 복귀 예상)  /  or screen (softOff) -> resume
        let predicted = { ...uiMedia };
        let predictedVideo = !!uiMedia.video;
        let reason = "screen-toggle";

        if (!isScreen) {
            // camera -> start screen (picker는 훅 내부)
            predicted = {
                ...uiMedia,
                videoSource: "screen",
                screenCapturing: true,
                screenSoftMuted: false,
            };
            predictedVideo = true; // 공유 시작 의도는 "보이게"
            reason = "screen-on";
        } else {
            if (capturing && softMuted) {
                // screen soft-off -> resume
                predicted = {
                    ...uiMedia,
                    videoSource: "screen",
                    screenCapturing: true,
                    screenSoftMuted: false,
                };
                predictedVideo = true;
                reason = "screen-resume";
            } else if (capturing && !softMuted) {
                // screen on -> off (대부분 camera로 복귀)
                predicted = {
                    ...uiMedia,
                    videoSource: "camera",
                    screenCapturing: false,
                    screenSoftMuted: false,
                };
                // video는 사용자가 켜둔 상태 유지(대부분 true)
                predictedVideo = !!uiMedia.video;
                reason = "screen-off";
            } else {
                // screen인데 capturing이 false인 이상 케이스 -> 다시 on 의도
                predicted = {
                    ...uiMedia,
                    videoSource: "screen",
                    screenCapturing: true,
                    screenSoftMuted: false,
                };
                predictedVideo = true;
                reason = "screen-on(recover)";
            }
        }

        // ✅ 상대 UI 즉시 반영(예고)
        sendIntent(uiMedia.audio, predictedVideo, predicted, reason);

        // ✅ 실제 토글 (세션 유지 / soft on/off)
        toggleScreenShare?.();

        // ✅ autoplay gate도 같이 한번
        setPlayNonce((n) => n + 1);
    }, [isUiLocked, lockUi, uiMedia, sendIntent, toggleScreenShare]);

    // ✅ 드롭/재선택은 "영향 안 주게" 그대로 유지
    const onRestartScreenShareWithSignal = useCallback(() => {
        if (isUiLocked()) return;

        // 화면 재선택도: 그냥 screen으로 하드 리조인 + 새 picker 유도
        requestHardSwitch("screen", null, "screen-reselect");
    }, [isUiLocked, requestHardSwitch]);

    const onChangeVideoSource = useCallback(
        (type, deviceId) => {
            if (isUiLocked()) return;

            if (type === "screen") {
                requestHardSwitch("screen", null, "pick-screen");
                return;
            }

            // ✅ 카메라 “기기 변경”은 원래 잘 된다 했으니 리조인 안 함
            // 단, 지금 screen 모드였다면 mode 전환은 하드리조인
            if (uiMedia.videoSource === "screen") {
                requestHardSwitch("camera", deviceId, "pick-camera-mode");
                return;
            }

            // camera 모드에서 device 변경만
            lockUi(900);
            setVideoSource?.("camera", deviceId);
        },
        [
            isUiLocked,
            requestHardSwitch,
            uiMedia.videoSource,
            lockUi,
            setVideoSource,
        ]
    );

    // =========================================================
    // Intent/Commit 송출 로직 (유지)
    // =========================================================
    const lastIntentKeyRef = useRef("");
    const lastCommitKeyRef = useRef("");

    // A) INTENT
    useEffect(() => {
        if (!joinInfo) return;
        if (!mediaSignalConnected) return;
        if (!isConnected) return;

        const wantAudio = !!uiMedia.audio;
        const wantVideo = !!uiMedia.video;

        const intentKey = [
            wantAudio ? 1 : 0,
            wantVideo ? 1 : 0,
            uiMedia.videoSource || "camera",
            uiMedia.screenSoftMuted ? 1 : 0,
        ].join("|");

        if (intentKey === lastIntentKeyRef.current) return;
        lastIntentKeyRef.current = intentKey;

        const extra = buildSignalExtra(uiMedia, "localIntent", "intent", {
            wantAudio,
            wantVideo,
        });

        sendMediaStateRef.current?.(wantAudio, wantVideo, extra);
    }, [
        joinInfo,
        mediaSignalConnected,
        isConnected,
        uiMedia,
        buildSignalExtra,
    ]);

    // B) COMMIT
    useEffect(() => {
        if (!joinInfo) return;
        if (!mediaSignalConnected) return;
        if (!isConnected) return;

        const liveAudio = !!uiMedia.liveAudio;
        const liveVideo = !!uiMedia.liveVideo;

        const commitKey = [
            liveAudio ? 1 : 0,
            liveVideo ? 1 : 0,
            uiMedia.videoSource || "camera",
            uiMedia.screenSoftMuted ? 1 : 0,
            uiMedia.screenCapturing ? 1 : 0,
        ].join("|");

        if (commitKey === lastCommitKeyRef.current) return;
        lastCommitKeyRef.current = commitKey;

        const extra = buildSignalExtra(uiMedia, "publishOk", "commit", {
            liveAudio,
            liveVideo,
        });

        sendMediaStateNowRef.current?.(liveAudio, liveVideo, extra);
    }, [
        joinInfo,
        mediaSignalConnected,
        isConnected,
        uiMedia,
        buildSignalExtra,
    ]);

    // =========================================================
    // Script Loader
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
    // JoinInfo Fetch
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
    }, [meetingId]);

    // =========================================================
    // Join Flow (Janus -> REST)
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

        const args = { roomNumber, displayName };
        lastJoinArgsRef.current = args;
        joinRoomRef.current?.(args);
    }, [joinInfo, scriptsLoaded, meetingId]);

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
    // Keepalive / Ping
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
    // Render helpers
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
                    onRestartScreenShare={onRestartScreenShareWithSignal}
                    onLeave={handleLeave}
                    isConnected={isConnected}
                    isConnecting={isConnecting}
                    getVideoInputs={getVideoInputs}
                    onChangeVideoSource={onChangeVideoSource}
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
                                    fetchRosterParticipants();
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
