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

function safeTimeMs(dt) {
    if (!dt) return null;
    const t = new Date(dt).getTime();
    return Number.isFinite(t) ? t : null;
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

    // ============================================
    // 참가 정책 (최종)
    // - IN_PROGRESS: 언제나 참가 가능
    // - SCHEDULED(예약): 시간 창 안이면 참가 가능
    // - ENDED/CANCELED: 참가 불가
    // ============================================
    const joinPolicy = useMemo(() => {
        if (!info) {
            return {
                canJoin: false,
                hint: "",
            };
        }

        const status = info.status;

        // 종료/취소
        if (status === "ENDED") {
            return { canJoin: false, hint: "이미 종료된 회의입니다." };
        }
        if (status === "CANCELED") {
            return { canJoin: false, hint: "취소된 회의입니다." };
        }

        // 진행중이면 항상 가능
        if (status === "IN_PROGRESS") {
            return { canJoin: true, hint: "" };
        }

        // 예약이면 시간창 기준
        if (status === "SCHEDULED") {
            const now = Date.now();
            const start = safeTimeMs(info.startAt);
            const end = safeTimeMs(info.endAt);

            if (!start) {
                return {
                    canJoin: false,
                    hint: "시작 시간이 없어 참가 가능 여부를 판단할 수 없습니다.",
                };
            }

            const earlyMs = 10 * 60 * 1000; // 시작 10분 전부터
            const lateMs = 10 * 60 * 1000; // 종료 10분 후까지

            const windowStart = start - earlyMs;

            // end가 없으면 기본 1시간으로 가정 (원하면 서버에서 endAt 항상 내려주게 권장)
            const assumedEnd = end ?? start + 60 * 60 * 1000;
            const windowEnd = assumedEnd + lateMs;

            const canJoin = now >= windowStart && now <= windowEnd;

            if (canJoin) return { canJoin: true, hint: "" };

            // 힌트: 아직 시작 전 / 이미 종료 후
            if (now < windowStart) {
                return {
                    canJoin: false,
                    hint: "아직 참가 가능한 시간이 아닙니다. (시작 전)",
                };
            }
            return {
                canJoin: false,
                hint: "참가 가능한 시간이 지났습니다. (종료 후)",
            };
        }

        // 그 외 상태는 보수적으로 차단
        return {
            canJoin: false,
            hint: `현재 상태(${statusUI.label})에서는 참가할 수 없습니다.`,
        };
    }, [info, statusUI.label]);

    const canJoin = joinPolicy.canJoin;

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

                        {!canJoin && !!joinPolicy.hint && (
                            <div className="mdp-hint">{joinPolicy.hint}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
