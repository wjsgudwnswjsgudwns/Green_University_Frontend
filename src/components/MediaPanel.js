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
    focusId = null,
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

    const disableControls = !!isConnecting;
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
            } = opt;

            if (
                dedupe &&
                !allowSameText &&
                lastNoticeTextRef.current === seed.text
            ) {
                return;
            }
            lastNoticeTextRef.current = seed.text;

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
    // ✅ noticeSeed: 자동 상태 기반 배너
    // =========================================================
    const noticeSeed = useMemo(() => {
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

    useEffect(() => {
        if (!noticeSeed?.text) return;
        pushNotice(noticeSeed);
    }, [noticeSeed, pushNotice]);

    useEffect(() => {
        if (!noticeSeed) lastNoticeTextRef.current = "";
    }, [noticeSeed]);

    // =========================================================
    // Media Intent Handlers
    // =========================================================
    const handleAudioToggle = useCallback(() => {
        if (disableControls) return;
        onToggleAudio?.();
    }, [disableControls, onToggleAudio]);

    // =========================================================
    // ✅ Camera Dropdown (Discord-like grouped control)
    // =========================================================
    const [cameraOptions, setCameraOptions] = useState([]);
    const [camDropdownOpen, setCamDropdownOpen] = useState(false);
    const camGroupRef = useRef(null);

    const normalizeCameraList = useCallback((list) => {
        const arr = Array.isArray(list) ? list : [];
        return arr.map((c, idx) => ({
            deviceId: c?.deviceId ?? `unknown-${idx}`,
            label: c?.label || `Camera ${idx + 1}`,
        }));
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
            if (!camGroupRef.current) return;
            if (!camGroupRef.current.contains(e.target)) {
                setCamDropdownOpen(false);
            }
        };

        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [camDropdownOpen]);

    const handleCameraSelect = useCallback(
        (deviceId) => {
            if (disableControls) return;
            if (!deviceId) return;

            if (permissionDeniedVideo) {
                pushNotice(
                    {
                        type: "danger",
                        text: "카메라 권한이 거부되어 장치 선택이 불가능합니다. (브라우저 권한 허용 후 다시 시도)",
                    },
                    { ttlMs: 5200, allowSameText: true }
                );
                return;
            }

            onChangeVideoSource?.("camera", deviceId);
            setCamDropdownOpen(false);
        },
        [
            disableControls,
            permissionDeniedVideo,
            onChangeVideoSource,
            pushNotice,
        ]
    );

    const toggleCamDropdown = useCallback(async () => {
        if (disableControls) return;

        if (permissionDeniedVideo) {
            pushNotice(
                {
                    type: "danger",
                    text: "카메라 권한이 거부되어 장치 선택이 불가능합니다. (브라우저 권한 허용 후 다시 시도)",
                },
                { ttlMs: 5200, allowSameText: true }
            );
            return;
        }

        // ✅ 클릭 순간에 다시 확인(확실하게)
        const cams = await refreshCameras();
        if (noMediaDevices || cams.length === 0) {
            pushNotice(
                {
                    type: "warn",
                    text: "카메라 장치가 감지되지 않아 선택할 수 없습니다.",
                },
                { ttlMs: 2600, allowSameText: true }
            );
            return;
        }

        setCamDropdownOpen((v) => !v);
    }, [
        disableControls,
        permissionDeniedVideo,
        refreshCameras,
        noMediaDevices,
        pushNotice,
    ]);

    // ✅ 카메라 토글: OFF는 검증/refresh 없이 즉시 실행
    const handleCameraToggle = useCallback(async () => {
        if (disableControls) return;

        // ✅ OFF는 빠르게(여기서 async refreshCameras가 들어가면 꺼질 때도 느려짐)
        if (isTurningOffCamera) {
            onToggleVideo?.();
            return;
        }

        // ---- ON(켜기)만 안내 ----
        // ✅ 권한 거부여도 "재시도"는 가능하게: 안내만 띄우고 계속 진행
        if (permissionDeniedVideo) {
            pushNotice(
                {
                    type: "danger",
                    text: "카메라 권한이 거부된 상태입니다. 브라우저 권한을 허용한 뒤 다시 시도하세요. (지금은 재시도 요청을 보냅니다)",
                },
                { ttlMs: 5200, allowSameText: true }
            );
            // ✅ return 하지 않음
        }

        // ✅ 켤 때만 장치 확인
        const cams = await refreshCameras();
        if (noMediaDevices || cams.length === 0) {
            pushNotice(
                {
                    type: "warn",
                    text: "카메라 장치가 감지되지 않아 켤 수 없습니다.",
                },
                { ttlMs: 2800, allowSameText: true }
            );
            return;
        }

        onToggleVideo?.();
    }, [
        disableControls,
        isTurningOffCamera,
        permissionDeniedVideo,
        refreshCameras,
        noMediaDevices,
        onToggleVideo,
        pushNotice,
    ]);

    // =========================================================
    // ✅ Screen Share: in-flight lock (중복 호출 방지)
    // - permissionDeniedScreen이 "오탐/잔상"일 수 있어서: 안내는 하되, 시도는 막지 않음
    // =========================================================
    const screenBusyRef = useRef(false);
    const [screenBusy, setScreenBusy] = useState(false);

    const runScreenOp = useCallback(async (fn) => {
        if (screenBusyRef.current) return;
        screenBusyRef.current = true;
        setScreenBusy(true);

        try {
            const ret = fn?.();
            if (ret && typeof ret.then === "function") await ret;
        } finally {
            screenBusyRef.current = false;
            setScreenBusy(false);
        }
    }, []);

    // ✅ 화면공유 토글: OFF는 “권한 경고/검증” 없이 바로 실행
    const handleScreenToggle = useCallback(() => {
        if (disableControls) return;

        // ✅ OFF(종료)는 바로
        if (isTurningOffScreen) {
            runScreenOp(() => onToggleScreenShare?.());
            return;
        }

        // ✅ ON(시작)일 때만 안내(시도는 막지 않음)
        if (permissionDeniedScreen) {
            pushNotice(
                {
                    type: "danger",
                    text: "화면 공유 권한이 차단되어 시작이 안 될 수 있습니다. (브라우저/사이트 권한에서 화면 공유 허용 후 다시 시도)",
                },
                { ttlMs: 5200, allowSameText: true }
            );
        }

        runScreenOp(() => onToggleScreenShare?.());
    }, [
        disableControls,
        isTurningOffScreen,
        permissionDeniedScreen,
        onToggleScreenShare,
        pushNotice,
        runScreenOp,
    ]);

    const handleScreenRestart = useCallback(() => {
        if (disableControls) return;

        // ✅ 재선택은 본질적으로 ON 흐름이라 안내 유지
        if (permissionDeniedScreen) {
            pushNotice(
                {
                    type: "danger",
                    text: "화면 공유 권한이 차단되어 재선택이 안 될 수 있습니다. (브라우저/사이트 권한에서 화면 공유 허용 후 다시 시도)",
                },
                { ttlMs: 5200, allowSameText: true }
            );
        }

        runScreenOp(() => {
            if (typeof onRestartScreenShare === "function")
                return onRestartScreenShare();
            return onToggleScreenShare?.();
        });
    }, [
        disableControls,
        permissionDeniedScreen,
        onRestartScreenShare,
        onToggleScreenShare,
        pushNotice,
        runScreenOp,
    ]);

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

    // ✅ 화면공유 버튼은 작업중엔 잠시 비활성(중복 클릭 방지)
    const screenControlsDisabled = disableControls || screenBusy;

    return (
        <div className="meeting-video" data-count={gridCount}>
            {autoplayGateOpen && (
                <AutoplayGate
                    onConfirm={requestUserGesturePlay}
                    onClose={closeAutoplayGate}
                />
            )}

            <div className="meeting-video__main">
                {/* =========================
                    Stage
                   ========================= */}
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
                                            title="닫기"
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
                                    title="이전"
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
                                    title="다음"
                                >
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ✅ SOLO */}
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
                                            title="닫기"
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
                                            title="닫기"
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
                    disabled={disableControls}
                    title="마이크"
                >
                    {uiMedia?.audio ? "🎙" : "🔇"}
                </button>

                {/* 🎥 카메라 + 드롭 */}
                <div
                    className={[
                        "meeting-video__control-group",
                        camDropdownOpen && "open",
                        // ✅ 권한 거부여도 "카메라 버튼"은 재시도 가능해야 해서 그룹 전체 disabled는 막지 않음
                        disableControls && "disabled",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    ref={camGroupRef}
                >
                    <button
                        type="button"
                        className={`meeting-video__control-btn meeting-video__control-btn--in-group ${
                            isCameraSending
                                ? ""
                                : "meeting-video__control-btn--off"
                        }`}
                        onClick={handleCameraToggle}
                        disabled={disableControls}
                        title="카메라"
                    >
                        🎥
                    </button>

                    <button
                        type="button"
                        className="meeting-video__control-btn meeting-video__control-btn--in-group meeting-video__control-btn--sub"
                        disabled={disableControls}
                        title="카메라 선택"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCamDropdown();
                        }}
                    >
                        ▾
                    </button>

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
                                    disabled={disableControls}
                                >
                                    📷 {c.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* 🖥 화면공유 */}
                <div
                    className={[
                        "meeting-video__control-group",
                        (screenControlsDisabled || permissionDeniedScreen) &&
                            "disabled",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <button
                        type="button"
                        className={`meeting-video__control-btn meeting-video__control-btn--in-group ${
                            isScreenSending
                                ? ""
                                : "meeting-video__control-btn--off"
                        }`}
                        onClick={handleScreenToggle}
                        disabled={screenControlsDisabled}
                        title={
                            screenBusy
                                ? "화면 공유 처리중..."
                                : isScreenSending
                                ? "화면 공유 종료"
                                : "화면 공유"
                        }
                    >
                        🖥
                    </button>

                    <button
                        type="button"
                        className="meeting-video__control-btn meeting-video__control-btn--in-group meeting-video__control-btn--sub"
                        disabled={screenControlsDisabled}
                        title={screenBusy ? "처리중..." : "화면 다시 선택"}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleScreenRestart();
                        }}
                    >
                        ▾
                    </button>
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
                    disabled={disableLeave}
                    title="나가기"
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
// - signals는 "표시"도 담당해야 함: screenCapturing/videoSource 기반으로 videoOn 계산
// - attach/play는 기존처럼 stream+track 기반(최소 attach)
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

    // ✅ 트랙 이벤트 폭주 방지용(짧은 디바운스)
    const bumpTimerRef = useRef(null);
    const bumpTrackVersion = useCallback(() => {
        if (bumpTimerRef.current) return;
        bumpTimerRef.current = window.setTimeout(() => {
            bumpTimerRef.current = null;
            setTrackVersion((v) => v + 1);
        }, 60);
    }, []);
    const [trackVersion, setTrackVersion] = useState(0);

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

    // ✅ MediaStream 내부 트랙 변화를 감지해서 재-attach 트리거
    // - addtrack/removetrack + ended만(⚠ mute/unmute는 폭주 원인이라 제외)
    useEffect(() => {
        const s = participant?.stream;
        if (!s) return;

        const onAdd = () => bumpTrackVersion();
        const onRemove = () => bumpTrackVersion();

        try {
            s.addEventListener?.("addtrack", onAdd);
            s.addEventListener?.("removetrack", onRemove);
        } catch {}

        // 현재 트랙 ended 감지
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

    // ✅ remote track 존재 여부(attach 판단은 이것만)
    const hasRemoteVideoTrack = !participant?.isMe && hasAnyTrack("video");
    const hasRemoteAudioTrack = !participant?.isMe && hasAnyTrack("audio");

    // ✅ signals 기본 플래그
    const remoteVideoFlag =
        !participant?.isMe && isKnown && typeof mediaState?.video === "boolean"
            ? mediaState.video
            : undefined;

    const remoteAudioFlag =
        !participant?.isMe && isKnown && typeof mediaState?.audio === "boolean"
            ? mediaState.audio
            : undefined;

    // ✅ (중요) remote screen 상태를 UI에 반영
    const remoteVideoSource =
        !participant?.isMe && isKnown ? mediaState?.videoSource : undefined;

    const remoteScreenCapturing =
        !participant?.isMe && isKnown ? mediaState?.screenCapturing : undefined;

    const remoteScreenSoftMuted =
        !participant?.isMe && isKnown ? mediaState?.screenSoftMuted : undefined;

    // remote가 screen 모드인지(둘 중 하나라도 힌트가 있으면 screen으로 간주)
    const remoteIsScreen =
        remoteVideoSource === "screen" || remoteScreenCapturing === true;

    // remote screen “송출중” 판단(OFF를 즉시 placeholder로 반영)
    const remoteScreenSending =
        remoteIsScreen &&
        (remoteVideoFlag ?? true) &&
        remoteScreenSoftMuted !== true &&
        remoteScreenCapturing !== false &&
        !remoteDeviceLost;

    // ✅ 표시(뱃지/오버레이)용 on/off
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

    // ✅ 실제 attach/유지 기준은 track로만
    const renderVideoTag = participant?.isMe
        ? !!participant?.stream && hasAnyTrack("video")
        : !!participant?.stream && hasRemoteVideoTrack;

    // ✅ 화면 "보이기"만 signals로 제어(attach 유지)
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

    // =========================================================
    // ✅ attach 최소화를 위한 signature
    // =========================================================
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

    // =========================================================
    // ✅ VIDEO attach
    // =========================================================
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

    // =========================================================
    // ✅ AUDIO attach (remote only)
    // =========================================================
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

    // ✅ remote audio mute만 별도로 즉시 반영(재-attach X)
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        if (participant?.isMe) return;
        try {
            el.muted = !audioOn;
        } catch {}
    }, [audioOn, participant?.isMe]);

    // ✅ 사용자 제스처로 "재생 시작" 했을 때만 일괄 play 재시도
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
                    <span className="meeting-video__badge">🖥</span>
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
