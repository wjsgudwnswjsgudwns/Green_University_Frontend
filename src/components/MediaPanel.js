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
            // refreshCameras already set state
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

    const hasAnyCamera = cameraOptions.length > 0;

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

    const handleCameraToggle = useCallback(async () => {
        if (disableControls) return;

        if (permissionDeniedVideo) {
            pushNotice(
                {
                    type: "danger",
                    text: "카메라 권한이 거부되어 영상 송출이 불가능합니다. (브라우저 권한 허용 후 다시 시도)",
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
                    text: "카메라 장치가 감지되지 않아 켤 수 없습니다.",
                },
                { ttlMs: 2800, allowSameText: true }
            );
            return;
        }

        onToggleVideo?.();
    }, [
        disableControls,
        permissionDeniedVideo,
        refreshCameras,
        noMediaDevices,
        onToggleVideo,
        pushNotice,
    ]);

    // =========================================================
    // Screen share handlers
    // =========================================================
    const handleScreenToggle = useCallback(() => {
        if (disableControls) return;

        if (permissionDeniedScreen) {
            pushNotice(
                {
                    type: "danger",
                    text: "화면 공유 권한이 차단되어 시작할 수 없습니다. (브라우저/사이트 권한에서 화면 공유 허용 후 다시 시도)",
                },
                { ttlMs: 5200, allowSameText: true }
            );
            return;
        }

        onToggleScreenShare?.();
    }, [
        disableControls,
        permissionDeniedScreen,
        onToggleScreenShare,
        pushNotice,
    ]);

    const handleScreenRestart = useCallback(() => {
        if (disableControls) return;

        if (permissionDeniedScreen) {
            pushNotice(
                {
                    type: "danger",
                    text: "화면 공유 권한이 차단되어 다시 선택할 수 없습니다. (브라우저/사이트 권한에서 화면 공유 허용 후 다시 시도)",
                },
                { ttlMs: 5200, allowSameText: true }
            );
            return;
        }

        if (typeof onRestartScreenShare === "function") onRestartScreenShare();
        else onToggleScreenShare?.();
    }, [
        disableControls,
        permissionDeniedScreen,
        onRestartScreenShare,
        onToggleScreenShare,
        pushNotice,
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
                        (disableControls || permissionDeniedVideo) &&
                            "disabled",
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
                        disabled={disableControls} // ✅ permissionDenied로 disabled 금지 (눌렀을 때 배너 띄우기)
                        title="카메라"
                    >
                        🎥
                    </button>

                    <button
                        type="button"
                        className="meeting-video__control-btn meeting-video__control-btn--in-group meeting-video__control-btn--sub"
                        disabled={disableControls} // ✅ 동일
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
                        (disableControls || permissionDeniedScreen) &&
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
                        disabled={disableControls} // ✅ permissionDenied로 disabled 금지
                        title={isScreenSending ? "화면 공유 종료" : "화면 공유"}
                    >
                        🖥
                    </button>

                    <button
                        type="button"
                        className="meeting-video__control-btn meeting-video__control-btn--in-group meeting-video__control-btn--sub"
                        disabled={disableControls}
                        title="화면 다시 선택"
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
// VideoTile (원본 유지 + audioOff 시 mute/pause 유지)
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

    const videoOn = participant?.isMe
        ? !isLocalScreenSoftMuted &&
          videoEnabled &&
          !isVideoDeviceLost &&
          !noMediaDevices
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

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const Janus = window.Janus;

        if (!showVideo) {
            try {
                el.pause?.();
            } catch {}
            if (el.srcObject) el.srcObject = null;
            return;
        }

        if (!participant?.stream) return;

        try {
            el.muted = true;

            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, participant.stream);
            } else {
                if (el.srcObject !== participant.stream)
                    el.srcObject = participant.stream;
            }
            tryPlayEl(el);
        } catch (e) {
            console.error("[VideoTile] video attach 실패", e);
        }
    }, [participant?.stream, showVideo, tryPlayEl]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const Janus = window.Janus;

        if (participant?.isMe) {
            if (el.srcObject) el.srcObject = null;
            return;
        }

        if (!audioOn) {
            try {
                el.muted = true;
                el.pause?.();
            } catch {}
            return;
        }

        if (!participant?.stream) return;

        try {
            el.muted = false;

            if (Janus && Janus.attachMediaStream) {
                Janus.attachMediaStream(el, participant.stream);
            } else {
                if (el.srcObject !== participant.stream)
                    el.srcObject = participant.stream;
            }

            if (canHearRemote) tryPlayEl(el);
        } catch (e) {
            console.error("[VideoTile] audio attach 실패", e);
        }
    }, [
        participant?.stream,
        participant?.isMe,
        canHearRemote,
        tryPlayEl,
        audioOn,
    ]);

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
