// src/hooks/useMeetingLayout.js
import { useEffect, useMemo, useState } from "react";

/**
 * participant 구조 예시:
 * {
 *   id: number | string,
 *   name: string,
 *   isMe: boolean,
 *   isHost?: boolean
 * }
 */

export function useMeetingLayout(participants = []) {
    const [mode, setMode] = useState("grid"); // 'solo' | 'grid' | 'focus'
    const [focusId, setFocusId] = useState(null);

    const count = participants.length;

    // id 비교 안정성 확보 (string으로 통일)
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

    const getOtherId = () => {
        const other = participants.find((p) => !p.isMe) || participants[0];
        return other ? String(other.id) : null;
    };

    // 참가자 "멤버" 변화(id 목록 변화)에만 반응해서 초기화/재계산
    useEffect(() => {
        if (count === 0) {
            setMode("grid");
            setFocusId(null);
            return;
        }

        if (count === 1) {
            setMode("solo");
            setFocusId(String(participants[0].id));
            return;
        }

        if (count === 2) {
            // ✅ 2명은 무조건 focus (grid UX 애매함)
            setMode("focus");
            setFocusId((prev) => {
                if (prev && hasId(prev)) return String(prev);
                return getOtherId();
            });
            return;
        }

        // 3명 이상
        setMode((prev) =>
            prev === "grid" || prev === "focus" ? prev : "grid"
        );

        setFocusId((prev) => {
            // ✅ 기존 포커스가 유효하면 유지
            if (prev && hasId(prev)) return String(prev);

            // ✅ 없으면 host 우선, 그 다음 첫 번째
            if (host) return String(host.id);

            const first = participants[0];
            return first ? String(first.id) : null;
        });
    }, [count, idsKey, host?.id]); // ✅ participants 전체가 아니라 idsKey로 튐 방지

    // 모드 전환 버튼용
    const switchToGrid = () => {
        if (count <= 1) return;
        setMode("grid");
        // focusId는 유지 (원하면 null로 초기화해도 됨)
    };

    const switchToFocus = () => {
        if (count <= 1) return;

        setMode("focus");
        setFocusId((prev) => {
            if (prev && hasId(prev)) return String(prev);

            if (count === 2) return getOtherId();

            if (host) return String(host.id);

            const first = participants[0];
            return first ? String(first.id) : null;
        });
    };

    // 참가자(썸네일) 클릭
    const handleParticipantClick = (id) => {
        if (count === 0) return;

        const targetId = String(id);
        const clicked = participants.find((p) => String(p.id) === targetId);
        if (!clicked) return;

        if (count === 1) return;

        // ✅ 클릭하면 항상 focus로 + 해당 사람 포커스
        setMode("focus");
        setFocusId(String(clicked.id));
    };

    const focusedParticipant =
        focusId != null
            ? participants.find((p) => String(p.id) === String(focusId)) || null
            : null;

    return {
        mode, // 'solo' | 'grid' | 'focus'
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
