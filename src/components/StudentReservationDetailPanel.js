// src/components/counseling/StudentReservationDetailPanel.js
import React from "react";
import { useNavigate } from "react-router-dom";

function formatRange(startAt, endAt) {
    if (!startAt || !endAt) return "-";
    const [d1, t1] = String(startAt).split("T");
    const [d2, t2] = String(endAt).split("T");
    const [y, m, d] = d1.split("-");
    const startTime = t1.slice(0, 5);
    const endTime = t2.slice(0, 5);
    return `${m}/${d} ${startTime} ~ ${endTime}`;
}

function StudentReservationDetailPanel({
    openSlot,
    reservation,
    memo,
    onChangeMemo,
    onReserve,
    onCancel,
    loading,
    error,
}) {
    const navigate = useNavigate();

    const handleEnterMeeting = () => {
        if (!reservation.meetingId) return;
        navigate(`/meetings/${reservation.meetingId}`);
    };

    if (loading) return <div>로딩 중...</div>;

    return (
        <div>
            {error && (
                <div style={{ color: "red", marginBottom: "8px" }}>{error}</div>
            )}

            {!openSlot && !reservation && (
                <div style={{ fontSize: "13px", color: "#888" }}>
                    왼쪽 목록 또는 시간표에서 상담 시간을 선택하면 상세 정보가
                    표시됩니다.
                </div>
            )}

            {reservation && (
                <div>
                    <h4>예약 정보</h4>
                    <p>
                        <strong>시간:</strong>{" "}
                        {formatRange(reservation.startAt, reservation.endAt)}
                    </p>
                    <p>
                        <strong>교수:</strong>{" "}
                        {reservation.professorName || "-"}
                    </p>
                    <p>
                        <strong>상태:</strong> {reservation.status || "-"}
                    </p>
                    {reservation.myMemo && (
                        <p>
                            <strong>내 메모:</strong> {reservation.myMemo}
                        </p>
                    )}

                    {reservation.meetingId && (
                        <p>
                            <strong>회의 링크: </strong>
                            <button onClick={handleEnterMeeting}>
                                회의 입장하기
                            </button>
                            <br />
                            <small>시작 10분 전부터 입장이 가능합니다.</small>
                        </p>
                    )}

                    {reservation.status === "RESERVED" && (
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{ marginTop: "8px" }}
                        >
                            예약 취소
                        </button>
                    )}
                </div>
            )}

            {!reservation && openSlot && (
                <div>
                    <h4>새 예약 만들기</h4>
                    <p>
                        <strong>시간:</strong>{" "}
                        {formatRange(openSlot.startAt, openSlot.endAt)}
                    </p>
                    {openSlot.professorName && (
                        <p>
                            <strong>교수:</strong> {openSlot.professorName}
                        </p>
                    )}

                    <div style={{ marginTop: "8px" }}>
                        <label>
                            상담 메모(선택):
                            <br />
                            <textarea
                                rows={4}
                                style={{ width: "100%", maxWidth: "100%" }}
                                value={memo}
                                onChange={(e) =>
                                    onChangeMemo && onChangeMemo(e.target.value)
                                }
                            />
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={onReserve}
                        style={{ marginTop: "8px" }}
                    >
                        이 시간으로 예약하기
                    </button>
                </div>
            )}
        </div>
    );
}

export default StudentReservationDetailPanel;
