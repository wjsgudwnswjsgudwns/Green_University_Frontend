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
 * 요구사항:
 * - WS 수신 후 즉시 WebRTC resync 시도 X
 * - 딜레이 후 1회 시도
 * - 여기서는 window CustomEvent("janus:resync")만 발사
 *
 * ✅ 이번 수정 핵심(완성본):
 * - (중요) convenience 필드는 "항상" 반환해서 stale(이전 값 잔상) 제거
 *   -> screenCapturing OFF인데 타일이 남아 "두 명 튀는" 현상 방지
 * - camera/screen 전환 신호가 intent 로만 와도(resyncRelevant면) resync 트리거 허용
 * - extra 가 중첩(extra.extra)되어 와도 videoSource/screenCapturing 등이 payload에 실리게 평탄화
 * - soft on/off 같은 UI-only는 skipResync로 resync 스킵 가능
 * - (옵션) 동일 key의 resync 예약은 유지(중복 재예약 방지)로 깜빡임 감소
 */

const INTENT_TTL_MS = 3500;

// ✅ WS 수신 → WebRTC resync 트리거 딜레이(1회)
const RESYNC_DELAY_MS = 120;

// ✅ 필요 시 true로 올려서 send/recv 확인
const DEBUG_SIGNAL = false;

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

    // resync timers per remote user
    const resyncTimersRef = useRef(new Map()); // uidKey -> { t, lastKey, lastAt }

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
                if (v?.t) clearTimeout(v.t);
            } catch {}
        }
        m.clear();
    }, []);

    const disconnect = useCallback(() => {
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

    // ---------------- utils ----------------
    const pickEffective = (item) => item?.commit || item?.intent || null;

    // ✅ extra가 (extra.extra) 중첩되는 케이스까지 평탄화
    const flattenExtra = useCallback((extra) => {
        const e0 = extra && typeof extra === "object" ? extra : {};
        const e1 = e0.extra && typeof e0.extra === "object" ? e0.extra : {};
        const merged = { ...e1, ...e0 }; // 바깥 extra가 우선
        return merged;
    }, []);

    const normalizePhase = useCallback((payload) => {
        const p =
            payload?.phase ??
            payload?.extra?.phase ??
            payload?.extra?.extra?.phase;

        if (p === "intent" || p === "commit") return p;
        return "commit";
    }, []);

    const readField = useCallback((payload, key) => {
        if (!payload) return undefined;

        if (payload[key] !== undefined) return payload[key];

        const e0 = payload?.extra;
        if (e0 && typeof e0 === "object" && e0[key] !== undefined)
            return e0[key];

        const e1 = e0?.extra;
        if (e1 && typeof e1 === "object" && e1[key] !== undefined)
            return e1[key];

        return undefined;
    }, []);

    /**
     * ✅ convenience: UI가 참고하는 최종 표시값
     * - 중요: "항상" 필드를 반환해서 stale(이전 값 잔상) 제거
     *   -> screenCapturing OFF인데 이전 true가 남는 문제 차단
     */
    const buildEffectiveConvenience = (baseItem) => {
        const eff = pickEffective(baseItem);

        const commitTs = baseItem?.commitUpdatedAt ?? null;
        const intentTs = baseItem?.intentUpdatedAt ?? null;
        const effectiveUpdatedAt =
            commitTs != null ? commitTs : intentTs != null ? intentTs : null;

        const src = eff || {};
        const extra =
            src?.extra && typeof src.extra === "object" ? src.extra : {};

        const asBool = (v) => (typeof v === "boolean" ? v : undefined);
        const asStr = (v) => (typeof v === "string" ? v : undefined);

        return {
            // audio/video는 eff가 있으면 그걸, 없으면 기존 baseItem의 최종값 유지
            audio:
                typeof src.audio === "boolean"
                    ? src.audio
                    : typeof baseItem?.audio === "boolean"
                    ? baseItem.audio
                    : undefined,
            video:
                typeof src.video === "boolean"
                    ? src.video
                    : typeof baseItem?.video === "boolean"
                    ? baseItem.video
                    : undefined,

            // ✅ 항상 반환: 없으면 undefined로 덮어서 stale 제거
            videoDeviceLost: asBool(extra.videoDeviceLost),
            videoSource: asStr(extra.videoSource),
            screenSoftMuted: asBool(extra.screenSoftMuted),
            screenCapturing: asBool(extra.screenCapturing),

            receivedAt: src.receivedAt ?? baseItem?.receivedAt,
            updatedAt: effectiveUpdatedAt,
        };
    };

    // ✅ “camera/screen 전환”은 보통 여기 값들로 구분됨
    const isResyncRelevant = useCallback(
        (payload) => {
            if (!payload) return false;

            // ✅ soft 같은 UI-only 신호는 resync 스킵 가능
            if (readField(payload, "skipResync") === true) return false;

            // 강제 플래그
            if (readField(payload, "forceResync") === true) return true;

            const vs = readField(payload, "videoSource");
            const cap = readField(payload, "screenCapturing");
            const soft = readField(payload, "screenSoftMuted");
            const lost = readField(payload, "videoDeviceLost");

            return (
                typeof vs === "string" ||
                typeof cap === "boolean" ||
                typeof soft === "boolean" ||
                typeof lost === "boolean"
            );
        },
        [readField]
    );

    // ---------------- resync trigger ----------------
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

            const phase = normalizePhase(payload);

            // ✅ 원래는 commit만 트리거였는데,
            // camera/screen은 intent만 날아오는 경우가 있어서 resyncRelevant면 intent도 허용
            if (
                phase !== "commit" &&
                !(phase === "intent" && isResyncRelevant(payload))
            ) {
                return false;
            }

            // type이 있으면 호환 검사(너무 엄격하면 resync 못 하니 "있으면 검사" 수준)
            if (typeof payload.type === "string") {
                const allow = payload.type === "MEDIA_STATE";
                const allowSnapshotItem =
                    payload.type === "MEDIA_SNAPSHOT_ITEM";
                if (!allow && !allowSnapshotItem) {
                    if (!isResyncRelevant(payload)) return false;
                }
            }

            return true;
        },
        [currentUserId, normalizePhase, isResyncRelevant]
    );

    const dispatchResyncEvent = useCallback(
        (payload, attempt, reason) => {
            try {
                const uid = payload?.userId;
                if (uid == null) return;

                const vs = readField(payload, "videoSource");
                const screenCapturing = readField(payload, "screenCapturing");
                const phase = normalizePhase(payload);

                if (DEBUG_SIGNAL) {
                    console.log("[mediaSignals] dispatchResyncEvent", {
                        uid,
                        phase,
                        attempt,
                        reason,
                        vs,
                        screenCapturing,
                    });
                }

                window.dispatchEvent(
                    new CustomEvent("janus:resync", {
                        detail: {
                            meetingId,
                            userId: uid,
                            display: payload?.display,
                            phase, // commit or intent
                            ts:
                                typeof payload.ts === "number"
                                    ? payload.ts
                                    : null,
                            attempt, // 1
                            reason,
                            audio:
                                typeof payload.audio === "boolean"
                                    ? payload.audio
                                    : undefined,
                            video:
                                typeof payload.video === "boolean"
                                    ? payload.video
                                    : undefined,
                            videoSource:
                                typeof vs === "string" ? vs : undefined,
                            screenCapturing:
                                typeof screenCapturing === "boolean"
                                    ? screenCapturing
                                    : undefined,
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
        [meetingId, readField, normalizePhase]
    );

    // ✅ 1회만 예약
    const scheduleResyncOnce = useCallback(
        (payload) => {
            if (readField(payload, "forceResync") !== true) {
                if (readField(payload, "skipResync") === true) return;
            }

            if (!shouldTriggerResync(payload)) return;
            if (!mountedRef.current) return;

            const uidKey = String(payload.userId);
            const seqAt = connectSeqRef.current;

            const vs = readField(payload, "videoSource");
            const cap = readField(payload, "screenCapturing");

            const keyParts = [
                normalizePhase(payload),
                typeof payload.video === "boolean" ? `v=${payload.video}` : "",
                typeof payload.audio === "boolean" ? `a=${payload.audio}` : "",
                typeof vs === "string" ? `src=${vs}` : "",
                typeof cap === "boolean" ? `cap=${cap}` : "",
                readField(payload, "forceResync") === true ? "force=1" : "",
            ].join("|");

            const m = resyncTimersRef.current;
            const prev = m.get(uidKey);

            // ✅ 동일 key면 재예약하지 않음(깜빡임/튀는 느낌 감소)
            if (prev?.lastKey === keyParts) {
                if (DEBUG_SIGNAL) {
                    console.log(
                        "[mediaSignals] scheduleResyncOnce skip (same key)",
                        uidKey,
                        keyParts
                    );
                }
                return;
            }

            // 이전 예약 취소
            try {
                if (prev?.t) clearTimeout(prev.t);
            } catch {}

            if (DEBUG_SIGNAL) {
                console.log(
                    "[mediaSignals] scheduleResyncOnce",
                    uidKey,
                    keyParts
                );
            }

            const t = setTimeout(() => {
                if (!mountedRef.current) return;
                if (seqAt !== connectSeqRef.current) return;
                dispatchResyncEvent(payload, 1, "ws-delayed");
            }, RESYNC_DELAY_MS);

            m.set(uidKey, { t, lastKey: keyParts, lastAt: Date.now() });
        },
        [shouldTriggerResync, dispatchResyncEvent, normalizePhase, readField]
    );

    // ---------------- local apply (commit only) ----------------
    const applyLocalCommit = useCallback(
        (audio, video, extra = {}) => {
            if (currentUserId == null) return;

            const flat = flattenExtra(extra);
            const ts = typeof flat.ts === "number" ? flat.ts : Date.now();

            const myKey = String(currentUserId);
            const myDisplay = display || String(currentUserId);

            const phasePayload = {
                audio: !!audio,
                video: !!video,
                extra: { ...(flat || {}), phase: "commit" },
                updatedAt: ts,
                receivedAt: Date.now(),
            };

            lastLocalRef.current = {
                audio: !!audio,
                video: !!video,
                videoDeviceLost:
                    typeof flat.videoDeviceLost === "boolean"
                        ? !!flat.videoDeviceLost
                        : undefined,
                videoSource:
                    typeof flat.videoSource === "string"
                        ? flat.videoSource
                        : undefined,
                screenSoftMuted:
                    typeof flat.screenSoftMuted === "boolean"
                        ? !!flat.screenSoftMuted
                        : undefined,
                screenCapturing:
                    typeof flat.screenCapturing === "boolean"
                        ? !!flat.screenCapturing
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
        [currentUserId, display, flattenExtra]
    );

    // ---------------- send now ----------------
    const sendMediaStateNow = useCallback(
        (audio, video, extra = {}) => {
            if (!meetingId || currentUserId == null) return;

            const flat = flattenExtra(extra);

            const phase =
                flat?.phase === "intent" || flat?.phase === "commit"
                    ? flat.phase
                    : "commit";

            const ts = Date.now();
            const myDisplay = display || String(currentUserId);

            // commit일 때만 로컬 즉시 반영
            if (phase === "commit") {
                applyLocalCommit(audio, video, { ...flat, ts });
            }

            // 연결 안 됐으면 종료
            if (!stompRef.current || !connectedRef.current) {
                if (DEBUG_SIGNAL) {
                    console.warn(
                        "[mediaSignals] send skipped (not connected)",
                        {
                            meetingId,
                            phase,
                            audio,
                            video,
                            flat,
                        }
                    );
                }
                return;
            }

            const payload = {
                meetingId,
                userId: currentUserId,
                display: myDisplay,
                audio: !!audio,
                video: !!video,
                ts,
                phase,

                // ✅ 전환/화면공유 관련 필드
                ...(typeof flat.videoDeviceLost === "boolean"
                    ? { videoDeviceLost: !!flat.videoDeviceLost }
                    : {}),
                ...(typeof flat.videoSource === "string"
                    ? { videoSource: flat.videoSource }
                    : {}),
                ...(typeof flat.screenSoftMuted === "boolean"
                    ? { screenSoftMuted: !!flat.screenSoftMuted }
                    : {}),
                ...(typeof flat.screenCapturing === "boolean"
                    ? { screenCapturing: !!flat.screenCapturing }
                    : {}),

                ...(typeof flat.forceResync === "boolean"
                    ? { forceResync: !!flat.forceResync }
                    : {}),
                ...(typeof flat.skipResync === "boolean"
                    ? { skipResync: !!flat.skipResync }
                    : {}),

                // ✅ type 기본값
                type: typeof flat.type === "string" ? flat.type : "MEDIA_STATE",
                ...(typeof flat.reason === "string"
                    ? { reason: flat.reason }
                    : {}),
            };

            if (DEBUG_SIGNAL) {
                console.log("[mediaSignals] SEND", payload);
            }

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
        [meetingId, currentUserId, display, applyLocalCommit, flattenExtra]
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
            forceResync: true,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected]);

    // ---------------- incoming apply ----------------
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

            // ✅ extra 평탄화(중첩 extra.extra 대응)
            const flat = flattenExtra(payload?.extra);

            const extra = {
                ...(flat || {}),

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
                ...(typeof payload.skipResync === "boolean"
                    ? { skipResync: payload.skipResync }
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
        [currentUserId, normalizePhase, flattenExtra]
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

                        // intent 제거 후 convenience를 다시 계산(= stale 제거 유지)
                        const cleanedBase = {
                            ...rest,
                            intent: undefined,
                            intentUpdatedAt: rest.intentUpdatedAt ?? null,
                        };

                        next[uid] = {
                            ...cleanedBase,
                            ...buildEffectiveConvenience(cleanedBase),
                        };
                        changed = true;
                    }
                });

                return changed ? next : prev;
            });
        }, 800);

        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------------- connect ----------------
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

                        if (DEBUG_SIGNAL) {
                            console.log(
                                "[mediaSignals] RECV",
                                payload?.type,
                                payload?.userId,
                                payload
                            );
                        }

                        // snapshot
                        if (
                            payload?.type === "MEDIA_SNAPSHOT" &&
                            Array.isArray(payload.states)
                        ) {
                            for (const st of payload.states) {
                                applyIncomingStateTwice(st, 120);
                                scheduleResyncOnce(st);
                            }
                            return;
                        }

                        // single
                        applyIncomingStateTwice(payload, 120);
                        scheduleResyncOnce(payload);
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
        scheduleResyncOnce,
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
