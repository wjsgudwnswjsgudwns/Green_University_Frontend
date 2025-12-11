// src/components/counseling/ReservationList.js
import React from "react";

const LIST_HEIGHT = 260; // 내용 영역 고정 높이

function formatRange(startAt, endAt) {
    if (!startAt || !endAt) return "-";

    const s = new Date(startAt);
    const e = new Date(endAt);

    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return "-";
    }

    const mm = String(s.getMonth() + 1).padStart(2, "0");
    const dd = String(s.getDate()).padStart(2, "0");

    const sh = String(s.getHours()).padStart(2, "0");
    const sm = String(s.getMinutes()).padStart(2, "0");

    const eh = String(e.getHours()).padStart(2, "0");
    const em = String(e.getMinutes()).padStart(2, "0");

    return `${mm}/${dd} ${sh}:${sm} ~ ${eh}:${em}`;
}

const STATUS_LABEL = {
    RESERVED: "신청됨",
    APPROVED: "수락됨",
    CANCELED: "취소됨",
    REJECTED: "거절됨",
};

const STATUS_COLOR = {
    RESERVED: "#faad14",
    APPROVED: "#52c41a",
    CANCELED: "#8c8c8c",
    REJECTED: "#ff4d4f",
};

function formatStatus(status) {
    if (!status) return "-";
    return STATUS_LABEL[status] || status;
}

function getStatusColor(status) {
    return STATUS_COLOR[status] || "#595959";
}

function isPastReservation(reservation) {
    if (!reservation.slotEndAt) return false;
    const end = new Date(reservation.slotEndAt);
    const now = new Date();
    return end.getTime() < now.getTime();
}

function CounselingList({
    mode = "student",
    reservations,
    selectedId,
    onSelect,
}) {
    const isStudent = mode === "student";

    const nameColumnLabel = isStudent ? "교수" : "학생";
    const nameField = isStudent ? "professorName" : "studentName";

    const sorted = (reservations || []).slice().sort((a, b) => {
        const aPast = isPastReservation(a);
        const bPast = isPastReservation(b);
        if (aPast !== bPast) {
            return aPast - bPast; // 미래(false) 먼저
        }

        const aStart = new Date(a.slotStartAt).getTime() || 0;
        const bStart = new Date(b.slotStartAt).getTime() || 0;
        return aStart - bStart;
    });

    const handleRowClick = (r, clickable) => {
        if (!clickable) return;
        onSelect && onSelect(r);
    };

    const headerCellStyle = {
        border: "1px solid #ddd",
        padding: "4px 6px",
        textAlign: "left",
        backgroundColor: "#f5f5f5",
        fontWeight: 600,
        fontSize: "13px",
    };

    const bodyCellStyle = {
        border: "1px solid #f0f0f0",
        padding: "4px 6px",
        fontSize: "13px",
    };

    return (
        <div style={{ marginBottom: "16px" }}>
            {/* 전체 박스 */}
            <div
                style={{
                    border: "1px solid #eee",
                    borderRadius: 4,
                    overflow: "hidden", // 테두리 깔끔하게
                }}
            >
                {/* 헤더만 있는 테이블 (스크롤 없음) */}
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                    }}
                >
                    <thead>
                        <tr>
                            <th
                                style={{
                                    ...headerCellStyle,
                                    width: "45%",
                                }}
                            >
                                시간
                            </th>
                            <th
                                style={{
                                    ...headerCellStyle,
                                    width: "30%",
                                }}
                            >
                                {nameColumnLabel}
                            </th>
                            <th
                                style={{
                                    ...headerCellStyle,
                                    width: "25%",
                                }}
                            >
                                상태
                            </th>
                        </tr>
                    </thead>
                </table>

                {/* 내용 영역: 여기만 스크롤 */}
                <div
                    style={{
                        height: LIST_HEIGHT,
                        overflowY: "auto",
                    }}
                >
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            tableLayout: "fixed",
                        }}
                    >
                        <tbody>
                            {sorted.map((r) => {
                                const past = isPastReservation(r);
                                const clickable = !past;
                                const rowBg =
                                    !past && r.reservationId === selectedId
                                        ? "#e6f7ff"
                                        : "white";
                                const cursor = clickable
                                    ? "pointer"
                                    : "default";

                                const statusLabel = past
                                    ? "지난 상담"
                                    : formatStatus(r.status);
                                const statusColor = past
                                    ? "#8c8c8c"
                                    : getStatusColor(r.status);

                                return (
                                    <tr
                                        key={r.reservationId}
                                        style={{
                                            cursor,
                                            backgroundColor: rowBg,
                                            opacity: past ? 0.7 : 1,
                                        }}
                                        onClick={() =>
                                            handleRowClick(r, clickable)
                                        }
                                    >
                                        <td
                                            style={{
                                                ...bodyCellStyle,
                                                width: "45%",
                                            }}
                                        >
                                            {formatRange(
                                                r.slotStartAt,
                                                r.slotEndAt
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                ...bodyCellStyle,
                                                width: "30%",
                                            }}
                                        >
                                            {r[nameField] || "-"}
                                        </td>
                                        <td
                                            style={{
                                                ...bodyCellStyle,
                                                width: "25%",
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
                </div>
            </div>
        </div>
    );
}

export default CounselingList;
