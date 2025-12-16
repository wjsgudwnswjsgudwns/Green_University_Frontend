// src/hooks/useMeetingMediaSignals.js
import { useCallback, useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

/**
 * 회의 참가자들의 오디오/비디오 상태를 공유하는 훅
 * mediaStates: { [userId]: { audio, video, videoDeviceLost, display, updatedAt } }
 */
export function useMeetingMediaSignals(meetingId, currentUserId, display) {
    const [mediaStates, setMediaStates] = useState({});
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subscriptionRef = useRef(null);

    const disconnect = useCallback(() => {
        try {
            subscriptionRef.current?.unsubscribe?.();
        } catch {}
        subscriptionRef.current = null;
        try {
            stompRef.current?.disconnect?.(() => {});
        } catch {}
        stompRef.current = null;
        setConnected(false);
    }, []);

    useEffect(() => {
        if (!meetingId || !currentUserId) return;

        const stomp = Stomp.over(
            () => new SockJS("http://localhost:8881/ws-chat")
        );
        stomp.debug = () => {};
        stompRef.current = stomp;

        stomp.connect(
            {},
            () => {
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

                        setMediaStates((prev) => ({
                            ...prev,
                            [userId]: {
                                audio: !!payload.audio,
                                video: !!payload.video,
                                videoDeviceLost: !!payload.videoDeviceLost,
                                display:
                                    payload.display ||
                                    prev?.[userId]?.display ||
                                    String(userId),
                                updatedAt: Date.now(),
                            },
                        }));
                    }
                );
            },
            () => {
                setConnected(false);
            }
        );

        return disconnect;
    }, [meetingId, currentUserId, disconnect]);

    // 로컬 상태 갱신용 helper
    const applyLocalState = useCallback(
        (audio, video, extra = {}) => {
            if (currentUserId == null) return;
            setMediaStates((prev) => ({
                ...prev,
                [currentUserId]: {
                    audio: !!audio,
                    video: !!video,
                    videoDeviceLost: !!extra.videoDeviceLost,
                    display:
                        display ||
                        prev?.[currentUserId]?.display ||
                        String(currentUserId),
                    updatedAt: Date.now(),
                },
            }));
        },
        [currentUserId, display]
    );

    /**
     * UI 먼저 반영하고 바로 서버에 브로드캐스트
     */
    const sendMediaStateNow = useCallback(
        (audio, video, extra = {}) => {
            if (!meetingId || currentUserId == null) return;
            // 로컬 즉시 반영
            applyLocalState(audio, video, extra);
            if (!stompRef.current || !connected) return;

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
                    })
                );
            } catch (e) {
                console.error(
                    "[useMeetingMediaSignals] sendMediaStateNow error",
                    e
                );
            }
        },
        [meetingId, currentUserId, display, connected, applyLocalState]
    );

    // 과거 호환용
    const sendMediaState = useCallback(
        (audio, video, extra = {}) => {
            sendMediaStateNow(audio, video, extra);
        },
        [sendMediaStateNow]
    );

    return {
        mediaStates,
        sendMediaState,
        sendMediaStateNow,
        mediaSignalConnected: connected,
    };
}
