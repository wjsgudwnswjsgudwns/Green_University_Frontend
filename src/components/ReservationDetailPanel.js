// src/components/counseling/ReservationDetailPanel.js
import React from "react";
import { useNavigate } from "react-router-dom";

function formatDateTime(dtStr) {
    if (!dtStr) return "";
    const d = new Date(dtStr);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
}

/**
 * 교수용 슬롯 상세 패널 (단일 학생 예약 기준)
 */
function ReservationDetailPanel({
    selectedSlot,
    reservations,
    loading,
    error,
    onApproveReservation,
    onCancelReservation,
}) {
    const navigate = useNavigate();
    if (!selectedSlot) {
        return (
            <div style={{ fontSize: "13px", color: "#666" }}>
                위쪽 목록이나 아래 시간표에서 시간(슬롯)을 선택하면 이 영역에
                해당 상담의 상세 정보가 표시됩니다.
            </div>
        );
    }

    // 한 슬롯에 사실상 한 학생만 온다는 가정 → 첫 번째 것만 사용
    const activeReservation =
        reservations && reservations.length > 0 ? reservations[0] : null;

    // 시간은 예약 DTO에 slotStartAt/slotEndAt 있으면 그걸 우선 사용
    const startTime = activeReservation?.slotStartAt
        ? formatDateTime(activeReservation.slotStartAt)
        : formatDateTime(selectedSlot.startAt);

    const endTime = activeReservation?.slotEndAt
        ? formatDateTime(activeReservation.slotEndAt)
        : formatDateTime(selectedSlot.endAt);

    // 상태도 예약이 있으면 예약 상태를 우선 노출
    const displayStatus = activeReservation
        ? activeReservation.status
        : selectedSlot.status;

    const handleEnterMeeting = () => {
        if (!reservations.meetingId) return;
        navigate(`/meetings/${reservations.meetingId}`);
    };

    return (
        <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
            {/* 상단: 한 건의 상담 카드 형태로 정리 */}
            <div
                style={{
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: "1px solid #eee",
                    backgroundColor: "#fafafa",
                    marginBottom: "8px",
                }}
            >
                <div style={{ marginBottom: "4px" }}>
                    <strong>상담 시간</strong>
                    <br />
                    {startTime} ~ {endTime}
                </div>

                <div style={{ marginBottom: "4px" }}>
                    <strong>상태</strong>
                    <br />
                    {displayStatus}
                </div>

                {selectedSlot.meetingId && (
                    <p>
                        <strong>회의 링크: </strong>
                        <button onClick={handleEnterMeeting}>
                            회의 입장하기
                        </button>
                        <br />
                        <small>시작 10분 전부터 입장이 가능합니다.</small>
                    </p>
                )}

                {activeReservation ? (
                    <>
                        <div style={{ marginBottom: "4px" }}>
                            <strong>학생</strong>
                            <br />
                            {activeReservation.studentName} (id:{" "}
                            {activeReservation.studentId})
                        </div>

                        <div style={{ marginBottom: "4px" }}>
                            <strong>메모</strong>
                            <br />
                            {activeReservation.studentMemo || "메모 없음"}
                        </div>

                        {activeReservation.createdAt && (
                            <div style={{ marginBottom: "4px" }}>
                                <strong>예약 시각</strong>
                                <br />
                                {formatDateTime(activeReservation.createdAt)}
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ marginTop: "4px", color: "#666" }}>
                        이 슬롯에 예약된 학생이 없습니다.
                    </div>
                )}
            </div>

            {/* 예약 정보 로딩/에러 메시지 (위 카드 아래에 간단히) */}
            {loading && <div>예약 정보를 불러오는 중입니다...</div>}
            {error && <div style={{ color: "red" }}>{error}</div>}

            {/* 액션 버튼: 예약이 있을 때만 */}
            {!loading && !error && activeReservation && (
                <div
                    style={{
                        marginTop: "6px",
                        display: "flex",
                        gap: "6px",
                    }}
                >
                    {onApproveReservation && (
                        <button
                            style={{
                                fontSize: "12px",
                                padding: "4px 8px",
                                cursor: "pointer",
                            }}
                            onClick={() =>
                                onApproveReservation(activeReservation)
                            }
                        >
                            예약 수락
                        </button>
                    )}

                    {onCancelReservation && (
                        <button
                            style={{
                                fontSize: "12px",
                                padding: "4px 8px",
                                cursor: "pointer",
                                color: "#c00",
                            }}
                            onClick={() =>
                                onCancelReservation(activeReservation)
                            }
                        >
                            예약 취소
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReservationDetailPanel;
