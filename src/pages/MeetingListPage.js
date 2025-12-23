// src/pages/MeetingListPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles/meetingList.css";
import CreateMeetingModal from "../components/CreateMeetingModal";

function formatDateTime(dt) {
    if (!dt) return { date: "-", time: "-" };
    const date = new Date(dt);
    if (isNaN(date.getTime())) return { date: "-", time: "-" };

    return {
        date: date.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }),
        time: date.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
        }),
    };
}

function parseDT(dt) {
    if (!dt) return null;
    const d = new Date(dt);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * ✅ 시간 기반 상태 판정
 * - now < startAt                      => SCHEDULED(예정)
 * - startAt <= now <= endAt + 10min    => IN_PROGRESS(진행중)
 * - 그 외                              => ENDED(종료)
 * - endAt 없으면 now >= startAt 이면 진행중 취급(임시)
 */
function calcTimeStatus(meeting) {
    const now = new Date();

    const start = parseDT(meeting?.startAt);
    const end = parseDT(meeting?.endAt);

    if (!start) return "UNKNOWN";

    if (!end) {
        return now >= start ? "IN_PROGRESS" : "SCHEDULED";
    }

    const endWithGrace = new Date(end.getTime() + 10 * 60 * 1000);

    if (now < start) return "SCHEDULED";
    if (now >= start && now <= endWithGrace) return "IN_PROGRESS";
    return "ENDED";
}

/**
 * ✅ props
 * - viewRole: "student" | "professor" | "staff" | "admin"(optional)
 *   -> UI 정책(버튼 노출 등)만 결정. (서버 권한은 서버가 최종 결정)
 */
function MeetingListPage({ viewRole = "" }) {
    const navigate = useNavigate();

    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [createOpen, setCreateOpen] = useState(false);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            setError("");
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

    // ✅ 진행중/예정만 + 시작시간 오름차순
    const visibleMeetings = useMemo(() => {
        const list = (meetings || [])
            .map((m) => ({ m, t: calcTimeStatus(m) }))
            .filter(({ t }) => t === "IN_PROGRESS" || t === "SCHEDULED");

        const toMs = (v) => {
            const d = parseDT(v);
            return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
        };

        list.sort((a, b) => {
            const aStart = toMs(a.m?.startAt);
            const bStart = toMs(b.m?.startAt);
            if (aStart !== bStart) return aStart - bStart;

            const aId = Number(a.m?.meetingId ?? 0);
            const bId = Number(b.m?.meetingId ?? 0);
            return aId - bId;
        });

        return list.map(({ m }) => m);
    }, [meetings]);

    const getMeetingTypeClass = (type) =>
        type === "INSTANT" ? "mlp-type-instant" : "mlp-type-scheduled";

    const getMeetingTypeText = (type) =>
        type === "INSTANT" ? "즉시 회의" : "예약 회의";

    const getStatusClass = (timeStatus) => {
        if (timeStatus === "IN_PROGRESS") return "mlp-status-active";
        if (timeStatus === "SCHEDULED") return "mlp-status-scheduled";
        return "mlp-status-ended";
    };

    const getStatusText = (timeStatus) => {
        if (timeStatus === "IN_PROGRESS") return "진행중";
        if (timeStatus === "SCHEDULED") return "예정";
        if (timeStatus === "ENDED") return "종료";
        return "-";
    };

    // ✅ 학생만 숨김. 그 외(professor/staff/admin)는 보임
    const canCreate = String(viewRole).toLowerCase() !== "student";

    return (
        <div className="mlp-page-container">
            {/* 헤더 */}
            <div className="mlp-header">
                <h2 className="mlp-title">나의 회의 목록</h2>

                {canCreate && (
                    <button
                        className="mlp-create-btn"
                        type="button"
                        onClick={() => setCreateOpen(true)}
                    >
                        새 회의 만들기
                    </button>
                )}
            </div>

            {/* 생성 모달 */}
            {canCreate && (
                <CreateMeetingModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={fetchMeetings}
                />
            )}

            {/* 로딩 */}
            {loading && (
                <div className="mlp-loading">
                    <div className="mlp-loading-spinner"></div>
                    <p>회의 목록을 불러오는 중...</p>
                </div>
            )}

            {/* 에러 */}
            {error && (
                <div className="mlp-error-message">
                    <span className="material-symbols-outlined">error</span>
                    {error}
                </div>
            )}

            {/* 빈 상태 */}
            {!loading && !error && visibleMeetings.length === 0 && (
                <div className="mlp-empty-state">
                    <p>진행중이거나 예정된 회의가 없습니다.</p>
                </div>
            )}

            {/* 테이블 */}
            {!loading && !error && visibleMeetings.length > 0 && (
                <div className="mlp-table-container">
                    <table className="mlp-table">
                        <thead>
                            <tr>
                                <th>제목</th>
                                <th>유형</th>
                                <th>시작시간</th>
                                <th>종료시간</th>
                                <th>상태</th>
                                <th>방 번호</th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleMeetings.map((m) => {
                                const startDT = formatDateTime(m.startAt);
                                const endDT = formatDateTime(m.endAt);

                                const timeStatus = calcTimeStatus(m);

                                return (
                                    <tr
                                        key={m.meetingId}
                                        onClick={() =>
                                            handleRowClick(m.meetingId)
                                        }
                                        style={{ cursor: "pointer" }}
                                    >
                                        <td>
                                            <strong>{m.title || "회의"}</strong>
                                        </td>

                                        <td>
                                            <span
                                                className={`mlp-type-badge ${getMeetingTypeClass(
                                                    m.type
                                                )}`}
                                            >
                                                {getMeetingTypeText(m.type)}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="mlp-datetime">
                                                <span className="mlp-date">
                                                    {startDT.date}
                                                </span>
                                                <span className="mlp-time">
                                                    {startDT.time}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="mlp-datetime">
                                                <span className="mlp-date">
                                                    {endDT.date}
                                                </span>
                                                <span className="mlp-time">
                                                    {endDT.time}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <span
                                                className={`mlp-status-badge ${getStatusClass(
                                                    timeStatus
                                                )}`}
                                            >
                                                {getStatusText(timeStatus)}
                                            </span>
                                        </td>

                                        <td>
                                            <strong>
                                                {m.roomNumber || "-"}
                                            </strong>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default MeetingListPage;
