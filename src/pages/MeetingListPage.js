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
    const [creating, setCreating] = useState(false);

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

    const handleCreateInstantMeeting = async () => {
        try {
            setCreating(true);
            setError("");

            const res = await api.post("/api/meetings/instant");
            const created = res.data; // MeetingSimpleResDto

            // 목록 다시 불러오기
            await fetchMeetings();

            // 생성된 회의 상세 페이지로 바로 이동
            if (created && created.meetingId) {
                navigate(`/meetings/${created.meetingId}`);
            }
        } catch (err) {
            console.error(err);
            const msg =
                err.response?.data?.message ||
                "즉시 회의를 생성하는 중 오류가 발생했습니다.";
            setError(msg);
        } finally {
            setCreating(false);
        }
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

                <button
                    onClick={handleCreateInstantMeeting}
                    disabled={creating}
                    style={{
                        padding: "8px 14px",
                        fontSize: 14,
                        borderRadius: 6,
                        border: "none",
                        background: creating ? "#94a3b8" : "#2563eb",
                        color: "white",
                        cursor: creating ? "default" : "pointer",
                    }}
                >
                    {creating ? "회의 생성 중..." : "즉시 회의 생성"}
                </button>
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
