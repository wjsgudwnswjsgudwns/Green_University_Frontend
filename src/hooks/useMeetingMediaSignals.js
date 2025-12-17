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
// 핵심만 패치한 버전
export function useMeetingMediaSignals(meetingId, currentUserId, display) {
    const [mediaStates, setMediaStates] = useState({});
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subscriptionRef = useRef(null);
    const connectedRef = useRef(false);
    const WS_URL =
        process.env.REACT_APP_WS_URL || "http://localhost:8881/ws-chat";

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
        setConnected(false);
    }, []);

    // 회의 바뀌면 잔상 제거
    useEffect(() => {
        setMediaStates({});
    }, [meetingId]);

    // 로컬 즉시 반영
    const applyLocalState = useCallback(
        (audio, video, extra = {}) => {
            if (currentUserId == null) return;

            const ts = typeof extra.ts === "number" ? extra.ts : Date.now();

            setMediaStates((prev) => ({
                ...prev,
                [currentUserId]: {
                    ...prev?.[currentUserId],
                    audio: !!audio,
                    video: !!video,
                    videoDeviceLost: !!extra.videoDeviceLost,
                    display:
                        display ||
                        prev?.[currentUserId]?.display ||
                        String(currentUserId),

                    // ✅ sender ts 기반으로 정렬 가능하게
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
                        display: display || String(currentUserId),
                        audio: !!audio,
                        video: !!video,
                        videoDeviceLost: !!extra.videoDeviceLost,
                        ts, // ✅ 추가
                    })
                );
            } catch (e) {
                console.error("[useMeetingMediaSignals] send error", e);
            }
        },
        [meetingId, currentUserId, display, applyLocalState]
    );

    // ✅ 연결되면 "내 최신 상태" 1회 재전송 (불일치 회복용)
    useEffect(() => {
        if (!connected || !meetingId || currentUserId == null) return;

        const mine = mediaStates?.[currentUserId];
        if (!mine) return;

        // mine.audio/video가 없으면 보내지 않음(unknown 유지)
        if (typeof mine.audio !== "boolean" || typeof mine.video !== "boolean")
            return;

        sendMediaStateNow(mine.audio, mine.video, {
            videoDeviceLost: !!mine.videoDeviceLost,
            reason: "ws-resync",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected]); // 일부러 한 번만

    useEffect(() => {
        if (!meetingId || currentUserId == null) return;

        const stomp = Stomp.over(() => new SockJS(WS_URL));
        stomp.debug = () => {};
        stompRef.current = stomp;

        stomp.connect(
            {},
            () => {
                connectedRef.current = true;
                setConnected(true);

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

                        const uid = Number(userId);
                        const ts =
                            typeof payload.ts === "number"
                                ? payload.ts
                                : Date.now();

                        const hasAudio = typeof payload.audio === "boolean";
                        const hasVideo = typeof payload.video === "boolean";
                        const hasLost =
                            typeof payload.videoDeviceLost === "boolean";

                        setMediaStates((prev) => {
                            const prevItem = prev?.[uid];

                            // ✅ out-of-order 방지: 더 오래된 신호면 무시
                            if (prevItem?.updatedAt && ts < prevItem.updatedAt)
                                return prev;

                            return {
                                ...prev,
                                [uid]: {
                                    ...prevItem,
                                    display:
                                        payload.display ||
                                        prevItem?.display ||
                                        String(uid),
                                    updatedAt: ts, // ✅ sender ts
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
                setConnected(false);
            }
        );

        return disconnect;
    }, [meetingId, currentUserId, disconnect]);

    return {
        mediaStates,
        sendMediaStateNow,
        sendMediaState: sendMediaStateNow,
        mediaSignalConnected: connected,
    };
}
