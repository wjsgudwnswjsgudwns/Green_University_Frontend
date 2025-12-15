// src/hooks/useMeetingMediaSignals.js
import { useCallback, useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

/**
 * 화상 회의 참가자들의 오디오/비디오 on/off 상태를
 * WebSocket(STOMP)으로 공유하기 위한 훅.
 *
 * mediaStates: { [userId: number]: { audio: boolean, video: boolean, updatedAt: number } }
 */
export function useMeetingMediaSignals(meetingId, currentUserId, display) {
    const [mediaStates, setMediaStates] = useState({});
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subscriptionRef = useRef(null);

    // 공통 정리 함수
    const disconnect = useCallback(() => {
        try {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
            if (stompRef.current && stompRef.current.connected) {
                stompRef.current.disconnect(() => {
                    console.log("[useMeetingMediaSignals] STOMP disconnected");
                });
            }
        } catch (e) {
            console.error("[useMeetingMediaSignals] disconnect error", e);
        } finally {
            stompRef.current = null;
            setConnected(false);
        }
    }, []);

    // WebSocket/STOMP 연결
    useEffect(() => {
        // meetingId, currentUserId 없으면 연결 안 함
        if (!meetingId || !currentUserId) {
            return;
        }

        console.log(
            "[useMeetingMediaSignals] connecting...",
            "meetingId=",
            meetingId,
            "currentUserId=",
            currentUserId
        );

        const stomp = Stomp.over(
            () => new SockJS("http://localhost:8881/ws-chat")
        );

        // 너무 시끄러운 로그 줄이려면:
        // stomp.debug = () => {};

        stompRef.current = stomp;

        stomp.connect(
            {},
            (frame) => {
                console.log("[useMeetingMediaSignals] STOMP connected:", frame);
                setConnected(true);

                // 구독: 서버에서 브로드캐스트 하는 미디어 상태
                const destination = `/sub/meetings/${meetingId}/signals`;
                subscriptionRef.current = stomp.subscribe(
                    destination,
                    (message) => {
                        let payload;

                        try {
                            // 🔥 여기서 HTML이 오면 Unexpected token '<' 나는데,
                            // try/catch로 막고 body를 그대로 찍어본다.
                            payload = JSON.parse(message.body);
                        } catch (e) {
                            console.error(
                                "[useMeetingMediaSignals] invalid JSON payload",
                                message.body,
                                e
                            );
                            return;
                        }

                        const { userId, audio, video } = payload || {};
                        if (!userId) return;

                        setMediaStates((prev) => ({
                            ...prev,
                            [userId]: {
                                audio: !!audio,
                                video: !!video,
                                updatedAt: Date.now(),
                            },
                        }));
                    }
                );

                console.log(
                    "[useMeetingMediaSignals] subscribed to",
                    destination
                );
            },
            (error) => {
                console.error("[useMeetingMediaSignals] STOMP error", error);
                setConnected(false);
            }
        );

        // 언마운트/meetingId 변경 시 정리
        return () => {
            disconnect();
        };
    }, [meetingId, currentUserId, disconnect]);

    // 내 상태 보내기
    const sendMediaState = useCallback(
        (audioEnabled, videoEnabled) => {
            if (!meetingId || !currentUserId) return;
            if (!stompRef.current || !connected) return;

            const destination = `/pub/meetings/${meetingId}/signals`;
            const payload = {
                userId: currentUserId,
                display: display || String(currentUserId),
                audio: !!audioEnabled,
                video: !!videoEnabled,
            };

            try {
                stompRef.current.send(destination, {}, JSON.stringify(payload));
                // console.log("[useMeetingMediaSignals] send", destination, payload);
            } catch (e) {
                console.error(
                    "[useMeetingMediaSignals] sendMediaState error",
                    e
                );
            }
        },
        [meetingId, currentUserId, connected]
    );

    return {
        mediaStates,
        sendMediaState,
        mediaSignalConnected: connected,
    };
}
