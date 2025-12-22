// src/components/MediaPanel.jsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

/**
 * MediaPanel (final)
 * - mode: 'focus' | 'grid'
 * - 참가자 수 변동으로 stage 렌더가 막히지 않음
 * - 1명이어도 grid 가능
 * - 하단 컨트롤: 마이크/카메라 + 포커스/그리드 토글 + 나가기
 */
export default function MediaPanel({
    participants = [],
    sortedParticipants = [],
    mode = "focus",
    focusId = null,
    focusedParticipant = null,
    handleParticipantClick,

    uiMedia,
    mediaStates,
    playNonce,
    setPlayNonce,

    onToggleAudio,
    onToggleVideo,
    onToggleLayout,
    onLeave,

    isConnected,
    isConnecting,
}) {
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

    const requestUserGesturePlay = useCallback(() => {
        if (typeof setPlayNonce === "function") setPlayNonce((n) => n + 1);
        setAutoplayGateOpen(false);
    }, [setPlayNonce]);

    // =========================================================
    // safeFocused: focusId invalid/순간 null 방어
    // =========================================================
    const safeFocused = useMemo(() => {
        if (focusedParticipant) return focusedParticipant;
        const me = (participants || []).find((p) => !!p?.isMe);
        if (me) return me;
        return (participants || [])[0] || null;
    }, [focusedParticipant, participants]);

    const safeFocusId = safeFocused ? String(safeFocused.id) : null;

    return (
        <div className="meeting-video">
            {autoplayGateOpen && (
                <AutoplayGate
                    onConfirm={requestUserGesturePlay}
                    onClose={() => setAutoplayGateOpen(false)}
                />
            )}

            <div className="meeting-video__main">
                {/* =========================
            FOCUS
           ========================= */}
                {mode === "focus" && (
                    <div className="meeting-video__stage meeting-video__stage--strip">
                        <div className="meeting-video__focus">
                            {safeFocused ? (
                                <VideoTile
                                    participant={safeFocused}
                                    variant="focus"
                                    isFocused
                                    onClick={() =>
                                        handleParticipantClick?.(safeFocused.id)
                                    }
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

                        {/* thumb-row는 2명 이상일 때만 */}
                        {participants.length >= 2 && (
                            <div className="meeting-video__thumb-row">
                                <button className="meeting-video__thumb-nav meeting-video__thumb-nav--prev">
                                    ‹
                                </button>

                                <div className="meeting-video__thumb-strip">
                                    {sortedParticipants
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

                                <button className="meeting-video__thumb-nav meeting-video__thumb-nav--next">
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* =========================
            GRID (1명이어도 가능)
           ========================= */}
                {mode === "grid" && (
                    <div className="meeting-video__stage meeting-video__stage--grid">
                        <div className="meeting-video__grid">
                            {(sortedParticipants || []).map((p) => (
                                <VideoTile
                                    key={p.id}
                                    participant={p}
                                    variant={p.isMe ? "me-grid" : "grid"}
                                    isFocused={String(p.id) === String(focusId)}
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

            {uiMedia?.noMediaDevices && (
                <div className="meeting-video__device-message">
                    현재 브라우저에 마이크·카메라가 연결되지 않은 상태입니다.
                </div>
            )}

            <div className="meeting-video__controls">
                <button
                    className={`meeting-video__control-btn ${
                        uiMedia?.audio ? "" : "meeting-video__control-btn--off"
                    }`}
                    onClick={onToggleAudio}
                    title="마이크 토글"
                >
                    {uiMedia?.audio ? "🎙" : "🔇"}
                </button>

                <button
                    className={`meeting-video__control-btn ${
                        uiMedia?.video ? "" : "meeting-video__control-btn--off"
                    }`}
                    onClick={onToggleVideo}
                    title="카메라 토글"
                >
                    {uiMedia?.video ? "🎥" : "🚫"}
                </button>

                {/* ✅ 레이아웃 토글 버튼 1개 */}
                <button
                    className="meeting-video__control-btn meeting-video__control-btn--toggle"
                    onClick={onToggleLayout}
                    title="레이아웃 전환"
                >
                    {mode === "focus" ? "🧩" : "🎯"}
                </button>

                <button
                    className="meeting-video__control-btn meeting-video__control-btn--danger"
                    onClick={onLeave}
                    disabled={!isConnected && !isConnecting}
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
// VideoTile (동일 로직 유지)
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

    const videoRef = useRef(null);
    const audioRef = useRef(null);

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
        };

        const tracks = [...getTracks(s, "video"), ...getTracks(s, "audio")];
        tracks.forEach(bindTrack);

        bumpStreamTick();

        return () => {
            s.removeEventListener?.("addtrack", onAddTrack);
        };
    }, [participant?.stream, bumpStreamTick, getTracks]);

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
    }, [participant?.stream, showVideo, tryPlayEl, streamTick]);

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
    }, [
        participant?.stream,
        participant?.isMe,
        canHearRemote,
        tryPlayEl,
        streamTick,
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
        variant === "me-grid" && "meeting-video__remote--me-grid",
        variant === "grid" && "meeting-video__remote--grid",
        isFocused && "meeting-video__remote--focused",
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
