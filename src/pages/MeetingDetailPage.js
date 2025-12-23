// src/pages/MeetingDetailPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles/MeetingDetailPage.css";

function formatDateTime(dt) {
    if (!dt) return "-";
    const d = new Date(dt);
    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function mapStatus(status) {
    switch (status) {
        case "SCHEDULED":
            return { label: "예정", tone: "neutral" };
        case "IN_PROGRESS":
            return { label: "진행 중", tone: "success" };
        case "ENDED":
            return { label: "종료", tone: "danger" };
        case "CANCELED":
            return { label: "취소됨", tone: "danger" };
        default:
            return { label: status || "-", tone: "neutral" };
    }
}

export default function MeetingDetailPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();

    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        const fetchJoinInfo = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await api.get(
                    `/api/meetings/${meetingId}/join-info`
                );
                if (!mounted) return;
                setInfo(res.data);
            } catch (err) {
                console.error(err);
                if (!mounted) return;
                setError(
                    err.response?.data?.message ||
                        "회의 정보를 불러오는 중 오류가 발생했습니다."
                );
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchJoinInfo();
        return () => {
            mounted = false;
        };
    }, [meetingId]);

    const statusUI = useMemo(() => mapStatus(info?.status), [info?.status]);

    const canJoin = useMemo(() => {
        // 정책: 진행중만 참가 가능 (원하면 SCHEDULED도 허용 가능)
        return info?.status === "IN_PROGRESS";
    }, [info?.status]);

    const handleCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(String(text ?? ""));
        } catch (e) {}
    };

    if (loading) {
        return (
            <div className="mdp-page">
                <div className="mdp-shell">
                    <div className="mdp-card">
                        <div className="mdp-accent" />
                        <div className="mdp-pad">
                            <div className="mdp-skel mdp-skel--title" />
                            <div className="mdp-skel mdp-skel--line" />
                            <div className="mdp-skel mdp-skel--line" />
                            <div className="mdp-skel mdp-skel--box" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mdp-page">
                <div className="mdp-shell">
                    <button className="mdp-back" onClick={() => navigate(-1)}>
                        ← 뒤로
                    </button>

                    <div className="mdp-alert mdp-alert--danger">
                        <div className="mdp-alert__title">오류</div>
                        <div className="mdp-alert__body">{error}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!info) {
        return (
            <div className="mdp-page">
                <div className="mdp-shell">
                    <button className="mdp-back" onClick={() => navigate(-1)}>
                        ← 뒤로
                    </button>

                    <div className="mdp-card">
                        <div className="mdp-accent" />
                        <div className="mdp-pad">
                            <div className="mdp-empty">
                                회의 정보를 찾을 수 없습니다.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mdp-page">
            <div className="mdp-shell">
                <button className="mdp-back" onClick={() => navigate(-1)}>
                    ← 뒤로
                </button>

                <div className="mdp-card">
                    <div className="mdp-accent" />

                    <div className="mdp-head">
                        <div className="mdp-head__left">
                            <h2 className="mdp-title">{info.title}</h2>

                            <div className="mdp-sub">
                                <span className="mdp-sub__item">
                                    회의 ID: <b>{info.meetingId}</b>
                                </span>
                                <span className="mdp-sub__dot">·</span>
                                <span className="mdp-sub__item">
                                    방 번호: <b>{info.roomNumber}</b>
                                </span>

                                <button
                                    className="mdp-chip"
                                    onClick={() => handleCopy(info.roomNumber)}
                                    type="button"
                                >
                                    방번호 복사
                                </button>
                            </div>
                        </div>

                        <span
                            className={`mdp-badge mdp-badge--${statusUI.tone}`}
                        >
                            {statusUI.label}
                        </span>
                    </div>

                    <div className="mdp-section">
                        <div className="mdp-dl">
                            <div className="mdp-row">
                                <div className="mdp-dt">시작 시간</div>
                                <div className="mdp-dd">
                                    {formatDateTime(info.startAt)}
                                </div>
                            </div>
                            <div className="mdp-row">
                                <div className="mdp-dt">종료 시간</div>
                                <div className="mdp-dd">
                                    {formatDateTime(info.endAt)}
                                </div>
                            </div>
                            <div className="mdp-row">
                                <div className="mdp-dt">내 이름</div>
                                <div className="mdp-dd">{info.displayName}</div>
                            </div>
                            <div className="mdp-row">
                                <div className="mdp-dt">내 역할</div>
                                <div className="mdp-dd">
                                    {info.userRole}
                                    {info.isHost ? " (호스트)" : ""}
                                </div>
                            </div>
                            <div className="mdp-row">
                                <div className="mdp-dt">호스트 ID</div>
                                <div className="mdp-dd">
                                    {info.hostUserId ?? "-"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mdp-note">
                        화상회의(카메라/마이크/화면공유)는 <b>회의 참가하기</b>{" "}
                        이후 화면에서 제어합니다.
                    </div>

                    <div className="mdp-foot">
                        <button
                            className="mdp-btn mdp-btn--primary"
                            onClick={() =>
                                navigate(`/meetings/${info.meetingId}/join`, {
                                    state: { info },
                                })
                            }
                            disabled={!canJoin}
                            type="button"
                        >
                            회의 참가하기
                        </button>

                        {!canJoin && (
                            <div className="mdp-hint">
                                현재 상태가 <b>{statusUI.label}</b>라서 참가할
                                수 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
