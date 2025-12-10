// src/components/counseling/ReservationView.js
import React, { useCallback, useEffect, useState } from "react";
import { getProfessorReservations } from "../api/counselingApi";

function formatRange(startAt, endAt) {
    if (!startAt || !endAt) return "-";

    const s = new Date(startAt);
    const e = new Date(endAt);

    const mm = String(s.getMonth() + 1).padStart(2, "0");
    const dd = String(s.getDate()).padStart(2, "0");
    const sh = String(s.getHours()).padStart(2, "0");
    const sm = String(s.getMinutes()).padStart(2, "0");
    const eh = String(e.getHours()).padStart(2, "0");
    const em = String(e.getMinutes()).padStart(2, "0");

    return `${mm}/${dd} ${sh}:${sm} ~ ${eh}:${em}`;
}

// 🔹 예약 상태 라벨 & 색상 (Reservation.status 기준)
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

// 🔹 이 예약이 "지난 상담"인지 판단
function isPastReservation(reservation) {
    if (!reservation.slotEndAt) return false;
    const end = new Date(reservation.slotEndAt);
    const now = new Date();
    return end.getTime() < now.getTime();
}

function ReservationView({ fromDate, toDate, onSelectReservation }) {
    const [reservations, setReservations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const loadReservations = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await getProfessorReservations(fromDate, toDate);
            setReservations(data || []);
            setSelectedId(null);
        } catch (e) {
            console.error(e);
            setError("예약 조회 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        loadReservations();
    }, [loadReservations]);

    const handleRowClick = (r, clickable) => {
        if (!clickable) return;
        setSelectedId(r.reservationId);
        if (onSelectReservation) {
            onSelectReservation(r);
        }
    };

    return (
        <div>
            <h3>예약 보기 (교수용)</h3>

            {error && <div style={{ color: "red" }}>{error}</div>}
            {loading && <div>로딩 중...</div>}

            <h4>예약된 상담 목록</h4>
            {reservations.length === 0 && (
                <div>해당 기간에 예약된 상담이 없습니다.</div>
            )}

            {reservations.length > 0 && (
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                    }}
                >
                    <thead>
                        <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th
                                style={{
                                    border: "1px solid #ddd",
                                    padding: "4px 6px",
                                }}
                            >
                                시간
                            </th>
                            <th
                                style={{
                                    border: "1px solid #ddd",
                                    padding: "4px 6px",
                                }}
                            >
                                학생
                            </th>
                            <th
                                style={{
                                    border: "1px solid #ddd",
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
                                    ? "#e6f7ff"
                                    : "white";
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
                                    style={{
                                        cursor,
                                        backgroundColor: rowBg,
                                        opacity: past ? 0.7 : 1,
                                    }}
                                    onClick={() => handleRowClick(r, clickable)}
                                >
                                    <td
                                        style={{
                                            border: "1px solid #eee",
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
                                            border: "1px solid #eee",
                                            padding: "4px 6px",
                                        }}
                                    >
                                        {r.studentName || "-"}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #eee",
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

export default ReservationView;
