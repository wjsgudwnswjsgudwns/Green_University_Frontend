// src/pages/MeetingListPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig"; // ✅ 기존 axiosConfig 사용

function formatDateTime(dt) {
    if (!dt) return "-";
    const date = new Date(dt);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

const thStyle = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 14,
    borderBottom: "1px solid #ddd",
};

const tdStyle = {
    padding: "8px 12px",
    fontSize: 14,
};

function MeetingListPage() {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/meetings");
            setMeetings(res.data || []);
        } catch (err) {
            console.error(err);
            setError("회의 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    const handleRowClick = (meetingId) => {
        navigate(`/meetings/${meetingId}`);
    };

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                }}
            >
                <h2 style={{ margin: 0 }}>나의 회의 목록</h2>
                {/* 즉시 회의 시작 버튼 */}
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                const res = await api.post(
                                    "/api/meetings/instant"
                                );
                                const meetingId = res.data?.meetingId;
                                if (meetingId) {
                                    navigate(`/meetings/${meetingId}/join`);
                                }
                            } catch (err) {
                                console.error("즉시 회의 생성 실패", err);
                                alert(
                                    err.response?.data?.message ||
                                        "즉시 회의 생성에 실패했습니다."
                                );
                            }
                        }}
                        style={{
                            padding: "6px 12px",
                            fontSize: 14,
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            background: "#f3f4f6",
                            cursor: "pointer",
                        }}
                    >
                        즉시 회의 시작
                    </button>
                </div>
            </div>

            {loading && <p>불러오는 중...</p>}

            {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

            {!loading && !error && meetings.length === 0 && (
                <p>생성하거나 예약한 회의가 없습니다.</p>
            )}

            {!loading && !error && meetings.length > 0 && (
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: "1px solid #ddd",
                    }}
                >
                    <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                            <th style={thStyle}>제목</th>
                            <th style={thStyle}>유형</th>
                            <th style={thStyle}>시작시간</th>
                            <th style={thStyle}>종료시간</th>
                            <th style={thStyle}>상태</th>
                            <th style={thStyle}>방 번호</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meetings.map((m) => (
                            <tr
                                key={m.meetingId}
                                onClick={() => handleRowClick(m.meetingId)}
                                style={{
                                    cursor: "pointer",
                                    borderTop: "1px solid #eee",
                                    transition: "background 0.1s",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background =
                                        "#fafafa")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "white")
                                }
                            >
                                <td style={tdStyle}>{m.title}</td>
                                <td style={tdStyle}>
                                    {m.type === "INSTANT"
                                        ? "즉시 회의"
                                        : "예약 회의"}
                                </td>
                                <td style={tdStyle}>
                                    {formatDateTime(m.startAt)}
                                </td>
                                <td style={tdStyle}>
                                    {formatDateTime(m.endAt)}
                                </td>
                                <td style={tdStyle}>{m.status}</td>
                                <td style={tdStyle}>{m.roomNumber}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default MeetingListPage;
