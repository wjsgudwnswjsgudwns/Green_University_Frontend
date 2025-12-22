// src/hooks/useMeetingLayout.js
import { useEffect, useMemo, useState } from "react";

export function useMeetingLayout(participants = []) {
    // ✅ mode는 focus가 기본, 자동 변경 안 함
    const [mode, setMode] = useState("focus"); // 'grid' | 'focus'
    const [focusId, setFocusId] = useState(null);

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

    const hasId = (id) =>
        id != null && participants.some((p) => String(p.id) === String(id));

    const pickDefaultFocusId = () => {
        // ✅ 우선순위: 기존 유효 -> 상대(있으면) -> host -> me -> first
        const other = participants.find((p) => !p.isMe) || null;
        if (other) return String(other.id);
        if (host) return String(host.id);
        if (me) return String(me.id);
        return participants[0] ? String(participants[0].id) : null;
    };

    // ✅ 참가자 멤버 변화(id 목록 변화) 때만 focusId 보정
    useEffect(() => {
        if (count === 0) {
            setFocusId(null);
            return;
        }

        setFocusId((prev) => {
            if (prev && hasId(prev)) return String(prev);
            return pickDefaultFocusId();
        });
        // mode는 절대 건드리지 않음
    }, [count, idsKey]); // host 변화도 id 변화로 보통 들어옴

    // 모드 버튼
    const switchToGrid = () => {
        if (count <= 0) return;
        setMode("grid");
    };

    const switchToFocus = () => {
        if (count <= 0) return;
        setMode("focus");
        setFocusId((prev) => {
            if (prev && hasId(prev)) return String(prev);
            return pickDefaultFocusId();
        });
    };

    // 썸네일 클릭 => focus로 + 해당 사람 포커스
    const handleParticipantClick = (id) => {
        if (count === 0) return;
        const targetId = String(id);
        const clicked = participants.find((p) => String(p.id) === targetId);
        if (!clicked) return;

        setMode("focus");
        setFocusId(String(clicked.id));
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
        switchToGrid,
        switchToFocus,
        handleParticipantClick,
    };
}
