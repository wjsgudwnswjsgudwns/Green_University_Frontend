// src/hooks/useMeetingMediaSignals.js
import { useCallback, useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

/**
 * 정책:
 * - 표시용 상태는 commit 우선(없으면 intent)
 * - intent는 TTL로 자동 만료
 * - 내 에코 메시지는 무시
 * - payload.ts 없는 메시지로 updatedAt을 Date.now()로 강제하지 않음
 * - disconnect 시 connectSeq 증가(늦게 오는 콜백/메시지 차단)
 *
 * 추가(요구사항):
 * - WS 수신 후 즉시 WebRTC resync 시도 X
 * - 딜레이 후 1차, 다시 딜레이 후 2차 시도
 * - 여기서는 window CustomEvent("janus:resync")만 발사
 */

const INTENT_TTL_MS = 3500;

// ✅ WS 수신 → WebRTC resync 트리거 딜레이
const RESYNC_DELAY_1_MS = 260;
const RESYNC_DELAY_2_MS = 720;

export function useMeetingMediaSignals(meetingId, currentUserId, display) {
    const [mediaStates, setMediaStates] = useState({});
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subscriptionRef = useRef(null);

    const connectedRef = useRef(false);
    const mountedRef = useRef(false);
    const connectSeqRef = useRef(0);

    // last local commit snapshot
    const lastLocalRef = useRef(null);

    const pendingSendRef = useRef(null); // { audio, video, extra }
    const sendDebounceTimerRef = useRef(null);

    // ✅ resync timers per remote user
    // Map<uidKey, { t1: any, t2: any, lastKey: string }>
    const resyncTimersRef = useRef(new Map());

    const WS_URL =
        process.env.REACT_APP_WS_URL || "http://localhost:8881/ws-chat";

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const safeSetConnected = useCallback((v) => {
        if (!mountedRef.current) return;
        setConnected(v);
    }, []);

    useEffect(() => {
        connectedRef.current = connected;
    }, [connected]);

    const clearSendDebounce = useCallback(() => {
        if (sendDebounceTimerRef.current) {
            clearTimeout(sendDebounceTimerRef.current);
            sendDebounceTimerRef.current = null;
        }
        pendingSendRef.current = null;
    }, []);

    const clearAllResyncTimers = useCallback(() => {
        const m = resyncTimersRef.current;
        for (const [, v] of m.entries()) {
            try {
                if (v?.t1) clearTimeout(v.t1);
                if (v?.t2) clearTimeout(v.t2);
            } catch {}
        }
        m.clear();
    }, []);

    const disconnect = useCallback(() => {
        // ✅ 이전 연결 무효화
        connectSeqRef.current += 1;

        try {
            subscriptionRef.current?.unsubscribe?.();
        } catch {}
        subscriptionRef.current = null;

        const client = stompRef.current;
        stompRef.current = null;

        try {
            client?.deactivate?.();
        } catch {
            try {
                client?.disconnect?.(() => {});
            } catch {}
        }

        connectedRef.current = false;
        safeSetConnected(false);

        clearSendDebounce();
        clearAllResyncTimers();
    }, [safeSetConnected, clearSendDebounce, clearAllResyncTimers]);

    // meetingId 바뀌면 잔상 제거(+ 로컬/펜딩/타이머도 초기화)
    useEffect(() => {
        setMediaStates({});
        lastLocalRef.current = null;
        clearSendDebounce();
        clearAllResyncTimers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetingId]);

    // -------- utils --------
    const pickEffective = (item) => item?.commit || item?.intent || null;

    const normalizePhase = useCallback((payload) => {
        const p = payload?.phase || payload?.extra?.phase;
        if (p === "intent" || p === "commit") return p;
        return "commit";
    }, []);

    const buildEffectiveConvenience = (prevItem) => {
        const eff = pickEffective(prevItem);
        if (!eff) {
            return {
                audio: prevItem?.audio,
                video: prevItem?.video,
                videoDeviceLost: prevItem?.videoDeviceLost,
                videoSource: prevItem?.videoSource,
                screenSoftMuted: prevItem?.screenSoftMuted,
                screenCapturing: prevItem?.screenCapturing,
                receivedAt: prevItem?.receivedAt,
                updatedAt: prevItem?.updatedAt ?? null,
            };
        }

        const extra = eff.extra || {};
        const hasLost = typeof extra.videoDeviceLost === "boolean";
        const hasVideoSource = typeof extra.videoSource === "string";
        const hasSoftMuted = typeof extra.screenSoftMuted === "boolean";
        const hasCapturing = typeof extra.screenCapturing === "boolean";

        const commitTs = prevItem?.commitUpdatedAt ?? null;
        const intentTs = prevItem?.intentUpdatedAt ?? null;

        const effectiveUpdatedAt =
            commitTs != null ? commitTs : intentTs != null ? intentTs : null;

        return {
            audio: typeof eff.audio === "boolean" ? eff.audio : prevItem?.audio,
            video: typeof eff.video === "boolean" ? eff.video : prevItem?.video,

            ...(hasLost ? { videoDeviceLost: !!extra.videoDeviceLost } : {}),
            ...(hasVideoSource ? { videoSource: extra.videoSource } : {}),
            ...(hasSoftMuted
                ? { screenSoftMuted: !!extra.screenSoftMuted }
                : {}),
            ...(hasCapturing
                ? { screenCapturing: !!extra.screenCapturing }
                : {}),

            receivedAt: eff.receivedAt,
            updatedAt: effectiveUpdatedAt,
        };
    };

    // -------- WebRTC resync trigger (WS receive -> delayed 1st/2nd) --------
    const shouldTriggerResync = useCallback(
        (payload) => {
            if (!payload) return false;

            // 내 에코 제외
            if (
                currentUserId != null &&
                payload?.userId != null &&
                String(payload.userId) === String(currentUserId)
            ) {
                return false;
            }

            // commit만
            const phase = normalizePhase(payload);
            if (phase !== "commit") return false;

            // type이 있으면 호환 검사(너무 엄격하면 resync 못 하니 "있으면 검사" 수준)
            if (typeof payload.type === "string") {
                const allow = payload.type === "MEDIA_STATE";
                const allowSnapshotItem =
                    payload.type === "MEDIA_SNAPSHOT_ITEM";
                if (!allow && !allowSnapshotItem) {
                    const hasAny =
                        typeof payload.audio === "boolean" ||
                        typeof payload.video === "boolean" ||
                        typeof payload.videoSource === "string" ||
                        typeof payload.screenCapturing === "boolean" ||
                        typeof payload.screenSoftMuted === "boolean" ||
                        typeof payload.videoDeviceLost === "boolean";
                    if (!hasAny) return false;
                }
            }

            return true;
        },
        [currentUserId, normalizePhase]
    );

    const dispatchResyncEvent = useCallback(
        (payload, attempt, reason) => {
            try {
                const uid = payload?.userId;
                if (uid == null) return;

                const vs =
                    typeof payload.videoSource === "string"
                        ? payload.videoSource
                        : typeof payload?.extra?.videoSource === "string"
                        ? payload.extra.videoSource
                        : undefined;

                const screenCapturing =
                    typeof payload.screenCapturing === "boolean"
                        ? payload.screenCapturing
                        : typeof payload?.extra?.screenCapturing === "boolean"
                        ? payload.extra.screenCapturing
                        : undefined;

                window.dispatchEvent(
                    new CustomEvent("janus:resync", {
                        detail: {
                            meetingId,
                            userId: uid,
                            display: payload?.display,
                            phase: "commit",
                            ts:
                                typeof payload.ts === "number"
                                    ? payload.ts
                                    : null,
                            attempt, // 1 or 2
                            reason,
                            audio:
                                typeof payload.audio === "boolean"
                                    ? payload.audio
                                    : undefined,
                            video:
                                typeof payload.video === "boolean"
                                    ? payload.video
                                    : undefined,
                            videoSource: vs,
                            screenCapturing,
                        },
                    })
                );
            } catch (e) {
                console.warn(
                    "[useMeetingMediaSignals] dispatchResyncEvent error",
                    e
                );
            }
        },
        [meetingId]
    );

    const scheduleResyncTwice = useCallback(
        (payload) => {
            if (!shouldTriggerResync(payload)) return;
            if (!mountedRef.current) return;

            const uidKey = String(payload.userId);
            const seqAt = connectSeqRef.current;

            // 이전 예약 취소
            const m = resyncTimersRef.current;
            const prev = m.get(uidKey);
            try {
                if (prev?.t1) clearTimeout(prev.t1);
                if (prev?.t2) clearTimeout(prev.t2);
            } catch {}

            // 변경 식별 키(스팸 방지용)
            const keyParts = [
                normalizePhase(payload),
                typeof payload.ts === "number" ? payload.ts : "no-ts",
                typeof payload.video === "boolean" ? `v=${payload.video}` : "",
                typeof payload.audio === "boolean" ? `a=${payload.audio}` : "",
                typeof payload.videoSource === "string"
                    ? `src=${payload.videoSource}`
                    : typeof payload?.extra?.videoSource === "string"
                    ? `src=${payload.extra.videoSource}`
                    : "",
                typeof payload.screenCapturing === "boolean"
                    ? `cap=${payload.screenCapturing}`
                    : typeof payload?.extra?.screenCapturing === "boolean"
                    ? `cap=${payload.extra.screenCapturing}`
                    : "",
            ].join("|");

            const t1 = setTimeout(() => {
                if (!mountedRef.current) return;
                if (seqAt !== connectSeqRef.current) return;
                dispatchResyncEvent(payload, 1, "ws-delayed-1");
            }, RESYNC_DELAY_1_MS);

            const t2 = setTimeout(() => {
                if (!mountedRef.current) return;
                if (seqAt !== connectSeqRef.current) return;
                dispatchResyncEvent(payload, 2, "ws-delayed-2");
            }, RESYNC_DELAY_2_MS);

            m.set(uidKey, { t1, t2, lastKey: keyParts });
        },
        [shouldTriggerResync, dispatchResyncEvent, normalizePhase]
    );

    // -------- local apply (commit only) --------
    const applyLocalCommit = useCallback(
        (audio, video, extra = {}) => {
            if (currentUserId == null) return;

            const ts = typeof extra.ts === "number" ? extra.ts : Date.now();
            const myKey = String(currentUserId);
            const myDisplay = display || String(currentUserId);

            const phasePayload = {
                audio: !!audio,
                video: !!video,
                extra: { ...(extra || {}), phase: "commit" },
                updatedAt: ts,
                receivedAt: Date.now(),
            };

            lastLocalRef.current = {
                audio: !!audio,
                video: !!video,
                videoDeviceLost:
                    typeof extra.videoDeviceLost === "boolean"
                        ? !!extra.videoDeviceLost
                        : undefined,
                videoSource:
                    typeof extra.videoSource === "string"
                        ? extra.videoSource
                        : undefined,
                screenSoftMuted:
                    typeof extra.screenSoftMuted === "boolean"
                        ? !!extra.screenSoftMuted
                        : undefined,
                screenCapturing:
                    typeof extra.screenCapturing === "boolean"
                        ? !!extra.screenCapturing
                        : undefined,
                display: myDisplay,
                ts,
            };

            setMediaStates((prev) => {
                const prevItem = prev?.[myKey] || {};
                const nextItemBase = {
                    ...prevItem,
                    display: myDisplay || prevItem.display || myKey,
                    known: true,
                    commit: phasePayload,
                    commitUpdatedAt: ts,
                };

                return {
                    ...(prev || {}),
                    [myKey]: {
                        ...nextItemBase,
                        ...buildEffectiveConvenience(nextItemBase),
                    },
                };
            });
        },
        [currentUserId, display]
    );

    // -------- send now --------
    const sendMediaStateNow = useCallback(
        (audio, video, extra = {}) => {
            if (!meetingId || currentUserId == null) return;

            const phase =
                extra?.phase === "intent" || extra?.phase === "commit"
                    ? extra.phase
                    : "commit";

            const ts = Date.now();
            const myDisplay = display || String(currentUserId);

            // commit일 때만 로컬 즉시 반영
            if (phase === "commit") {
                applyLocalCommit(audio, video, { ...extra, ts });
            }

            // 연결 안 됐으면 종료
            if (!stompRef.current || !connectedRef.current) return;

            const payload = {
                meetingId,
                userId: currentUserId,
                display: myDisplay,
                audio: !!audio,
                video: !!video,
                ts,
                phase,

                ...(typeof extra.videoDeviceLost === "boolean"
                    ? { videoDeviceLost: !!extra.videoDeviceLost }
                    : {}),
                ...(typeof extra.videoSource === "string"
                    ? { videoSource: extra.videoSource }
                    : {}),
                ...(typeof extra.screenSoftMuted === "boolean"
                    ? { screenSoftMuted: !!extra.screenSoftMuted }
                    : {}),
                ...(typeof extra.screenCapturing === "boolean"
                    ? { screenCapturing: !!extra.screenCapturing }
                    : {}),

                // ✅ (추가) 디버그/표시용 - 없어도 동작엔 영향 없음
                ...(typeof extra.forceResync === "boolean"
                    ? { forceResync: !!extra.forceResync }
                    : {}),

                ...(typeof extra.type === "string" ? { type: extra.type } : {}),
                ...(typeof extra.reason === "string"
                    ? { reason: extra.reason }
                    : {}),
            };

            try {
                stompRef.current.send(
                    `/pub/meetings/${meetingId}/signals`,
                    {},
                    JSON.stringify(payload)
                );
            } catch (e) {
                console.error("[useMeetingMediaSignals] send error", e);
            }
        },
        [meetingId, currentUserId, display, applyLocalCommit]
    );

    // 마지막 상태만 디바운스 전송
    const sendMediaState = useCallback(
        (audio, video, extra = {}) => {
            pendingSendRef.current = { audio: !!audio, video: !!video, extra };

            if (sendDebounceTimerRef.current) {
                clearTimeout(sendDebounceTimerRef.current);
            }

            sendDebounceTimerRef.current = setTimeout(() => {
                sendDebounceTimerRef.current = null;
                const p = pendingSendRef.current;
                pendingSendRef.current = null;
                if (!p) return;
                sendMediaStateNow(p.audio, p.video, p.extra);
            }, 180);
        },
        [sendMediaStateNow]
    );

    // 연결되면 내 최신 commit 1회 재전송
    useEffect(() => {
        if (!connected || !meetingId || currentUserId == null) return;

        const mine = lastLocalRef.current;
        if (!mine) return;

        sendMediaStateNow(mine.audio, mine.video, {
            ...(typeof mine.videoDeviceLost === "boolean"
                ? { videoDeviceLost: mine.videoDeviceLost }
                : {}),
            ...(typeof mine.videoSource === "string"
                ? { videoSource: mine.videoSource }
                : {}),
            ...(typeof mine.screenSoftMuted === "boolean"
                ? { screenSoftMuted: mine.screenSoftMuted }
                : {}),
            ...(typeof mine.screenCapturing === "boolean"
                ? { screenCapturing: mine.screenCapturing }
                : {}),
            type: "MEDIA_STATE",
            reason: "ws-resync",
            phase: "commit",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected]);

    // -------- incoming apply --------
    const applyIncomingState = useCallback(
        (payload) => {
            const userId = payload?.userId;
            if (userId == null) return;

            // 내 에코 무시
            if (
                currentUserId != null &&
                String(userId) === String(currentUserId)
            ) {
                return;
            }

            const uidKey = String(userId);
            const phase = normalizePhase(payload);

            const payloadTs =
                typeof payload.ts === "number" ? payload.ts : null;

            const hasAudio = typeof payload.audio === "boolean";
            const hasVideo = typeof payload.video === "boolean";

            const extra = {
                ...(payload?.extra || {}),
                ...(typeof payload.videoDeviceLost === "boolean"
                    ? { videoDeviceLost: payload.videoDeviceLost }
                    : {}),
                ...(typeof payload.videoSource === "string"
                    ? { videoSource: payload.videoSource }
                    : {}),
                ...(typeof payload.screenSoftMuted === "boolean"
                    ? { screenSoftMuted: payload.screenSoftMuted }
                    : {}),
                ...(typeof payload.screenCapturing === "boolean"
                    ? { screenCapturing: payload.screenCapturing }
                    : {}),
                ...(typeof payload.forceResync === "boolean"
                    ? { forceResync: payload.forceResync }
                    : {}),
                ...(typeof payload.type === "string"
                    ? { type: payload.type }
                    : {}),
                ...(typeof payload.reason === "string"
                    ? { reason: payload.reason }
                    : {}),
                phase,
            };

            setMediaStates((prev) => {
                const prevItem = prev?.[uidKey] || {};

                // phase별 out-of-order 방지(ts 있는 경우만)
                if (payloadTs != null) {
                    const prevPhaseTs =
                        phase === "commit"
                            ? prevItem.commitUpdatedAt
                            : prevItem.intentUpdatedAt;

                    if (prevPhaseTs != null && payloadTs < prevPhaseTs) {
                        return prev;
                    }
                }

                const nextPhaseUpdatedAt =
                    payloadTs != null
                        ? payloadTs
                        : phase === "commit"
                        ? prevItem.commitUpdatedAt ?? null
                        : prevItem.intentUpdatedAt ?? null;

                const bucketPayload = {
                    ...(hasAudio ? { audio: payload.audio } : {}),
                    ...(hasVideo ? { video: payload.video } : {}),
                    extra,
                    updatedAt: payloadTs != null ? payloadTs : null,
                    receivedAt: Date.now(),
                };

                const nextItemBase = {
                    ...prevItem,
                    display: payload.display || prevItem.display || uidKey,
                    known: true,

                    ...(phase === "commit"
                        ? {
                              commit: {
                                  ...(prevItem.commit || {}),
                                  ...bucketPayload,
                              },
                              commitUpdatedAt: nextPhaseUpdatedAt,
                          }
                        : {
                              intent: {
                                  ...(prevItem.intent || {}),
                                  ...bucketPayload,
                              },
                              intentUpdatedAt: nextPhaseUpdatedAt,
                          }),
                };

                return {
                    ...(prev || {}),
                    [uidKey]: {
                        ...nextItemBase,
                        ...buildEffectiveConvenience(nextItemBase),
                    },
                };
            });
        },
        [currentUserId, normalizePhase]
    );

    const applyIncomingStateTwice = useCallback(
        (payload, delayMs = 120) => {
            applyIncomingState(payload);

            const seqAt = connectSeqRef.current;
            setTimeout(() => {
                if (!mountedRef.current) return;
                if (seqAt !== connectSeqRef.current) return;
                applyIncomingState(payload);
            }, delayMs);
        },
        [applyIncomingState]
    );

    // intent TTL cleanup
    useEffect(() => {
        const t = setInterval(() => {
            setMediaStates((prev) => {
                const next = { ...(prev || {}) };
                const now = Date.now();
                let changed = false;

                Object.keys(next).forEach((uid) => {
                    const item = next[uid];
                    if (!item?.intent?.receivedAt) return;

                    if (now - item.intent.receivedAt > INTENT_TTL_MS) {
                        const { intent, ...rest } = item;
                        const cleaned = {
                            ...rest,
                            intent: undefined,
                            intentUpdatedAt: rest.intentUpdatedAt ?? null,
                        };

                        next[uid] = {
                            ...cleaned,
                            ...buildEffectiveConvenience(cleaned),
                        };
                        changed = true;
                    }
                });

                return changed ? next : prev;
            });
        }, 800);

        return () => clearInterval(t);
    }, []);

    // -------- connect --------
    useEffect(() => {
        if (!meetingId || currentUserId == null) return;

        const seq = ++connectSeqRef.current;
        const stomp = Stomp.over(() => new SockJS(WS_URL));
        stomp.debug = () => {};

        stomp.reconnectDelay = 2000;
        stomp.heartbeatIncoming = 10000;
        stomp.heartbeatOutgoing = 10000;

        stompRef.current = stomp;

        stomp.connect(
            {},
            () => {
                if (!mountedRef.current) return;
                if (seq !== connectSeqRef.current) return;
                if (stompRef.current !== stomp) return;

                connectedRef.current = true;
                safeSetConnected(true);

                subscriptionRef.current = stomp.subscribe(
                    `/sub/meetings/${meetingId}/signals`,
                    (message) => {
                        if (seq !== connectSeqRef.current) return;

                        let payload;
                        try {
                            payload = JSON.parse(message.body);
                        } catch {
                            return;
                        }

                        // snapshot
                        if (
                            payload?.type === "MEDIA_SNAPSHOT" &&
                            Array.isArray(payload.states)
                        ) {
                            for (const st of payload.states) {
                                applyIncomingStateTwice(st, 120);
                                scheduleResyncTwice(st);
                            }
                            return;
                        }

                        // single
                        applyIncomingStateTwice(payload, 120);
                        scheduleResyncTwice(payload);
                    }
                );
            },
            () => {
                if (!mountedRef.current) return;
                if (seq !== connectSeqRef.current) return;
                connectedRef.current = false;
                safeSetConnected(false);
            }
        );

        return disconnect;
    }, [
        meetingId,
        currentUserId,
        disconnect,
        safeSetConnected,
        WS_URL,
        applyIncomingStateTwice,
        scheduleResyncTwice,
    ]);

    const getMediaState = useCallback(
        (userId) => mediaStates?.[String(userId)] || null,
        [mediaStates]
    );

    return {
        mediaStates,
        getMediaState,
        sendMediaStateNow,
        sendMediaState,
        mediaSignalConnected: connected,
    };
}
