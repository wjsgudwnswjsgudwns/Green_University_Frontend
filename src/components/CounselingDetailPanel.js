// src/components/counseling/CounselingDetailPanel.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function formatRange(startAt, endAt) {
    if (!startAt || !endAt) return "-";

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return "-";
    }

    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const dd = String(start.getDate()).padStart(2, "0");

    const sh = String(start.getHours()).padStart(2, "0");
    const sm = String(start.getMinutes()).padStart(2, "0");

    const eh = String(end.getHours()).padStart(2, "0");
    const em = String(end.getMinutes()).padStart(2, "0");

    return `${mm}/${dd} ${sh}:${sm} ~ ${eh}:${em}`;
}

/**
 * 공통 상담 상세 패널
 * mode: "student" | "professor"
 */
function CounselingDetailPanel({
    mode,
    slot,
    reservation,
    loading,
    error,
    onReserve,
    onCancel,
    memo,
    onChangeMemo,
}) {
    const navigate = useNavigate();
    const isStudent = mode === "student";

    // 교수 예약 수락 시 입력할 제목/내용 상태
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    // 예약이 변경될 때 입력값 초기화 (예약에 title/description이 있을 경우 사용)
    useEffect(() => {
        const defaultTitle = reservation?.title || "";
        const defaultDesc = reservation?.description || "";
        setTitle(defaultTitle);
        setDescription(defaultDesc);
    }, [reservation]);

    const handleEnterMeeting = () => {
        const meetingId = reservation?.meetingId ?? slot?.meetingId ?? null;
        if (!meetingId) return;
        navigate(`/meetings/${meetingId}`);
    };

    // 취소 버튼 클릭: 사유 입력 후 콜백 호출
    const handleCancelClick = () => {
        if (!onCancel) return;
        const reason = window.prompt("취소 사유를 입력하세요 (선택):", "");
        if (reason === null) return;
        onCancel(reason);
    };

    // 학생 취소 버튼 클릭 핸들러
    const handleStudentCancelClick = () => {
        if (!reservation) return;

        if (reservation.status === "RESERVED") {
            // 아직 승인 전이면 실제 취소 → 사유 입력 후 취소 콜백 호출
            handleCancelClick();
            return;
        }

        // 이미 승인된 상담인 경우 – 알럿만
        window.alert(
            "이미 승인된 상담입니다.\n" +
                "변경이나 취소가 필요하면 담당 교수님께 직접 문의해 주세요."
        );
    };

    // 아무것도 선택 안 됐을 때
    if (!slot && !reservation) {
        return (
            <div style={{ fontSize: "13px", color: "#888" }}>
                왼쪽 목록이나 시간표에서 상담 시간을 선택하면 상세 정보가
                표시됩니다.
            </div>
        );
    }

    // 공통 시간 계산
    const startAt =
        reservation?.slotStartAt ??
        reservation?.startAt ??
        slot?.slotStartAt ??
        slot?.startAt ??
        null;

    const endAt =
        reservation?.slotEndAt ??
        reservation?.endAt ??
        slot?.slotEndAt ??
        slot?.endAt ??
        null;

    const status = reservation?.status ?? slot?.status ?? "-";

    // 버튼 조건
    const canStudentCancel = isStudent && !!reservation; // 상태 상관없이 항상 표시
    const canProfessorApprove =
        !isStudent && !!reservation && reservation.status === "RESERVED";
    const canProfessorCancel = !isStudent && !!reservation;

    const containerStyle = {
        fontSize: "13px",
        lineHeight: 1.6,
    };

    const cardStyle = {
        border: "1px solid #ddd",
        borderRadius: "4px",
        padding: "10px 12px",
        backgroundColor: "#fafafa",
    };

    const rowStyle = {
        display: "flex",
        marginBottom: "4px",
    };

    const labelStyle = {
        width: "72px",
        fontWeight: 600,
        color: "#555",
    };

    const valueStyle = {
        flex: 1,
    };

    // ────────────────────────────────────────────────
    // 1) 예약이 있는 경우
    // ────────────────────────────────────────────────
    if (reservation) {
        const professorName = reservation.professorName;
        const studentName = reservation.studentName;
        const studentId = reservation.studentId;

        const hasMeetingLink = !!(reservation.meetingId || slot?.meetingId);

        return (
            <div style={containerStyle}>
                {error && (
                    <div style={{ color: "red", marginBottom: "8px" }}>
                        {error}
                    </div>
                )}

                <div style={cardStyle}>
                    {/* 기본 정보 영역 */}
                    <div style={{ marginBottom: "8px" }}>
                        <div style={rowStyle}>
                            <div style={labelStyle}>시간</div>
                            <div style={valueStyle}>
                                {formatRange(startAt, endAt)}
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <div style={labelStyle}>
                                {isStudent ? "교수" : "학생"}
                            </div>
                            <div style={valueStyle}>
                                {isStudent
                                    ? professorName || "-"
                                    : `${studentName || "-"}${
                                          studentId ? ` (id: ${studentId})` : ""
                                      }`}
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <div style={labelStyle}>상태</div>
                            <div style={valueStyle}>{status}</div>
                        </div>
                    </div>

                    {/* 🔹 하단 영역: 입력 폼 + 버튼 */}
                    <div style={{ marginTop: "6px" }}>
                        {/* 교수일 때만 예약 수락 전 입력 폼 */}
                        {!isStudent && canProfessorApprove && (
                            <div style={{ marginBottom: "8px" }}>
                                <div style={{ marginBottom: "4px" }}>
                                    <label
                                        style={{
                                            fontSize: "12px",
                                            fontWeight: 600,
                                        }}
                                    >
                                        주제(선택)
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) =>
                                                setTitle(e.target.value)
                                            }
                                            style={{
                                                width: "100%",
                                                marginTop: "4px",
                                                padding: "4px",
                                                fontSize: "12px",
                                                border: "1px solid #ccc",
                                                borderRadius: "4px",
                                            }}
                                        />
                                    </label>
                                </div>
                                <div style={{ marginBottom: "4px" }}>
                                    <label
                                        style={{
                                            fontSize: "12px",
                                            fontWeight: 600,
                                        }}
                                    >
                                        내용(선택)
                                        <textarea
                                            rows={3}
                                            value={description}
                                            onChange={(e) =>
                                                setDescription(e.target.value)
                                            }
                                            style={{
                                                width: "100%",
                                                marginTop: "4px",
                                                fontSize: "12px",
                                                border: "1px solid #ccc",
                                                borderRadius: "4px",
                                                resize: "vertical",
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* 버튼들 한 줄에 붙이기 */}
                        <div
                            style={{
                                display: "flex",
                                gap: "6px",
                                flexWrap: "wrap",
                            }}
                        >
                            {/* 회의 입장 버튼 (링크 있을 때만) */}
                            {hasMeetingLink && (
                                <button
                                    type="button"
                                    onClick={handleEnterMeeting}
                                    disabled={loading}
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        borderRadius: "4px",
                                        border: "1px solid #ccc",
                                        background: "#ffffff",
                                        cursor: "pointer",
                                    }}
                                >
                                    회의 입장하기
                                </button>
                            )}

                            {/* 학생: 예약 취소 */}
                            {isStudent && canStudentCancel && (
                                <button
                                    type="button"
                                    onClick={handleStudentCancelClick}
                                    disabled={loading}
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        borderRadius: "4px",
                                        border: "1px solid #fca5a5",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        cursor: "pointer",
                                    }}
                                >
                                    예약 취소
                                </button>
                            )}

                            {/* 교수: 예약 수락 */}
                            {!isStudent && canProfessorApprove && onReserve && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onReserve(title, description)
                                    }
                                    disabled={loading}
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        borderRadius: "4px",
                                        border: "1px solid #4ade80",
                                        background: "#ecfdf3",
                                        color: "#15803d",
                                        cursor: "pointer",
                                    }}
                                >
                                    예약 수락
                                </button>
                            )}

                            {/* 교수: 예약 취소 */}
                            {!isStudent && canProfessorCancel && onCancel && (
                                <button
                                    type="button"
                                    onClick={handleCancelClick}
                                    disabled={loading}
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        borderRadius: "4px",
                                        border: "1px solid #fca5a5",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        cursor: "pointer",
                                    }}
                                >
                                    예약 취소
                                </button>
                            )}
                        </div>

                        {/* 회의 링크 안내 */}
                        {hasMeetingLink && (
                            <>
                                <hr
                                    style={{
                                        margin: "8px 0 4px",
                                        border: "none",
                                        borderTop: "1px solid #eee",
                                    }}
                                />
                                <div
                                    style={{
                                        fontSize: "11px",
                                        color: "#777",
                                    }}
                                >
                                    시작 10분 전부터 입장이 가능합니다.
                                </div>
                            </>
                        )}

                        {loading && (
                            <div
                                style={{
                                    marginTop: "6px",
                                    fontSize: "12px",
                                    color: "#666",
                                }}
                            >
                                처리 중입니다...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ────────────────────────────────────────────────
    // 2) 예약은 없고 슬롯만 있는 경우
    // ────────────────────────────────────────────────
    if (slot) {
        // 학생: 새 예약 만들기
        if (isStudent) {
            return (
                <div style={containerStyle}>
                    {error && (
                        <div style={{ color: "red", marginBottom: "8px" }}>
                            {error}
                        </div>
                    )}

                    <div style={cardStyle}>
                        <h4
                            style={{
                                marginTop: 0,
                                marginBottom: "8px",
                                borderBottom: "1px solid #eee",
                                paddingBottom: "4px",
                            }}
                        >
                            새 상담 예약
                        </h4>

                        <div style={{ marginBottom: "8px" }}>
                            <div style={rowStyle}>
                                <div style={labelStyle}>시간</div>
                                <div style={valueStyle}>
                                    {formatRange(startAt, endAt)}
                                </div>
                            </div>
                            {slot.professorName && (
                                <div style={rowStyle}>
                                    <div style={labelStyle}>교수</div>
                                    <div style={valueStyle}>
                                        {slot.professorName}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: "8px" }}>
                            <label>
                                <div
                                    style={{
                                        marginBottom: "4px",
                                        fontWeight: 600,
                                    }}
                                >
                                    상담 메모(선택)
                                </div>
                                <textarea
                                    rows={3}
                                    style={{
                                        width: "100%",
                                        maxWidth: "100%",
                                        fontSize: "12px",
                                    }}
                                    value={memo}
                                    onChange={(e) =>
                                        onChangeMemo &&
                                        onChangeMemo(e.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={onReserve}
                            disabled={loading}
                            style={{
                                marginTop: "10px",
                                padding: "6px 10px",
                                fontSize: "12px",
                                borderRadius: "4px",
                                border: "1px solid #3b82f6",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                cursor: "pointer",
                            }}
                        >
                            이 시간으로 예약하기
                        </button>

                        {loading && (
                            <div
                                style={{
                                    marginTop: "6px",
                                    fontSize: "12px",
                                    color: "#666",
                                }}
                            >
                                처리 중입니다...
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // 교수: 예약 없는 슬롯 정보
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <h4
                        style={{
                            marginTop: 0,
                            marginBottom: "8px",
                            borderBottom: "1px solid #eee",
                            paddingBottom: "4px",
                        }}
                    >
                        슬롯 정보
                    </h4>
                    <div style={rowStyle}>
                        <div style={labelStyle}>시간</div>
                        <div style={valueStyle}>
                            {formatRange(startAt, endAt)}
                        </div>
                    </div>
                    <p style={{ marginTop: "6px", color: "#666" }}>
                        이 슬롯에는 아직 예약된 학생이 없습니다.
                    </p>
                </div>
            </div>
        );
    }

    return null;
}

export default CounselingDetailPanel;
