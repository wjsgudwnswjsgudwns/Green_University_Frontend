// src/components/counseling/StudentReservationList.js
import React from "react";

function formatRange(startAt, endAt) {
    if (!startAt || !endAt) return "-";
    const [d1, t1] = String(startAt).split("T");
    const [y, m, d] = d1.split("-");
    const startTime = t1.slice(0, 5);
    const [_, t2] = String(endAt).split("T");
    const endTime = t2.slice(0, 5);
    return `${m}/${d} ${startTime} ~ ${endTime}`;
}

// 🔹 상태 라벨 & 색상 (Reservation.status 기준)
const STATUS_LABEL = {
    RESERVED: "신청됨", // 학생이 신청
    APPROVED: "수락됨", // 교수 수락
    CANCELED: "취소됨",
    REJECTED: "거절됨",
};

const STATUS_COLOR = {
    RESERVED: "#faad14", // 노랑
    APPROVED: "#52c41a", // 초록
    CANCELED: "#8c8c8c", // 회색
    REJECTED: "#ff4d4f", // 빨강
};

function formatStatus(status) {
    if (!status) return "-";
    return STATUS_LABEL[status] || status;
}

function getStatusColor(status) {
    return STATUS_COLOR[status] || "#595959";
}

// 🔹 이 예약이 "지난 상담"인지 판단 (종료 시간 기준)
function isPastReservation(reservation) {
    if (!reservation.slotEndAt) return false;
    const end = new Date(reservation.slotEndAt);
    const now = new Date();
    return end.getTime() < now.getTime();
}

function StudentReservationList({ reservations, selectedId, onSelect }) {
    return (
        <div style={{ marginBottom: "16px" }}>
            <h3 style={{ marginTop: 0 }}>내 예약 목록</h3>
            {(!reservations || reservations.length === 0) && (
                <div style={{ fontSize: "13px", color: "#888" }}>
                    선택한 기간에 예약된 상담이 없습니다.
                </div>
            )}

            {reservations && reservations.length > 0 && (
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                    }}
                >
                    <thead>
                        <tr>
                            <th
                                style={{
                                    borderBottom: "1px solid #ddd",
                                    textAlign: "left",
                                    padding: "4px 6px",
                                }}
                            >
                                시간
                            </th>
                            <th
                                style={{
                                    borderBottom: "1px solid #ddd",
                                    textAlign: "left",
                                    padding: "4px 6px",
                                }}
                            >
                                교수
                            </th>
                            <th
                                style={{
                                    borderBottom: "1px solid #ddd",
                                    textAlign: "left",
                                    padding: "4px 6px",
                                }}
                            >
                                상태
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {reservations.map((r) => {
                            const past = isPastReservation(r);
                            const clickable = !past;
                            const rowBg =
                                !past && r.reservationId === selectedId
                                    ? "#f6ffed"
                                    : "transparent";
                            const cursor = clickable ? "pointer" : "default";

                            const statusLabel = past
                                ? "지난 상담"
                                : formatStatus(r.status);
                            const statusColor = past
                                ? "#8c8c8c"
                                : getStatusColor(r.status);

                            return (
                                <tr
                                    key={r.reservationId}
                                    onClick={() => {
                                        if (!clickable) return;
                                        onSelect && onSelect(r);
                                    }}
                                    style={{
                                        cursor,
                                        backgroundColor: rowBg,
                                        opacity: past ? 0.7 : 1,
                                    }}
                                >
                                    <td
                                        style={{
                                            borderBottom: "1px solid #f0f0f0",
                                            padding: "4px 6px",
                                        }}
                                    >
                                        {formatRange(
                                            r.slotStartAt,
                                            r.slotEndAt
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            borderBottom: "1px solid #f0f0f0",
                                            padding: "4px 6px",
                                        }}
                                    >
                                        {r.professorName || "-"}
                                    </td>
                                    <td
                                        style={{
                                            borderBottom: "1px solid #f0f0f0",
                                            padding: "4px 6px",
                                        }}
                                    >
                                        <span
                                            style={{
                                                color: statusColor,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {statusLabel}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default StudentReservationList;
