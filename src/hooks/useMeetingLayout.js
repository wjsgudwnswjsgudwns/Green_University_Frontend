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

export function useMeetingLayout(participants) {
    const [mode, setMode] = useState("grid"); // 'solo' | 'grid' | 'focus'
    const [focusId, setFocusId] = useState(null);

    const count = participants.length;

    const me = useMemo(
        () => participants.find((p) => p.isMe) || null,
        [participants]
    );
    const host = useMemo(
        () => participants.find((p) => p.isHost) || null,
        [participants]
    );

    // 참가자 변경 시 기본 모드/포커스 초기화 규칙
    useEffect(() => {
        if (count === 0) {
            setMode("grid");
            setFocusId(null);
            return;
        }

        if (count === 1) {
            // 1명: solo 모드 + 나(또는 유일한 사람) 포커스
            setMode("solo");
            setFocusId(participants[0].id);
            return;
        }

        if (count === 2) {
            // 2명: 기본 focus 모드 + 상대방 포커스
            setMode((prev) =>
                prev === "grid" || prev === "focus" ? prev : "focus"
            );
            setFocusId((prev) => {
                if (prev && participants.some((p) => p.id === prev)) {
                    return prev;
                }
                // 나 아닌 사람을 기본 포커스로
                const other =
                    participants.find((p) => !p.isMe) || participants[0];
                return other.id;
            });
            return;
        }

        // 3명 이상
        if (host) {
            // 호스트 있으면: 처음은 focus + 호스트 포커스
            setMode((prev) =>
                prev === "grid" || prev === "focus" ? prev : "focus"
            );
            setFocusId((prev) => {
                if (prev && participants.some((p) => p.id === prev)) {
                    return prev;
                }
                return host.id;
            });
        } else {
            // 호스트 없으면: 처음은 grid, 포커스 없음
            setMode((prev) =>
                prev === "grid" || prev === "focus" ? prev : "grid"
            );
            setFocusId((prev) => {
                if (prev && participants.some((p) => p.id === prev)) {
                    return prev;
                }
                return null;
            });
        }
    }, [count, participants, host]);

    // 모드 전환 버튼용
    const switchToGrid = () => {
        if (count <= 1) return; // solo는 의미 없음
        setMode("grid");
        // 포커스는 유지해도 되고 버려도 됨.
        // 3명+ 호스트 없는 경우엔 어차피 다시 focus 갈 때 첫 번째로 재계산할 거라 여기서 안 건드려도 OK.
    };

    const switchToFocus = () => {
        if (count <= 1) return;
        if (count === 2) {
            // 2명: 직전 포커스 유지 or 기본 상대방
            let nextFocus = focusId;
            if (!nextFocus || !participants.some((p) => p.id === nextFocus)) {
                const other =
                    participants.find((p) => !p.isMe) || participants[0];
                nextFocus = other.id;
            }
            setMode("focus");
            setFocusId(nextFocus);
            return;
        }

        // 3명 이상
        if (host) {
            // 호스트 있으면: grid -> focus 갈 때 항상 호스트 포커스
            setMode("focus");
            setFocusId(host.id);
        } else {
            // 호스트 없으면: grid -> focus 갈 때 배열 첫 번째
            const first = participants[0];
            setMode("focus");
            setFocusId(first ? first.id : null);
        }
    };

    // 참가자(썸네일) 클릭
    const handleParticipantClick = (id) => {
        if (count === 0) return;

        // 클릭한 id가 실제 있는 참가자인지 먼저 체크
        const clicked = participants.find((p) => p.id === id);
        if (!clicked) return;

        if (count === 1) {
            // 1명: 의미 없음
            return;
        }

        if (count === 2) {
            // 2명: 항상 focus 모드로, 클릭한 사람이 포커스
            setMode("focus");
            setFocusId(clicked.id);
            return;
        }

        // 3명 이상
        if (mode === "grid") {
            // grid에서 클릭하면 focus 모드로 진입 + 그 사람 포커스
            setMode("focus");
            setFocusId(clicked.id);
        } else if (mode === "focus") {
            // focus 모드면 포커스만 바꿔줌
            setFocusId(clicked.id);
        }
    };

    const focusedParticipant =
        focusId != null
            ? participants.find((p) => p.id === focusId) || null
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
