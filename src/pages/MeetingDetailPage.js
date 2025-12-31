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

/**
 * ✅ “참가 가능 시간창” 계산
 * - 시작 10분 전 ~ 종료 10분 후
 * - endAt 없으면 start+1시간 가정
 */
function computeJoinPolicy(info, nowMs, fallbackLabel) {
    if (!info) return { canJoin: false, inWindow: false, hint: "" };

    const status = info.status;

    // 종료/취소는 무조건 불가
    if (status === "ENDED")
        return {
            canJoin: false,
            inWindow: false,
            hint: "이미 종료된 회의입니다.",
        };
    if (status === "CANCELED")
        return { canJoin: false, inWindow: false, hint: "취소된 회의입니다." };

    // 진행 중이면 무조건 가능
    if (status === "IN_PROGRESS")
        return { canJoin: true, inWindow: true, hint: "" };

    // 예약(또는 기타) => 시간창 기준
    const start = safeTimeMs(info.startAt);
    if (!start) {
        return {
            canJoin: false,
            inWindow: false,
            hint: "시작 시간이 없어 참가 가능 여부를 판단할 수 없습니다.",
        };
    }

    const endRaw = safeTimeMs(info.endAt);
    const assumedEnd = endRaw ?? start + 60 * 60 * 1000;
    const end = assumedEnd < start ? start + 60 * 60 * 1000 : assumedEnd;

    const earlyMs = 10 * 60 * 1000; // 시작 10분 전부터
    const lateMs = 10 * 60 * 1000; // 종료 10분 후까지
    const windowStart = start - earlyMs;
    const windowEnd = end + lateMs;

    const inWindow = nowMs >= windowStart && nowMs <= windowEnd;
    if (inWindow) return { canJoin: true, inWindow: true, hint: "" };

    if (nowMs < windowStart) {
        return {
            canJoin: false,
            inWindow: false,
            hint: "시작 10분 전부터 참가할 수 있습니다.",
        };
    }
    return {
        canJoin: false,
        inWindow: false,
        hint: "참가 가능한 시간이 지났습니다. (종료 후)",
    };
}

export default function MeetingDetailPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();

    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // ✅ 시간에 따라 칩/버튼 상태 자동 갱신
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 15000); // 15초
        return () => clearInterval(id);
    }, []);

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

    // ✅ 배지는 “서버 status 그대로”
    const statusUI = useMemo(() => mapStatus(info?.status), [info?.status]);

    // ✅ 참가 가능 여부는 “시간창(시작-10m ~ 종료+10m)” 기준
    const joinPolicy = useMemo(() => {
        return computeJoinPolicy(info, nowMs, statusUI.label);
    }, [info, nowMs, statusUI.label]);

    const canJoin = joinPolicy.canJoin;

    // ✅ “예정”일 때만 ‘입장 가능’ 칩을 보이게(진행 중이면 배지로 충분)
    const showJoinableChip =
        !!info && info.status === "SCHEDULED" && joinPolicy.inWindow;

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

                        {/* ✅ 오른쪽: 배지는 서버 status 그대로 + 시간창이면 “입장 가능” 칩 */}
                        <div className="mdp-head__right">
                            <span
                                className={`mdp-badge mdp-badge--${statusUI.tone}`}
                            >
                                {statusUI.label}
                            </span>

                            {showJoinableChip && (
                                <span className="mdp-chip mdp-chip--joinable">
                                    입장 가능
                                </span>
                            )}
                        </div>
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
