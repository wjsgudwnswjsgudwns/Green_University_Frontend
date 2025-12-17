// src/hooks/useMeetingPresence.js
import { useEffect, useRef, useState, useCallback } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

export function useMeetingPresence(
    meetingId,
    currentUserId,
    sessionKey,
    joinInfo
) {
    const [participants, setParticipants] = useState([]);
    const [connected, setConnected] = useState(false);

    const stompRef = useRef(null);
    const subRef = useRef(null);
    const WS_URL =
        process.env.REACT_APP_WS_URL || "http://localhost:8881/ws-chat";

    const upsert = useCallback((p) => {
        setParticipants((prev) => {
            const idx = prev.findIndex((x) => x.userId === p.userId);
            if (idx === -1) return [...prev, p];
            const next = [...prev];
            next[idx] = { ...next[idx], ...p };
            return next;
        });
    }, []);

    const remove = useCallback((userId) => {
        setParticipants((prev) => prev.filter((p) => p.userId !== userId));
    }, []);

    useEffect(() => {
        if (!meetingId || !currentUserId || !joinInfo) return;

        const stomp = Stomp.over(() => new SockJS(WS_URL));
        stomp.debug = () => {};
        stompRef.current = stomp;

        stomp.connect({}, () => {
            setConnected(true);

            subRef.current = stomp.subscribe(
                `/sub/meetings/${meetingId}/presence`,
                (frame) => {
                    const evt = JSON.parse(frame.body);
                    if (evt.type === "JOIN") upsert(evt);
                    if (evt.type === "LEAVE") remove(evt.userId);
                    if (evt.type === "SYNC") setParticipants(evt.participants);
                }
            );

            // SYNC 요청 시 sessionKey를 포함하여 서버에 전송
            stomp.send(
                `/pub/meetings/${meetingId}/presence/sync`,
                {},
                JSON.stringify({ meetingId, userId: currentUserId, sessionKey })
            );
        });

        return () => {
            subRef.current?.unsubscribe();
            stompRef.current?.disconnect();
            stompRef.current = null;
            setConnected(false);
        };
    }, [meetingId, currentUserId, sessionKey, joinInfo, upsert, remove]);

    return { participants, presenceConnected: connected };
}
