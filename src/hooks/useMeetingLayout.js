// src/hooks/useMeetingLayout.js
import { useEffect, useMemo, useRef, useState } from "react";

export function useMeetingLayout(participants = []) {
    // ✅ mode는 focus가 기본, 자동 변경 안 함
    const [mode, setMode] = useState("focus"); // 'grid' | 'focus'
    const [focusId, setFocusId] = useState(null);

    // ✅ 사용자가 직접 포커스를 선택했는지(자동 포커스 중단용)
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

    // ✅ "상대"(나 제외 첫 번째)
    const other = useMemo(
        () => participants.find((p) => !p.isMe) || null,
        [participants]
    );

    const hasId = (id) =>
        id != null && participants.some((p) => String(p.id) === String(id));

    const pickDefaultFocusId = () => {
        // ✅ 우선순위: 상대 -> host -> me -> first
        if (other) return String(other.id);
        if (host) return String(host.id);
        if (me) return String(me.id);
        return participants[0] ? String(participants[0].id) : null;
    };

    // ✅ 참가자 멤버 변화(id 목록 변화) 때만 focusId 보정
    useEffect(() => {
        if (count === 0) {
            setFocusId(null);
            userPickedRef.current = false; // 방 비면 리셋
            return;
        }

        setFocusId((prev) => {
            const otherId = other ? String(other.id) : null;
            const hostId = host ? String(host.id) : null;
            const meId = me ? String(me.id) : null;

            // ✅ 핵심: 2명 이상이면 "초기 기본 포커스는 무조건 상대"
            // (사용자가 직접 선택하기 전까지만 강제)
            if (!userPickedRef.current && count >= 2) {
                if (otherId) return otherId;
                // other가 없을 정도면 비정상이지만, 방어로 host
                if (hostId && hostId !== meId) return hostId;
            }

            // 기존 focus가 없으면 기본
            if (!prev) return pickDefaultFocusId();

            // 기존 focus가 사라졌으면 기본
            if (!hasId(prev)) return pickDefaultFocusId();

            // 사용자가 직접 골랐으면 유지
            if (userPickedRef.current) return String(prev);

            // 그 외는 유지
            return String(prev);
        });
        // mode는 절대 건드리지 않음
    }, [count, idsKey, me, host, other]);

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

        userPickedRef.current = true; // ✅ 사용자가 직접 포커스 선택

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
