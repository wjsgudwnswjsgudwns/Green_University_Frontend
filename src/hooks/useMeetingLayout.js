// src/hooks/useMeetingLayout.js
import { useEffect, useMemo, useRef, useState } from "react";

export function useMeetingLayout(participants = []) {
    // 기본은 focus, 자동 전환 없음
    const [mode, setMode] = useState("focus"); // 'grid' | 'focus'
    const [focusId, setFocusId] = useState(null);

    // 사용자가 직접 포커스를 선택했는지
    const userPickedRef = useRef(false);

    const count = participants.length;

    const idsKey = useMemo(
        () => participants.map((p) => String(p.id)).join(","),
        [participants]
    );

    const me = useMemo(
        () => participants.find((p) => !!p.isMe) || null,
        [participants]
    );

    const host = useMemo(
        () => participants.find((p) => !!p.isHost) || null,
        [participants]
    );

    // 나 제외 첫 번째 상대
    const other = useMemo(
        () => participants.find((p) => !p.isMe) || null,
        [participants]
    );

    const hasId = (id) =>
        id != null && participants.some((p) => String(p.id) === String(id));

    const pickDefaultFocusId = () => {
        if (other) return String(other.id);
        if (host) return String(host.id);
        if (me) return String(me.id);
        return participants[0] ? String(participants[0].id) : null;
    };

    // 참가자 변화 시 focusId 보정 (mode는 절대 변경 안 함)
    useEffect(() => {
        if (count === 0) {
            setFocusId(null);
            userPickedRef.current = false;
            return;
        }

        setFocusId((prev) => {
            const otherId = other ? String(other.id) : null;
            const hostId = host ? String(host.id) : null;
            const meId = me ? String(me.id) : null;

            // 사용자가 직접 고르기 전까지만 자동 포커스
            if (!userPickedRef.current && count >= 2) {
                if (otherId) return otherId;
                if (hostId && hostId !== meId) return hostId;
            }

            if (!prev) return pickDefaultFocusId();
            if (!hasId(prev)) return pickDefaultFocusId();

            return String(prev);
        });
    }, [count, idsKey, me, host, other]);

    // 그리드 타일 / 썸네일 클릭 → focus + 대상 변경
    const handleParticipantClick = (id) => {
        if (count === 0) return;

        const targetId = String(id);
        const clicked = participants.find((p) => String(p.id) === targetId);
        if (!clicked) return;

        userPickedRef.current = true;

        setMode("focus");
        setFocusId(String(clicked.id));
    };

    // 포커스 메인 화면 클릭 → grid 전환
    const handleMainClick = () => {
        if (count === 0) return;
        setMode("grid");
    };

    const focusedParticipant =
        focusId != null
            ? participants.find((p) => String(p.id) === String(focusId)) || null
            : null;

    return {
        mode, // 'grid' | 'focus'
        focusId,
        focusedParticipant,
        participants,
        me,
        host,

        // handlers
        handleParticipantClick, // 타일/썸네일 클릭
        handleMainClick, // 메인 클릭 → grid
    };
}
