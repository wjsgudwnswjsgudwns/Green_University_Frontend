// src/components/MediaPanel.jsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import "../styles/MediaPanel.css";

export default function MediaPanel({
    participants = [],
    sortedParticipants = [],
    mode = "focus",
    focusId = null, // (unused)
    focusedParticipant = null,
    handleParticipantClick,
    onMainClick,

    uiMedia,
    mediaStates,
    playNonce,
    setPlayNonce,

    onToggleAudio,
    onToggleVideo,

    // ✅ 화면공유: 토글(시작/종료)
    onToggleScreenShare,
    // ✅ 화면공유: 재선택(기존 screen 종료 → 새 picker)
    onRestartScreenShare,

    onLeave,

    isConnected,
    isConnecting,

    // ✅ 카메라 드롭다운
    getVideoInputs,
    onChangeVideoSource,
}) {
    // =========================================================
    // Media flags (UI)
    // =========================================================
    const noMediaDevices = !!uiMedia?.noMediaDevices;
    const videoDeviceLost = !!uiMedia?.videoDeviceLost;
    const permissionDeniedVideo = !!uiMedia?.permissionDeniedVideo;
    const permissionDeniedScreen = !!uiMedia?.permissionDeniedScreen;

    const disableControls = false;
    const disableLeave = !isConnected && !isConnecting;

    // =========================================================
    // ✅ "현재 모드" & "진짜 송출중" 기준
    // =========================================================
    const isScreenMode = uiMedia?.videoSource === "screen";

    const isScreenSending =
        isScreenMode &&
        uiMedia?.video === true &&
        uiMedia?.screenSoftMuted !== true;

    const isCameraSending =
        !isScreenMode &&
        uiMedia?.video === true &&
        uiMedia?.videoDeviceLost !== true &&
        uiMedia?.noMediaDevices !== true;

    // ✅ OFF 판단(여기서 “검증/지연 없이” 바로 토글 처리하려고)
    const isTurningOffCamera = !isScreenMode && uiMedia?.video === true;
    const isTurningOffScreen = isScreenSending === true;

    // =========================================================
    // ✅ Notices (dismissible + auto-hide + fade out)
    // - 상태 기반(권한/장치 문제)만 자동 표시
    // =========================================================
    const FADE_MS = 220;
    const [notices, setNotices] = useState([]);
    const lastNoticeTextRef = useRef("");
    const timersRef = useRef({}); // id -> [fadeTimer, removeTimer]

    const pushNotice = useCallback(
        (seed, opt = {}) => {
            if (!seed?.text) return;

            const {
                ttlMs: ttlOverride,
                dedupe = true,
                allowSameText = false,
                limit = 2,

                // ✅ 추가: 클릭 등 “무조건 다시 띄우기” 용
                force = false,
            } = opt;

            // ✅ force면 dedupe 완전 우회 + lastNoticeTextRef 갱신도 안 함(자동 dedupe에 영향 X)
            if (
                !force &&
                dedupe &&
                !allowSameText &&
                lastNoticeTextRef.current === seed.text
            ) {
                return;
            }
            if (!force) lastNoticeTextRef.current = seed.text;

            const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const ttlMs =
                typeof ttlOverride === "number"
                    ? ttlOverride
                    : seed.type === "danger"
                    ? 5200
                    : 3200;

            setNotices((prev) =>
                [{ id, closing: false, ...seed }, ...prev].slice(0, limit)
            );

            const fadeAt = Math.max(0, ttlMs - FADE_MS);
            const fadeTimer = window.setTimeout(() => {
                setNotices((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, closing: true } : n))
                );
            }, fadeAt);

            const removeTimer = window.setTimeout(() => {
                setNotices((prev) => prev.filter((n) => n.id !== id));
                delete timersRef.current[id];
            }, ttlMs);

            timersRef.current[id] = [fadeTimer, removeTimer];
        },
        [FADE_MS]
    );

    const dismissNotice = useCallback(
        (id) => {
            const timers = timersRef.current[id];
            if (timers) {
                try {
                    window.clearTimeout(timers[0]);
                    window.clearTimeout(timers[1]);
                } catch {}
                delete timersRef.current[id];
            }

            setNotices((prev) =>
                prev.map((n) => (n.id === id ? { ...n, closing: true } : n))
            );
            window.setTimeout(() => {
                setNotices((prev) => prev.filter((n) => n.id !== id));
            }, FADE_MS);
        },
        [FADE_MS]
    );

    useEffect(() => {
        return () => {
            const all = timersRef.current;
            Object.keys(all).forEach((id) => {
                const [t1, t2] = all[id] || [];
                try {
                    window.clearTimeout(t1);
                } catch {}
                try {
                    window.clearTimeout(t2);
                } catch {}
            });
            timersRef.current = {};
        };
    }, []);

    // =========================================================
    // ✅ rawNoticeSeed: 자동 상태 기반 배너(원본)
    // =========================================================
    const rawNoticeSeed = useMemo(() => {
        if (permissionDeniedScreen) {
            return {
                type: "danger",
                text: "화면 공유 권한이 차단되어 시작할 수 없습니다. (브라우저/사이트 권한에서 화면 공유 허용 후 다시 시도)",
            };
        }
        if (permissionDeniedVideo) {
            return {
                type: "danger",
                text: "카메라 권한이 거부되어 영상 송출이 불가능합니다. (브라우저 권한 허용 후 다시 시도)",
            };
        }
        if (noMediaDevices) {
            return {
                type: "warn",
                text: "미디어 입력 장치가 감지되지 않았습니다.",
            };
        }
        if (videoDeviceLost) {
            return {
                type: "warn",
                text: "카메라 신호가 불안정합니다. 장치/점유 상태를 확인해 주세요.",
            };
        }
        return null;
    }, [
        permissionDeniedScreen,
        permissionDeniedVideo,
        noMediaDevices,
        videoDeviceLost,
    ]);

    // =========================================================
    // ✅ 튐 방지: 경고가 N ms 이상 "연속 유지"될 때만 표시
    // =========================================================
    const NOTICE_STABLE_MS = 450; // 300~600
    const rawNoticeRef = useRef(null);
    useEffect(() => {
        rawNoticeRef.current = rawNoticeSeed;
    }, [rawNoticeSeed]);

    const pendingNoticeRef = useRef({ text: null, timer: null });

    useEffect(() => {
        const prev = pendingNoticeRef.current;
        if (prev.timer) {
            try {
                clearTimeout(prev.timer);
            } catch {}
            prev.timer = null;
        }

        if (!rawNoticeSeed?.text) {
            pendingNoticeRef.current.text = null;
            lastNoticeTextRef.current = ""; // ✅ AUTO는 상태가 사라지면 다시 뜰 수 있게 리셋
            return;
        }

        const plannedText = rawNoticeSeed.text;
        pendingNoticeRef.current.text = plannedText;

        const t = window.setTimeout(() => {
            const latest = rawNoticeRef.current;
            if (!latest?.text) return;
            if (latest.text !== plannedText) return;
            pushNotice(latest); // ✅ AUTO: 기존 dedupe 유지
        }, NOTICE_STABLE_MS);

        pendingNoticeRef.current.timer = t;

        return () => {
            try {
                clearTimeout(t);
            } catch {}
        };
    }, [rawNoticeSeed, pushNotice]);

    useEffect(() => {
        return () => {
            const t = pendingNoticeRef.current?.timer;
            if (t) {
                try {
                    clearTimeout(t);
                } catch {}
            }
            pendingNoticeRef.current.timer = null;
            pendingNoticeRef.current.text = null;
        };
    }, []);

    // =========================================================
    // ✅ "클릭 텍스트 대신" 시각적 NUDGE (짧은 흔들)
    // =========================================================
    const [camNudge, setCamNudge] = useState(false);
    const [screenNudge, setScreenNudge] = useState(false);

    const nudgeOnce = useCallback((which) => {
        if (which === "cam") {
            setCamNudge(true);
            window.setTimeout(() => setCamNudge(false), 240);
        }
        if (which === "screen") {
            setScreenNudge(true);
            window.setTimeout(() => setScreenNudge(false), 240);
        }
    }, []);

    // =========================================================
    // ✅ 클릭 시 "현재 상태 경고"를 다시 띄우기 (자동은 1회만 뜨는 구조 보완)
    // =========================================================
    const pushCameraStateNotice = useCallback(() => {
        if (permissionDeniedVideo) {
            pushNotice(
                {
                    type: "danger",
                    text: "카메라 권한이 거부되어 영상 송출이 불가능합니다. (브라우저 권한 허용 후 다시 시도)",
                },
                { force: true }
            );
            nudgeOnce("cam");
            return;
        }
        if (noMediaDevices) {
            pushNotice(
                {
                    type: "warn",
                    text: "미디어 입력 장치가 감지되지 않았습니다.",
                },
                { force: true }
            );
            nudgeOnce("cam");
            return;
        }
        if (videoDeviceLost) {
            pushNotice(
                {
                    type: "warn",
                    text: "카메라 신호가 불안정합니다. 장치/점유 상태를 확인해 주세요.",
                },
                { force: true }
            );
            nudgeOnce("cam");
        }
    }, [
        permissionDeniedVideo,
        noMediaDevices,
        videoDeviceLost,
        pushNotice,
        nudgeOnce,
    ]);

    const pushScreenStateNotice = useCallback(() => {
        if (!permissionDeniedScreen) return;
        pushNotice(
            {
                type: "danger",
                text: "화면 공유 권한이 차단되어 시작할 수 없습니다. (브라우저/사이트 권한에서 화면 공유 허용 후 다시 시도)",
            },
            { force: true }
        );
        nudgeOnce("screen");
    }, [permissionDeniedScreen, pushNotice, nudgeOnce]);

    // =========================================================
    // Media Intent Handlers
    // =========================================================
    const handleAudioToggle = useCallback(() => {
        onToggleAudio?.();
    }, [disableControls, onToggleAudio]);

    // =========================================================
    // ✅ Camera Dropdown
    // =========================================================
    const [cameraOptions, setCameraOptions] = useState([]);
    const [camDropdownOpen, setCamDropdownOpen] = useState(false);
    const camStackRef = useRef(null);

    const normalizeCameraList = useCallback((list) => {
        const arr = Array.isArray(list) ? list : [];
        return arr.map((c, idx) => {
            const raw = typeof c?.deviceId === "string" ? c.deviceId : "";
            const safeId = raw && raw.trim() ? raw : `default-${idx}`; // ✅ "" 방지
            const label =
                typeof c?.label === "string" && c.label.trim()
                    ? c.label
                    : `Camera ${idx + 1}`;

            return { deviceId: safeId, label };
        });
    }, []);

    const refreshCameras = useCallback(async () => {
        if (typeof getVideoInputs !== "function") {
            setCameraOptions([]);
            return [];
        }
        try {
            const list = await getVideoInputs();
            const normalized = normalizeCameraList(list);
            setCameraOptions(normalized);
            return normalized;
        } catch {
            setCameraOptions([]);
            return [];
        }
    }, [getVideoInputs, normalizeCameraList]);

    useEffect(() => {
        let alive = true;
        const run = async () => {
            const normalized = await refreshCameras();
            if (!alive) return;
            return normalized;
        };
        run();
        return () => {
            alive = false;
        };
    }, [
        refreshCameras,
        camDropdownOpen,
        uiMedia?.video,
        permissionDeniedVideo,
    ]);

    useEffect(() => {
        if (!camDropdownOpen) return;

        const onDown = (e) => {
            if (!camStackRef.current) return;
            if (!camStackRef.current.contains(e.target)) {
                setCamDropdownOpen(false);
            }
        };

        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [camDropdownOpen]);

    const handleCameraSelect = useCallback(
        async (deviceId) => {
            const safeId =
                typeof deviceId === "string" && deviceId.trim()
                    ? deviceId
                    : null; // ✅ 없으면 null로

            if (!safeId) {
                pushNotice(
                    {
                        type: "warn",
                        text: "카메라 ID를 확인할 수 없어 기본 카메라로 시도합니다.",
                    },
                    { force: true } // ✅ CLICK: 매번 뜨게
                );
                nudgeOnce("cam");
            }

            try {
                await Promise.resolve(onChangeVideoSource?.("camera", safeId));
            } catch (e) {
                console.error("[MediaPanel] onChangeVideoSource 실패", e);
                pushNotice(
                    {
                        type: "danger",
                        text: "카메라 전환에 실패했습니다. (권한/점유/장치 상태 확인)",
                    },
                    { force: true } // ✅ CLICK: 매번 뜨게
                );
                nudgeOnce("cam");
            } finally {
                setCamDropdownOpen(false);
            }
        },
        [onChangeVideoSource, pushNotice, nudgeOnce]
    );

    const toggleCamDropdown = useCallback(async () => {
        if (disableControls) return;

        // ✅ 상태가 계속 true면 자동 경고는 1회만 뜨므로, 클릭 때 다시 노출
        pushCameraStateNotice();

        const cams = await refreshCameras();

        if (!cams || cams.length === 0) {
            if (permissionDeniedVideo) {
                pushNotice(
                    {
                        type: "danger",
                        text: "카메라 권한이 거부되어 장치 목록을 불러올 수 없습니다. 권한 허용 후 다시 시도하세요.",
                    },
                    { force: true } // ✅ CLICK: 매번 뜨게
                );
            } else {
                pushNotice(
                    {
                        type: "warn",
                        text: "사용 가능한 카메라가 없습니다. 장치/점유 상태를 확인해 주세요.",
                    },
                    { force: true } // ✅ CLICK: 매번 뜨게
                );
            }
            nudgeOnce("cam");
            setCamDropdownOpen(false);
            return;
        }

        setCamDropdownOpen((v) => !v);
    }, [
        disableControls,
        pushCameraStateNotice,
        refreshCameras,
        permissionDeniedVideo,
        pushNotice,
        nudgeOnce,
    ]);

    const handleCameraToggle = useCallback(async () => {
        if (disableControls) return;

        // OFF는 그대로 빠르게
        if (isTurningOffCamera) {
            try {
                await Promise.resolve(onToggleVideo?.());
            } catch (e) {
                console.error("[MediaPanel] onToggleVideo(OFF) 실패", e);
                pushNotice(
                    {
                        type: "danger",
                        text: "카메라 끄기에 실패했습니다. 다시 시도해 주세요.",
                    },
                    { force: true } // ✅ CLICK: 매번 뜨게
                );
                nudgeOnce("cam");
            }
            return;
        }

        // ✅ ON 클릭 때도 현재 상태 경고를 다시 노출(상태가 유지되는 케이스 보완)
        pushCameraStateNotice();

        // ✅ 여기서부터 ON 시도
        let cams = [];
        try {
            cams = (await refreshCameras()) || [];
        } catch {
            cams = [];
        }

        if (noMediaDevices || cams.length === 0) {
            pushNotice(
                {
                    type: "warn",
                    text: "사용 가능한 카메라를 찾지 못했습니다. (장치 연결/점유 상태 확인 후 다시 시도)",
                },
                { force: true } // ✅ CLICK: 매번 뜨게
            );
            nudgeOnce("cam");
        }

        if (permissionDeniedVideo) {
            pushNotice(
                {
                    type: "danger",
                    text: "카메라 권한이 거부되어 있습니다. 브라우저/사이트 권한에서 허용 후 다시 시도하세요.",
                },
                { force: true } // ✅ CLICK: 매번 뜨게
            );
            nudgeOnce("cam");
        }

        try {
            await Promise.resolve(onToggleVideo?.());
        } catch (e) {
            console.error("[MediaPanel] onToggleVideo(ON) 실패", e);
            pushNotice(
                {
                    type: "danger",
                    text: "카메라 켜기에 실패했습니다. (권한/점유/장치 상태 확인 후 다시 시도)",
                },
                { force: true } // ✅ CLICK: 매번 뜨게
            );
            nudgeOnce("cam");
        }
    }, [
        disableControls,
        isTurningOffCamera,
        pushCameraStateNotice,
        noMediaDevices,
        permissionDeniedVideo,
        refreshCameras,
        onToggleVideo,
        pushNotice,
        nudgeOnce,
    ]);

    // ✅ 화면공유 토글: 클릭 때도 "현재 상태 경고"를 force로 다시 노출
    const handleScreenToggle = useCallback(() => {
        pushScreenStateNotice();
        onToggleScreenShare?.();
    }, [pushScreenStateNotice, onToggleScreenShare]);

    const handleScreenRestart = useCallback(() => {
        pushScreenStateNotice();
        if (typeof onRestartScreenShare === "function")
            return onRestartScreenShare();
        return onToggleScreenShare?.();
    }, [pushScreenStateNotice, onRestartScreenShare, onToggleScreenShare]);

    // =========================================================
    // Autoplay Gate
    // =========================================================
    const [autoplayGateOpen, setAutoplayGateOpen] = useState(false);
    const autoplayGateShownRef = useRef(false);

    const openAutoplayGate = useCallback(() => {
        if (autoplayGateShownRef.current) return;
        autoplayGateShownRef.current = true;
        setAutoplayGateOpen(true);
    }, []);

    const closeAutoplayGate = useCallback(() => {
        setAutoplayGateOpen(false);
        autoplayGateShownRef.current = false;
    }, []);

    const requestUserGesturePlay = useCallback(() => {
        if (typeof setPlayNonce === "function") setPlayNonce((n) => n + 1);
        autoplayGateShownRef.current = false;
        setAutoplayGateOpen(false);
    }, [setPlayNonce]);

    // =========================================================
    // lists
    // =========================================================
    const list = useMemo(() => {
        const s =
            sortedParticipants && sortedParticipants.length
                ? sortedParticipants
                : participants;
        return s || [];
    }, [sortedParticipants, participants]);

    const gridCount = list.length;
    const isSolo = gridCount <= 1;

    const safeFocused = useMemo(() => {
        if (focusedParticipant) return focusedParticipant;
        const me = list.find((p) => !!p?.isMe);
        return me || list[0] || null;
    }, [focusedParticipant, list]);

    const safeFocusId = safeFocused ? String(safeFocused.id) : null;

    // =========================================================
    // FOCUS thumb strip loop scroll
    // =========================================================
    const thumbStripRef = useRef(null);

    const scrollThumbsLoop = useCallback((dir) => {
        const el = thumbStripRef.current;
        if (!el) return;

        const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        const step = Math.floor(el.clientWidth * 0.85);

        const nearStart = el.scrollLeft <= 2;
        const nearEnd = el.scrollLeft >= maxLeft - 2;

        if (dir > 0) {
            if (nearEnd) el.scrollTo({ left: 0, behavior: "smooth" });
            else el.scrollBy({ left: step, behavior: "smooth" });
        } else {
            if (nearStart) el.scrollTo({ left: maxLeft, behavior: "smooth" });
            else el.scrollBy({ left: -step, behavior: "smooth" });
        }
    }, []);

    // =========================================================
    // GRID columns
    // =========================================================
    const gridClass = useMemo(() => {
        if (gridCount <= 1) return "meeting-video__grid--1";
        if (gridCount <= 4) return "meeting-video__grid--2";
        return "meeting-video__grid--3";
    }, [gridCount]);

    // =========================================================
    // ✅ Top status (ONLY connecting/connected)
    // =========================================================
    const topStatus = useMemo(() => {
        if (isConnecting) return { type: "info", text: "연결중..." };
        if (isConnected) return { type: "ok", text: "연결됨" };
        return null;
    }, [isConnecting, isConnected]);

    // =========================================================
    // ✅ Stage mode decision
    // =========================================================
    const renderMode = useMemo(() => {
        if (mode === "grid") return "grid";
        if (mode === "focus" && isSolo) return "solo";
        return "focus";
    }, [mode, isSolo]);

    // ✅ 화면공유 버튼은 UI 비활성화하지 않음
    const screenControlsDisabled = disableControls;

    return (
        <div className="meeting-video" data-count={gridCount}>
            {autoplayGateOpen && (
                <AutoplayGate
                    onConfirm={requestUserGesturePlay}
                    onClose={closeAutoplayGate}
                />
            )}

            <div className="meeting-video__main">
                {renderMode === "focus" && (
                    <div className="meeting-video__stage meeting-video__stage--strip">
                        {topStatus && (
                            <div
                                className={`meeting-video__status-pill meeting-video__status-pill--${topStatus.type}`}
                            >
                                {topStatus.text}
                            </div>
                        )}

                        {notices.length > 0 && (
                            <div className="meeting-video__notice-stack">
                                {notices.map((n) => (
                                    <div
                                        key={n.id}
                                        className={[
                                            "meeting-video__banner",
                                            "meeting-video__banner--closable",
                                            n.type === "danger" &&
                                                "meeting-video__banner--danger",
                                            n.type === "warn" &&
                                                "meeting-video__banner--warn",
                                            n.closing && "is-exiting",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        <div className="meeting-video__banner-text">
                                            {n.text}
                                        </div>
                                        <button
                                            type="button"
                                            className="meeting-video__banner-close"
                                            onClick={() => dismissNotice(n.id)}
                                            aria-label="닫기"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="meeting-video__focus">
                            {safeFocused ? (
                                <VideoTile
                                    participant={safeFocused}
                                    variant="focus"
                                    isFocused
                                    onClick={onMainClick}
                                    localMedia={uiMedia}
                                    mediaStates={mediaStates}
                                    playNonce={playNonce}
                                    onAutoplayBlocked={openAutoplayGate}
                                />
                            ) : (
                                <div className="meeting-video__placeholder">
                                    <div className="meeting-video__avatar">
                                        ?
                                    </div>
                                    <div className="meeting-video__placeholder-name">
                                        참가자 없음
                                    </div>
                                </div>
                            )}
                        </div>

                        {list.length >= 2 && (
                            <div className="meeting-video__thumb-row">
                                <button
                                    type="button"
                                    className="meeting-video__thumb-nav meeting-video__thumb-nav--prev"
                                    onClick={() => scrollThumbsLoop(-1)}
                                    aria-label="이전"
                                >
                                    ‹
                                </button>

                                <div
                                    className="meeting-video__thumb-strip"
                                    ref={thumbStripRef}
                                >
                                    {list
                                        .filter(
                                            (p) =>
                                                String(p.id) !==
                                                String(safeFocusId)
                                        )
                                        .map((p) => (
                                            <VideoTile
                                                key={p.id}
                                                participant={p}
                                                variant="thumb"
                                                onClick={() =>
                                                    handleParticipantClick?.(
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

                                <button
                                    type="button"
                                    className="meeting-video__thumb-nav meeting-video__thumb-nav--next"
                                    onClick={() => scrollThumbsLoop(1)}
                                    aria-label="다음"
                                >
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {renderMode === "solo" && (
                    <div className="meeting-video__stage meeting-video__stage--solo">
                        {topStatus && (
                            <div
                                className={`meeting-video__status-pill meeting-video__status-pill--${topStatus.type}`}
                            >
                                {topStatus.text}
                            </div>
                        )}

                        {notices.length > 0 && (
                            <div className="meeting-video__notice-stack">
                                {notices.map((n) => (
                                    <div
                                        key={n.id}
                                        className={[
                                            "meeting-video__banner",
                                            "meeting-video__banner--closable",
                                            n.type === "danger" &&
                                                "meeting-video__banner--danger",
                                            n.type === "warn" &&
                                                "meeting-video__banner--warn",
                                            n.closing && "is-exiting",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        <div className="meeting-video__banner-text">
                                            {n.text}
                                        </div>
                                        <button
                                            type="button"
                                            className="meeting-video__banner-close"
                                            onClick={() => dismissNotice(n.id)}
                                            aria-label="닫기"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="meeting-video__grid meeting-video__grid--1">
                            {safeFocused ? (
                                <VideoTile
                                    participant={safeFocused}
                                    variant="grid"
                                    isFocused={false}
                                    onClick={onMainClick}
                                    localMedia={uiMedia}
                                    mediaStates={mediaStates}
                                    playNonce={playNonce}
                                    onAutoplayBlocked={openAutoplayGate}
                                />
                            ) : (
                                <div className="meeting-video__placeholder">
                                    <div className="meeting-video__avatar">
                                        ?
                                    </div>
                                    <div className="meeting-video__placeholder-name">
                                        참가자 없음
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {renderMode === "grid" && (
                    <div className="meeting-video__stage meeting-video__stage--grid">
                        {topStatus && (
                            <div
                                className={`meeting-video__status-pill meeting-video__status-pill--${topStatus.type}`}
                            >
                                {topStatus.text}
                            </div>
                        )}

                        {notices.length > 0 && (
                            <div className="meeting-video__notice-stack">
                                {notices.map((n) => (
                                    <div
                                        key={n.id}
                                        className={[
                                            "meeting-video__banner",
                                            "meeting-video__banner--closable",
                                            n.type === "danger" &&
                                                "meeting-video__banner--danger",
                                            n.type === "warn" &&
                                                "meeting-video__banner--warn",
                                            n.closing && "is-exiting",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        <div className="meeting-video__banner-text">
                                            {n.text}
                                        </div>
                                        <button
                                            type="button"
                                            className="meeting-video__banner-close"
                                            onClick={() => dismissNotice(n.id)}
                                            aria-label="닫기"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={`meeting-video__grid ${gridClass}`}>
                            {list.map((p) => (
                                <VideoTile
                                    key={p.id}
                                    participant={p}
                                    variant="grid"
                                    isFocused={false}
                                    onClick={() =>
                                        handleParticipantClick?.(p.id)
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
            </div>

            {/* =========================
                Controls
               ========================= */}
            <div className="meeting-video__controls">
                {/* 🎙 마이크 */}
                <button
                    type="button"
                    className={`meeting-video__control-btn ${
                        uiMedia?.audio ? "" : "meeting-video__control-btn--off"
                    }`}
                    onClick={handleAudioToggle}
                    aria-label="마이크"
                >
                    {uiMedia?.audio ? "🎙" : "🔇"}
                </button>

                {/* 🎥 카메라 (원형 + 우하단 드롭) */}
                <div
                    className={[
                        "meeting-video__control-stack",
                        camDropdownOpen && "open",
                        disableControls && "disabled",
                        (permissionDeniedVideo || noMediaDevices) &&
                            "is-blocked",
                        camNudge && "nudge",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    ref={camStackRef}
                >
                    <button
                        type="button"
                        className={`meeting-video__control-btn ${
                            isCameraSending
                                ? ""
                                : "meeting-video__control-btn--off"
                        }`}
                        onClick={handleCameraToggle}
                        aria-label="카메라"
                    >
                        🎥
                    </button>

                    <button
                        type="button"
                        className="meeting-video__control-drop"
                        aria-label="카메라 선택"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCamDropdown();
                        }}
                    />

                    <div
                        className={`meeting-video__dropdown ${
                            camDropdownOpen ? "open" : ""
                        }`}
                    >
                        {cameraOptions.length === 0 ? (
                            <div className="meeting-video__dropdown-empty">
                                카메라 없음
                            </div>
                        ) : (
                            cameraOptions.map((c) => (
                                <button
                                    type="button"
                                    key={c.deviceId}
                                    className="meeting-video__dropdown-item"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCameraSelect(c.deviceId);
                                    }}
                                >
                                    📷 {c.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* 🖥 화면공유 (원형 + 우하단 드롭) */}
                <div
                    className={[
                        "meeting-video__control-stack",
                        // screenControlsDisabled && "disabled",
                        permissionDeniedScreen && "is-blocked",
                        screenNudge && "nudge",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <button
                        type="button"
                        className={`meeting-video__control-btn ${
                            isScreenSending
                                ? ""
                                : "meeting-video__control-btn--off"
                        }`}
                        onClick={handleScreenToggle}
                        aria-label="화면 공유"
                    >
                        🖥️
                    </button>

                    <button
                        type="button"
                        className="meeting-video__control-drop"
                        aria-label="화면 다시 선택"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            handleScreenRestart();
                        }}
                    />
                </div>

                {/* ⏹ 나가기 */}
                <button
                    type="button"
                    className="meeting-video__control-btn meeting-video__control-btn--danger"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLeave?.();
                    }}
                    aria-label="나가기"
                    disabled={disableLeave}
                >
                    ⏹
                </button>
            </div>
        </div>
    );
}

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
                        type="button"
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
                        type="button"
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
// VideoTile (patched - remote screen OFF 즉시 반영)
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
    const audioEnabled = !!localMedia?.audio;
    const videoEnabled = !!localMedia?.video;
    const isVideoDeviceLost = !!localMedia?.videoDeviceLost;

    const isLocalScreenSoftMuted =
        !!participant?.isMe &&
        localMedia?.videoSource === "screen" &&
        localMedia?.screenSoftMuted === true;

    const videoRef = useRef(null);
    const audioRef = useRef(null);

    const [trackVersion, setTrackVersion] = useState(0);

    const bumpTimerRef = useRef(null);
    const bumpTrackVersion = useCallback(() => {
        if (bumpTimerRef.current) return;
        bumpTimerRef.current = window.setTimeout(() => {
            bumpTimerRef.current = null;
            setTrackVersion((v) => v + 1);
        }, 60);
    }, []);

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

    useEffect(() => {
        const s = participant?.stream;
        if (!s) return;

        const onAdd = () => bumpTrackVersion();
        const onRemove = () => bumpTrackVersion();

        try {
            s.addEventListener?.("addtrack", onAdd);
            s.addEventListener?.("removetrack", onRemove);
        } catch {}

        const all = [];
        try {
            const vts = s.getVideoTracks?.() || [];
            const ats = s.getAudioTracks?.() || [];
            all.push(...vts, ...ats);
        } catch {}

        const onEnded = () => bumpTrackVersion();
        all.forEach((t) => {
            try {
                t.addEventListener?.("ended", onEnded);
            } catch {}
        });

        return () => {
            try {
                s.removeEventListener?.("addtrack", onAdd);
                s.removeEventListener?.("removetrack", onRemove);
            } catch {}

            all.forEach((t) => {
                try {
                    t.removeEventListener?.("ended", onEnded);
                } catch {}
            });
        };
    }, [participant?.stream, bumpTrackVersion]);

    useEffect(() => {
        return () => {
            try {
                if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
            } catch {}
            bumpTimerRef.current = null;
        };
    }, []);

    const mediaState =
        participant?.userId != null
            ? mediaStates[String(participant.userId)]
            : null;

    const isKnown =
        mediaState &&
        (mediaState.known === true ||
            typeof mediaState.receivedAt === "number");

    const remoteDeviceLost = !!mediaState?.videoDeviceLost;

    const hasRemoteVideoTrack = !participant?.isMe && hasAnyTrack("video");
    const hasRemoteAudioTrack = !participant?.isMe && hasAnyTrack("audio");

    const remoteVideoFlag =
        !participant?.isMe && isKnown && typeof mediaState?.video === "boolean"
            ? mediaState.video
            : undefined;

    const remoteAudioFlag =
        !participant?.isMe && isKnown && typeof mediaState?.audio === "boolean"
            ? mediaState.audio
            : undefined;

    const remoteVideoSource =
        !participant?.isMe && isKnown ? mediaState?.videoSource : undefined;

    const remoteScreenCapturing =
        !participant?.isMe && isKnown ? mediaState?.screenCapturing : undefined;

    const remoteScreenSoftMuted =
        !participant?.isMe && isKnown ? mediaState?.screenSoftMuted : undefined;

    const remoteIsScreen =
        remoteVideoSource === "screen" || remoteScreenCapturing === true;

    const remoteScreenSending =
        remoteIsScreen &&
        (remoteVideoFlag ?? true) &&
        remoteScreenSoftMuted !== true &&
        remoteScreenCapturing !== false &&
        !remoteDeviceLost;

    const videoOn = participant?.isMe
        ? !isLocalScreenSoftMuted &&
          videoEnabled &&
          !isVideoDeviceLost &&
          !noMediaDevices
        : remoteIsScreen
        ? remoteScreenSending
        : remoteDeviceLost
        ? false
        : remoteVideoFlag ?? true;

    const audioOn = participant?.isMe
        ? audioEnabled && !noMediaDevices
        : remoteAudioFlag ?? hasRemoteAudioTrack;

    const renderVideoTag = participant?.isMe
        ? !!participant?.stream && hasAnyTrack("video")
        : !!participant?.stream && hasRemoteVideoTrack;

    const showVideoVisual = renderVideoTag && videoOn;

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
                    if (isAutoplayBlockedError(err)) onAutoplayBlocked?.();
                });
            }
        },
        [onAutoplayBlocked]
    );

    const tryPlay = useCallback(() => {
        tryPlayEl(videoRef.current);
        if (!participant?.isMe) tryPlayEl(audioRef.current);
    }, [tryPlayEl, participant?.isMe]);

    const getTrackSig = useCallback((stream, kind) => {
        try {
            const list =
                kind === "video"
                    ? stream?.getVideoTracks?.() || []
                    : stream?.getAudioTracks?.() || [];
            const t = list[0];
            if (!t) return `no-${kind}`;
            return `${t.id}:${t.readyState}:${t.enabled ? "en" : "dis"}`;
        } catch {
            return `err-${kind}`;
        }
    }, []);

    const videoAttachSigRef = useRef({ stream: null, sig: null });
    const audioAttachSigRef = useRef({ stream: null, sig: null });

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const Janus = window.Janus;

        if (!renderVideoTag) {
            try {
                el.pause?.();
            } catch {}
            try {
                if (el.srcObject) el.srcObject = null;
            } catch {}
            videoAttachSigRef.current = { stream: null, sig: null };
            return;
        }

        const s = participant?.stream;
        if (!s) return;

        const sig = getTrackSig(s, "video");
        const last = videoAttachSigRef.current;

        try {
            el.muted = true;
        } catch {}

        const needsAttach =
            last.stream !== s || last.sig !== sig || el.srcObject !== s;

        if (!needsAttach) {
            tryPlayEl(el);
            return;
        }

        videoAttachSigRef.current = { stream: s, sig };

        try {
            try {
                if (el.srcObject) el.srcObject = null;
            } catch {}

            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, s);
            } else {
                el.srcObject = s;
            }

            tryPlayEl(el);
        } catch (e) {
            console.error("[VideoTile] video attach 실패", e);
        }
    }, [
        participant?.stream,
        renderVideoTag,
        trackVersion,
        getTrackSig,
        tryPlayEl,
    ]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const Janus = window.Janus;

        if (participant?.isMe) {
            try {
                if (el.srcObject) el.srcObject = null;
            } catch {}
            audioAttachSigRef.current = { stream: null, sig: null };
            return;
        }

        const s = participant?.stream;

        if (!s || !hasRemoteAudioTrack) {
            try {
                el.pause?.();
            } catch {}
            try {
                if (el.srcObject) el.srcObject = null;
            } catch {}
            audioAttachSigRef.current = { stream: null, sig: null };
            return;
        }

        const sig = getTrackSig(s, "audio");
        const last = audioAttachSigRef.current;

        const needsAttach =
            last.stream !== s || last.sig !== sig || el.srcObject !== s;

        if (!needsAttach) {
            if (canHearRemote) tryPlayEl(el);
            return;
        }

        audioAttachSigRef.current = { stream: s, sig };

        try {
            try {
                if (el.srcObject) el.srcObject = null;
            } catch {}

            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, s);
            } else {
                el.srcObject = s;
            }

            if (canHearRemote) tryPlayEl(el);
        } catch (e) {
            console.error("[VideoTile] audio attach 실패", e);
        }
    }, [
        participant?.stream,
        participant?.isMe,
        hasRemoteAudioTrack,
        canHearRemote,
        trackVersion,
        getTrackSig,
        tryPlayEl,
    ]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        if (participant?.isMe) return;
        try {
            el.muted = !audioOn;
        } catch {}
    }, [audioOn, participant?.isMe]);

    useEffect(() => {
        if (!participant?.stream) return;
        tryPlay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playNonce]);

    if (!participant) return null;

    const classes = [
        "meeting-video__remote",
        variant === "focus" && "meeting-video__remote--focus",
        variant === "thumb" && "meeting-video__remote--thumb",
        variant === "grid" && "meeting-video__remote--grid",
        isFocused && variant !== "grid" && "meeting-video__remote--focused",
    ]
        .filter(Boolean)
        .join(" ");

    const handleClick = () => {
        tryPlay();
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

            {renderVideoTag ? (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={[
                            "meeting-video__video",
                            !showVideoVisual && "meeting-video__video--hidden",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    />

                    {!showVideoVisual && (
                        <div className="meeting-video__placeholder meeting-video__placeholder--overlay">
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
                {!participant?.isMe && remoteIsScreen && (
                    <span className="meeting-video__badge">🖥️</span>
                )}
                {participant.isHost && (
                    <span className="meeting-video__badge meeting-video__badge--host">
                        H
                    </span>
                )}
            </div>
        </div>
    );
}
