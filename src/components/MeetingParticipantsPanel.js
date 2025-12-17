import React from "react";

/**
 * 참여자 목록 패널.
 *
 * props:
 *  - participants: [{ id, name, isMe, isHost }]
 *  - isHost: 호스트 여부
 *  - onInvite: 초대 버튼 클릭 시 호출할 콜백
 */
export default function MeetingParticipantsPanel({
    participants = [],
    isHost = false,
    onInvite,
}) {
    return (
        <div
            className="meeting-participants-panel"
            style={{ marginBottom: 12 }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h3 style={{ margin: 0 }}>참여자 ({participants.length})</h3>
                {isHost && (
                    <button
                        onClick={onInvite}
                        style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            background: "#f3f4f6",
                            cursor: "pointer",
                        }}
                    >
                        초대
                    </button>
                )}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {participants.map((p) => (
                    <li key={p.id} style={{ marginBottom: 4 }}>
                        {p.name}
                        {p.isMe && " · 나"}
                        {p.isHost && " · 호스트"}
                    </li>
                ))}
            </ul>
        </div>
    );
}
