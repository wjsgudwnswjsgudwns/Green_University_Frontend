// src/pages/MeetingDetailPage.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosConfig"; // ✅ 기존 axiosConfig 사용

function formatDateTime(dt) {
    if (!dt) return "-";
    const date = new Date(dt);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

const labelStyle = {
    fontWeight: 600,
    fontSize: 13,
    color: "#555",
    textAlign: "right",
};

function MeetingDetailPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchJoinInfo = async () => {
            try {
                setLoading(true);
                // GET http://localhost:8881/api/meetings/{id}/join-info
                const res = await api.get(
                    `/api/meetings/${meetingId}/join-info`
                );
                setInfo(res.data);
            } catch (err) {
                console.error(err);
                const msg =
                    err.response?.data?.message ||
                    "회의 정보를 불러오는 중 오류가 발생했습니다.";
                setError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchJoinInfo();
    }, [meetingId]);

    const handleBack = () => {
        navigate("/meetings");
    };

    const handleJoinMeeting = () => {
        if (!info) return;
        navigate(`/meetings/${info.meetingId}/join`, {
            state: { info },
        });
    };

    if (loading) {
        return (
            <div
                style={{
                    maxWidth: 900,
                    margin: "40px auto",
                    padding: "0 16px",
                }}
            >
                <p>불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    maxWidth: 900,
                    margin: "40px auto",
                    padding: "0 16px",
                }}
            >
                <p style={{ color: "red" }}>{error}</p>
            </div>
        );
    }

    if (!info) {
        return (
            <div
                style={{
                    maxWidth: 900,
                    margin: "40px auto",
                    padding: "0 16px",
                }}
            >
                <p>회의 정보를 찾을 수 없습니다.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
            <button
                onClick={handleBack}
                style={{
                    padding: "6px 12px",
                    marginBottom: 16,
                    fontSize: 13,
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    background: "white",
                    cursor: "pointer",
                }}
            >
                ← 회의 목록으로
            </button>

            {loading && <p>불러오는 중...</p>}

            {!loading && error && (
                <div
                    style={{
                        border: "1px solid #f5c2c7",
                        background: "#f8d7da",
                        color: "#842029",
                        padding: 12,
                        borderRadius: 4,
                    }}
                >
                    <strong>오류</strong>
                    <div>{error}</div>
                </div>
            )}

            {!loading && !error && info && (
                <>
                    <h2 style={{ marginBottom: 8 }}>{info.title}</h2>
                    <p style={{ color: "#666", marginBottom: 24 }}>
                        회의 ID: {info.meetingId} / 방 번호: {info.roomNumber}
                    </p>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "120px 1fr",
                            rowGap: 8,
                            columnGap: 16,
                            marginBottom: 24,
                        }}
                    >
                        <div style={labelStyle}>상태</div>
                        <div>{info.status}</div>

                        <div style={labelStyle}>시작 시간</div>
                        <div>{formatDateTime(info.startAt)}</div>

                        <div style={labelStyle}>종료 시간</div>
                        <div>{formatDateTime(info.endAt)}</div>

                        <div style={labelStyle}>내 이름</div>
                        <div>{info.displayName}</div>

                        <div style={labelStyle}>내 역할</div>
                        <div>{info.userRole}</div>
                    </div>

                    {/* 여기 나중에 Janus 비디오 영역 연결 */}
                    <div
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 16,
                            minHeight: 200,
                        }}
                    >
                        <p style={{ marginBottom: 8, fontWeight: 600 }}>
                            화상회의 영역 (Janus 붙일 자리)
                        </p>
                        <p style={{ fontSize: 13, color: "#666" }}>
                            나중에 여기에서 Janus VideoRoom을 초기화해서
                            <br />
                            로컬/리모트 영상을 표시하게 됩니다.
                        </p>
                    </div>

                    <button
                        onClick={handleJoinMeeting}
                        style={{
                            padding: "10px 20px",
                            fontSize: 15,
                            borderRadius: 6,
                            border: "none",
                            background: "#2563eb",
                            color: "white",
                            cursor: "pointer",
                        }}
                    >
                        회의 참가하기
                    </button>
                </>
            )}
        </div>
    );
}

export default MeetingDetailPage;
