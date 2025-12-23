// src/hooks/useMeetingMediaSignals.js
import { useCallback, useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

/**
 * mediaStates: {
 *   [userId]: {
 *     audio?: boolean,
 *     video?: boolean,
 *     videoDeviceLost?: boolean,
 *     videoSource?: "camera" | "screen",
 *     screenSoftMuted?: boolean,
 *     screenCapturing?: boolean,
 *     display: string,
 *     updatedAt: number,     // payload.ts 기준(없으면 기존 유지)
 *     receivedAt?: number,   // 수신 시각(Date.now)
 *     known?: boolean,
 *   }
 * }
 *
 * - audio/video/... 는 "모르면 undefined 유지"
 * - 로컬 apply도 known/receivedAt 세팅해서 UI 흔들림 방지
 * - meetingId 바뀌면 이전 signals 잔상 제거(+ lastLocal/pending도 초기화)
 * - MEDIA_SNAPSHOT(type) 지원
 * - out-of-order 방지: payload.ts가 있을 때만 엄격 비교
 */
export function useMeetingMediaSignals(meetingId, currentUserId, display) {
    const [mediaStates, setMediaStates] = useState({});
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subscriptionRef = useRef(null);

    const connectedRef = useRef(false);
    const mountedRef = useRef(false);

    // { audio, video, videoDeviceLost, videoSource, screenSoftMuted, screenCapturing, display, ts }
    const lastLocalRef = useRef(null);

    const pendingSendRef = useRef(null); // { audio, video, extra }
    const sendDebounceTimerRef = useRef(null);

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

    const disconnect = useCallback(() => {
        // sub 해제
        try {
            subscriptionRef.current?.unsubscribe?.();
        } catch {}
        subscriptionRef.current = null;

        // stomp 정리(가능하면 deactivate 우선)
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
    }, [safeSetConnected, clearSendDebounce]);

    // 회의 바뀌면 잔상 제거(+ 로컬/펜딩도 초기화)
    useEffect(() => {
        setMediaStates({});
        lastLocalRef.current = null;
        clearSendDebounce();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetingId]);

    // 로컬 즉시 반영
    const applyLocalState = useCallback(
        (audio, video, extra = {}) => {
            if (currentUserId == null) return;

            const ts = typeof extra.ts === "number" ? extra.ts : Date.now();
            const myKey = String(currentUserId);
            const myDisplay = display || String(currentUserId);

            const hasLost = typeof extra.videoDeviceLost === "boolean";
            const hasVideoSource = typeof extra.videoSource === "string";
            const hasSoftMuted = typeof extra.screenSoftMuted === "boolean";
            const hasCapturing = typeof extra.screenCapturing === "boolean";

            // ✅ “내 최신 상태”는 별도 보관 (WS 재연결 resync용)
            lastLocalRef.current = {
                audio: !!audio,
                video: !!video,
                videoDeviceLost: hasLost ? !!extra.videoDeviceLost : undefined,
                videoSource: hasVideoSource ? extra.videoSource : undefined,
                screenSoftMuted: hasSoftMuted
                    ? !!extra.screenSoftMuted
                    : undefined,
                screenCapturing: hasCapturing
                    ? !!extra.screenCapturing
                    : undefined,
                display: myDisplay,
                ts,
            };

            setMediaStates((prev) => ({
                ...prev,
                [myKey]: {
                    ...prev?.[myKey],
                    audio: !!audio,
                    video: !!video,
                    ...(hasLost
                        ? { videoDeviceLost: !!extra.videoDeviceLost }
                        : {}),
                    ...(hasVideoSource
                        ? { videoSource: extra.videoSource }
                        : {}),
                    ...(hasSoftMuted
                        ? { screenSoftMuted: !!extra.screenSoftMuted }
                        : {}),
                    ...(hasCapturing
                        ? { screenCapturing: !!extra.screenCapturing }
                        : {}),
                    display: myDisplay || prev?.[myKey]?.display || myKey,
                    updatedAt: ts,
                    receivedAt: Date.now(),
                    known: true,
                },
            }));
        },
        [currentUserId, display]
    );

    const sendMediaStateNow = useCallback(
        (audio, video, extra = {}) => {
            if (!meetingId || currentUserId == null) return;

            const ts = Date.now();
            const myDisplay = display || String(currentUserId);

            // ✅ UI 즉시 반영 (항상)
            applyLocalState(audio, video, { ...extra, ts });

            // ✅ 연결 안 됐으면 여기서 끝 (나중에 resync로 보냄)
            if (!stompRef.current || !connectedRef.current) return;

            const payload = {
                meetingId,
                userId: currentUserId,
                display: myDisplay,
                audio: !!audio,
                video: !!video,
                ts,
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
        [meetingId, currentUserId, display, applyLocalState]
    );

    // ✅ 연타 방지: 마지막 상태만 디바운스로 1회 전송
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

    // ✅ 연결되면 "내 최신 상태" 1회 재전송 (불일치 회복용)
    useEffect(() => {
        if (!connected || !meetingId || currentUserId == null) return;

        const mine = lastLocalRef.current;
        if (!mine) return;
        if (typeof mine.audio !== "boolean" || typeof mine.video !== "boolean")
            return;

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
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected]);

    // ✅ 수신 처리(단일 MEDIA_STATE + MEDIA_SNAPSHOT)
    const applyIncomingState = useCallback((payload) => {
        const userId = payload?.userId;
        if (userId == null) return;

        const uidKey = String(userId);
        const payloadTs = typeof payload.ts === "number" ? payload.ts : null;

        const hasAudio = typeof payload.audio === "boolean";
        const hasVideo = typeof payload.video === "boolean";
        const hasLost = typeof payload.videoDeviceLost === "boolean";
        const hasVideoSource = typeof payload.videoSource === "string";
        const hasSoftMuted = typeof payload.screenSoftMuted === "boolean";
        const hasCapturing = typeof payload.screenCapturing === "boolean";

        setMediaStates((prev) => {
            const prevItem = prev?.[uidKey];

            // ✅ out-of-order 방지: payload.ts가 있을 때만 엄격 비교
            if (
                payloadTs != null &&
                prevItem?.updatedAt &&
                payloadTs < prevItem.updatedAt
            ) {
                return prev;
            }

            const nextUpdatedAt =
                payloadTs != null
                    ? payloadTs
                    : prevItem?.updatedAt ?? Date.now();

            return {
                ...prev,
                [uidKey]: {
                    ...prevItem,
                    display: payload.display || prevItem?.display || uidKey,
                    updatedAt: nextUpdatedAt,
                    receivedAt: Date.now(),
                    known: true,
                    ...(hasAudio ? { audio: payload.audio } : {}),
                    ...(hasVideo ? { video: payload.video } : {}),
                    ...(hasLost
                        ? { videoDeviceLost: payload.videoDeviceLost }
                        : {}),
                    ...(hasVideoSource
                        ? { videoSource: payload.videoSource }
                        : {}),
                    ...(hasSoftMuted
                        ? { screenSoftMuted: payload.screenSoftMuted }
                        : {}),
                    ...(hasCapturing
                        ? { screenCapturing: payload.screenCapturing }
                        : {}),
                },
            };
        });
    }, []);

    useEffect(() => {
        if (!meetingId || currentUserId == null) return;

        const stomp = Stomp.over(() => new SockJS(WS_URL));
        stomp.debug = () => {};

        // ✅ 안정성 옵션(서버 지원 시)
        stomp.reconnectDelay = 2000;
        stomp.heartbeatIncoming = 10000;
        stomp.heartbeatOutgoing = 10000;

        stompRef.current = stomp;

        stomp.connect(
            {},
            () => {
                connectedRef.current = true;
                safeSetConnected(true);

                subscriptionRef.current = stomp.subscribe(
                    `/sub/meetings/${meetingId}/signals`,
                    (message) => {
                        let payload;
                        try {
                            payload = JSON.parse(message.body);
                        } catch {
                            return;
                        }

                        // ✅ 스냅샷(배열) 처리
                        if (
                            payload?.type === "MEDIA_SNAPSHOT" &&
                            Array.isArray(payload.states)
                        ) {
                            for (const st of payload.states) {
                                applyIncomingState(st);
                            }
                            return;
                        }

                        // ✅ 기본 단일 상태
                        applyIncomingState(payload);
                    }
                );

                // ✅ (선택) 연결되자마자 스냅샷 요청
                // stomp.send(`/pub/meetings/${meetingId}/signals/snapshot`, {}, "{}");
            },
            () => {
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
        applyIncomingState,
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
