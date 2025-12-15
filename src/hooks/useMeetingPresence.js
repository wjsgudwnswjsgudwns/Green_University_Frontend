// src/hooks/useMeetingPresence.js
import { useEffect, useRef, useState, useCallback } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

/**
 * MeetingParticipant 형태 (참고)
 *
 * {
 *   userId: number;
 *   displayName: string;
 *   role: "HOST" | "PARTICIPANT";
 *   isMe: boolean;
 *   joined: boolean;
 *   audio?: boolean;
 *   video?: boolean;
 *   stream?: MediaStream | null; // UI 쪽에서 붙임
 * }
 */

export function useMeetingPresence(meetingId, currentUserId, joinInfo) {
    const [participants, setParticipants] = useState([]);
    const [presenceConnected, setPresenceConnected] = useState(false);

    const stompClientRef = useRef(null);
    const subscriptionRef = useRef(null);

    // ===== 참가자 upsert helper =====
    const upsertParticipant = useCallback((partial) => {
        if (!partial || partial.userId == null) return;

        setParticipants((prev) => {
            const idx = prev.findIndex((p) => p.userId === partial.userId);
            if (idx === -1) {
                return [
                    ...prev,
                    {
                        joined: true,
                        ...partial,
                    },
                ];
            }

            const next = [...prev];
            next[idx] = {
                ...next[idx],
                ...partial,
            };
            return next;
        });
    }, []);

    const markLeft = useCallback((userId) => {
        if (userId == null) return;
        setParticipants(
            (prev) => prev.filter((p) => p.userId !== userId)
            // 필요하면 joined=false 로만 바꾸고 남겨도 됨
        );
    }, []);

    // ===== 1) joinInfo 기준으로 "나(Me)" 넣기 =====
    useEffect(() => {
        if (!joinInfo || currentUserId == null) return;

        const baseName =
            joinInfo.displayName ||
            joinInfo.userName ||
            joinInfo.nickname ||
            "나";

        const isHostSelf =
            !!joinInfo.isHost || joinInfo.userId === joinInfo.hostUserId;

        upsertParticipant({
            userId: currentUserId,
            displayName: baseName,
            role: isHostSelf ? "HOST" : "PARTICIPANT",
            isMe: true,
            joined: true,
        });
    }, [joinInfo, currentUserId, upsertParticipant]);

    // ===== 2) presence 이벤트 핸들러 =====
    const handlePresenceEvent = useCallback(
        (evt) => {
            if (!evt || !evt.type) return;

            if (evt.type === "JOIN") {
                upsertParticipant({
                    userId: evt.userId,
                    displayName: evt.displayName || "참가자",
                    role: evt.role === "HOST" ? "HOST" : "PARTICIPANT",
                    isMe: evt.userId === currentUserId,
                    joined: true,
                });
                return;
            }

            if (evt.type === "LEAVE" || evt.type === "FORCE_LEAVE") {
                markLeft(evt.userId);
                return;
            }

            if (evt.type === "SYNC") {
                if (Array.isArray(evt.participants)) {
                    setParticipants(
                        evt.participants.map((p) => ({
                            userId: p.userId,
                            displayName: p.displayName || "참가자",
                            role: p.role === "HOST" ? "HOST" : "PARTICIPANT",
                            isMe: p.userId === currentUserId,
                            joined: !!p.joined,
                        }))
                    );
                }
                return;
            }
        },
        [currentUserId, markLeft, upsertParticipant]
    );

    // ===== 3) WebSocket/STOMP 연결 =====
    useEffect(() => {
        if (!meetingId) return;

        // 이미 연결되어 있으면 재연결 X
        if (stompClientRef.current) {
            return;
        }

        // TODO: 실제 presence WebSocket endpoint 로 교체
        const client = Stomp.over(
            () => new SockJS("http://localhost:8881/ws-chat")
        );

        // 콘솔 너무 시끄러우면 끄기
        client.debug = () => {};

        client.connect(
            {},
            () => {
                console.log("[useMeetingPresence] STOMP connected");
                setPresenceConnected(true);
                stompClientRef.current = client;

                // TODO: 실제 presence topic 경로로 교체
                const sub = client.subscribe(
                    `/sub/meetings/${meetingId}/presence`,
                    (frame) => {
                        try {
                            const body = JSON.parse(frame.body);
                            console.log(
                                "[useMeetingPresence] presence event:",
                                body
                            );
                            handlePresenceEvent(body);
                        } catch (e) {
                            console.error(
                                "[useMeetingPresence] presence 파싱 실패",
                                e
                            );
                        }
                    }
                );

                subscriptionRef.current = sub;

                // (옵션) 서버가 SYNC를 보내도록 트리거
                // 필요 없으면 이 부분 제거해도 됨.
                try {
                    client.publish({
                        destination: `/pub/meetings/${meetingId}/presence/sync`,
                        body: JSON.stringify({
                            meetingId: Number(meetingId),
                        }),
                    });
                } catch (e) {
                    console.warn(
                        "[useMeetingPresence] sync 요청 publish 실패",
                        e
                    );
                }
            },
            (err) => {
                console.error("[useMeetingPresence] STOMP error", err);
                setPresenceConnected(false);
            }
        );

        return () => {
            console.log("[useMeetingPresence] cleanup");

            try {
                subscriptionRef.current?.unsubscribe();
            } catch (e) {
                console.warn("[useMeetingPresence] unsubscribe 실패", e);
            }
            subscriptionRef.current = null;

            if (stompClientRef.current) {
                try {
                    stompClientRef.current.deactivate();
                } catch (e) {
                    console.error("[useMeetingPresence] deactivate 실패", e);
                }
            }
            stompClientRef.current = null;
            setPresenceConnected(false);

            // 회의 나가면 "나"만 남기거나, 아예 비워도 됨
            setParticipants((prev) => prev.filter((p) => p.isMe));
        };
    }, [meetingId, handlePresenceEvent]);

    // ===== 4) (옵션) 클라이언트에서 presence publish 하고 싶을 때 =====
    const sendPresence = useCallback(
        (payload) => {
            const client = stompClientRef.current;
            if (!client || !client.connected) return;

            try {
                client.publish({
                    // TODO: 서버에서 정의한 pub endpoint 로 교체
                    destination: `/pub/meetings/${meetingId}/presence`,
                    body: JSON.stringify({
                        meetingId: Number(meetingId),
                        ...payload,
                    }),
                });
            } catch (e) {
                console.error("[useMeetingPresence] sendPresence 실패", e);
            }
        },
        [meetingId]
    );

    return {
        participants,
        presenceConnected,
        sendPresence, // 지금은 안 써도 되고, 나중에 필요하면 사용
    };
}
