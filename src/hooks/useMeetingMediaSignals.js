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
 *     display: string,
 *     updatedAt: number,
 *     receivedAt?: number,
 *     known?: boolean,
 *   }
 * }
 *
 * - audio/video/videoDeviceLost는 "모르면 undefined" 유지
 * - 로컬 apply도 known/receivedAt 세팅해서 UI 흔들림 방지
 * - meetingId 바뀌면 이전 signals 잔상 제거
 */
export function useMeetingMediaSignals(meetingId, currentUserId, display) {
    const [mediaStates, setMediaStates] = useState({});
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subscriptionRef = useRef(null);
    const connectedRef = useRef(false);
    const mountedRef = useRef(false);

    const lastLocalRef = useRef(null); // { audio, video, videoDeviceLost, display, ts }
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

    const disconnect = useCallback(() => {
        try {
            subscriptionRef.current?.unsubscribe?.();
        } catch {}
        subscriptionRef.current = null;

        try {
            stompRef.current?.disconnect?.(() => {});
        } catch {}
        stompRef.current = null;

        connectedRef.current = false;
        safeSetConnected(false);

        if (sendDebounceTimerRef.current) {
            clearTimeout(sendDebounceTimerRef.current);
            sendDebounceTimerRef.current = null;
        }
        pendingSendRef.current = null;
    }, [safeSetConnected]);

    // 회의 바뀌면 잔상 제거
    useEffect(() => {
        setMediaStates({});
    }, [meetingId]);

    // 로컬 즉시 반영
    const applyLocalState = useCallback(
        (audio, video, extra = {}) => {
            if (currentUserId == null) return;

            const ts = typeof extra.ts === "number" ? extra.ts : Date.now();
            const myKey = String(currentUserId);
            const myDisplay = display || String(currentUserId);

            // ✅ “내 최신 상태”는 별도 보관 (WS 재연결 resync용)
            lastLocalRef.current = {
                audio: !!audio,
                video: !!video,
                videoDeviceLost: !!extra.videoDeviceLost,
                display: myDisplay,
                ts,
            };

            setMediaStates((prev) => ({
                ...prev,
                [myKey]: {
                    ...prev?.[myKey],
                    audio: !!audio,
                    video: !!video,
                    videoDeviceLost: !!extra.videoDeviceLost,
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

            try {
                stompRef.current.send(
                    `/pub/meetings/${meetingId}/signals`,
                    {},
                    JSON.stringify({
                        meetingId,
                        userId: currentUserId,
                        display: myDisplay,
                        audio: !!audio,
                        video: !!video,
                        videoDeviceLost: !!extra.videoDeviceLost,
                        ts,
                    })
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
            videoDeviceLost: !!mine.videoDeviceLost,
            reason: "ws-resync",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected]);

    useEffect(() => {
        if (!meetingId || currentUserId == null) return;

        const stomp = Stomp.over(() => new SockJS(WS_URL));
        stomp.debug = () => {};
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

                        const userId = payload?.userId;
                        if (userId == null) return;

                        const uidKey = String(userId);
                        const ts =
                            typeof payload.ts === "number"
                                ? payload.ts
                                : Date.now();

                        const hasAudio = typeof payload.audio === "boolean";
                        const hasVideo = typeof payload.video === "boolean";
                        const hasLost =
                            typeof payload.videoDeviceLost === "boolean";

                        setMediaStates((prev) => {
                            const prevItem = prev?.[uidKey];

                            // ✅ out-of-order 방지: 더 오래된 신호면 무시
                            if (prevItem?.updatedAt && ts < prevItem.updatedAt)
                                return prev;

                            return {
                                ...prev,
                                [uidKey]: {
                                    ...prevItem,
                                    display:
                                        payload.display ||
                                        prevItem?.display ||
                                        uidKey,
                                    updatedAt: ts,
                                    receivedAt: Date.now(),
                                    known: true,
                                    ...(hasAudio
                                        ? { audio: payload.audio }
                                        : {}),
                                    ...(hasVideo
                                        ? { video: payload.video }
                                        : {}),
                                    ...(hasLost
                                        ? {
                                              videoDeviceLost:
                                                  payload.videoDeviceLost,
                                          }
                                        : {}),
                                },
                            };
                        });
                    }
                );
            },
            () => {
                connectedRef.current = false;
                safeSetConnected(false);
            }
        );

        return disconnect;
    }, [meetingId, currentUserId, disconnect, safeSetConnected, WS_URL]);

    return {
        mediaStates,
        sendMediaStateNow,
        sendMediaState,
        mediaSignalConnected: connected,
    };
}
