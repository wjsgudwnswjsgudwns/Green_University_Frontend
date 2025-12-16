import React, { useEffect, useState, useCallback } from "react";
import WeekRangeControls from "../components/WeekRangeControls";
import StudentProfessorSelect from "../components/StudentProfessorSelect";
import StudentOpenSlotGrid from "../components/StudentOpenSlotGrid";

import {
    getMyMajorProfessors,
    getMyReservations,
    reserveSlot,
    cancelReservation,
    getStudentSlots,
} from "../api/counselingApi";

import { useWeekRange } from "../hooks/useWeekRange";
import CounselingList from "../components/CounselingList";
import CounselingDetailPanel from "../components/CounselingDetailPanel";

function StudentCounselingPage() {
    // 공통 주간 범위 훅
    const { fromDate, toDate, setFromDate, setToDate, goPrevWeek, goNextWeek } =
        useWeekRange();

    // 교수 선택
    const [professors, setProfessors] = useState([]);
    const [selectedProfessorId, setSelectedProfessorId] = useState(null);

    // 슬롯 / 예약
    const [slots, setSlots] = useState([]); // 해당 교수의 주간 슬롯
    const [myReservations, setMyReservations] = useState([]);

    // 상세 패널 상태
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [memo, setMemo] = useState("");

    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState("");

    // 날짜/교수 변경 시 상세 초기화
    const clearDetail = useCallback(() => {
        setSelectedSlot(null);
        setSelectedReservation(null);
        setMemo("");
        setDetailError("");
        setLoadingDetail(false);
    }, []);

    // 날짜 변경 래핑: 변경 시 상세도 초기화
    const handleChangeFromDate = (value) => {
        setFromDate(value);
        clearDetail();
    };

    const handleChangeToDate = (value) => {
        setToDate(value);
        clearDetail();
    };

    const handlePrevWeek = () => {
        goPrevWeek();
        clearDetail();
    };

    const handleNextWeek = () => {
        goNextWeek();
        clearDetail();
    };

    // 📌 이번 주로 리셋하기: 현재 날짜 기준 월~금 범위로 설정
    const handleResetWeek = useCallback(() => {
        const now = new Date();
        // find monday
        const day = now.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const ymd = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const da = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${da}`;
        };
        setFromDate(ymd(monday));
        setToDate(ymd(friday));
        clearDetail();
    }, [setFromDate, setToDate, clearDetail]);

    // 초기: 내 학과 교수 목록
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const data = await getMyMajorProfessors();
                if (cancelled) return;
                setProfessors(data || []);
                if (data && data.length > 0) {
                    setSelectedProfessorId(data[0].id);
                }
            } catch (e) {
                if (cancelled) return;
                console.error(e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // 현재 주간 데이터 로딩 (슬롯 + 내 예약)
    const reloadCurrentWeek = useCallback(async () => {
        try {
            const reservationsPromise = getMyReservations(fromDate, toDate);

            let slotsPromise = Promise.resolve([]);
            if (selectedProfessorId) {
                slotsPromise = getStudentSlots(
                    selectedProfessorId,
                    fromDate,
                    toDate
                );
            }

            const [slotsData, myResData] = await Promise.all([
                slotsPromise,
                reservationsPromise,
            ]);

            setSlots(slotsData || []);
            setMyReservations(myResData || []);
        } catch (e) {
            console.error(e);
        }
    }, [selectedProfessorId, fromDate, toDate]);

    // 교수/기간 변경 시: 현재 주간 데이터 재조회
    useEffect(() => {
        reloadCurrentWeek();
    }, [reloadCurrentWeek]);

    // 내가 예약한 슬롯 id 리스트 (그리드 색칠용)
    const myReservedSlotIds =
        myReservations
            ?.filter((r) => r.status !== "CANCELED" && r.status !== "REJECTED")
            .map((r) => Number(r.slotId)) || [];

    // 내 예약 목록에서 선택 (리스트 → 상세)
    const handleSelectReservation = (reservation) => {
        setSelectedReservation(reservation);

        const slot = slots.find(
            (s) => Number(s.slotId) === Number(reservation.slotId)
        );
        setSelectedSlot(slot || null);

        setMemo("");
        setDetailError("");
    };

    // 그리드에서 슬롯 선택
    const handleSelectSlot = (slot, meta = {}) => {
        const { isMine } = meta;

        if (isMine) {
            const myRes = myReservations.find(
                (r) =>
                    Number(r.slotId) === Number(slot.slotId) &&
                    r.status !== "CANCELED" &&
                    r.status !== "REJECTED"
            );

            if (myRes) {
                setSelectedReservation(myRes);
                setSelectedSlot(slot);
                setMemo("");
                setDetailError("");
                return;
            }
        }

        setSelectedSlot(slot);
        setSelectedReservation(null);
        setMemo("");
        setDetailError("");
    };

    // 예약 생성
    const handleReserve = async () => {
        if (!selectedSlot) return;
        // 확인 대화창 표시 후 예약 진행
        const confirmReserve = window.confirm(
            "선택한 시간에 상담을 예약하시겠습니까?"
        );
        if (!confirmReserve) return;
        try {
            setLoadingDetail(true);
            setDetailError("");

            await reserveSlot(selectedSlot.slotId, memo);

            await reloadCurrentWeek();

            setSelectedSlot(null);
            setMemo("");

            alert("예약이 완료되었습니다. 승인 여부를 기다려주세요.");
        } catch (e) {
            console.error(e);
            setDetailError("예약 처리 중 오류가 발생했습니다.");
        } finally {
            setLoadingDetail(false);
        }
    };

    // 예약 취소: reason 매개변수 포함 (학생)
    const handleCancel = async (reason = "") => {
        if (!selectedReservation) return;
        const confirmCancel = window.confirm("예약을 취소하시겠습니까?");
        if (!confirmCancel) return;
        try {
            setLoadingDetail(true);
            setDetailError("");

            await cancelReservation(selectedReservation.reservationId, reason);

            await reloadCurrentWeek();

            setSelectedReservation(null);
            setSelectedSlot(null);

            alert("예약이 취소되었습니다.");
        } catch (e) {
            console.error(e);
            setDetailError("예약 취소 중 오류가 발생했습니다.");
        } finally {
            setLoadingDetail(false);
        }
    };

    // 📌 자동 새로고침: 5분마다 주간 데이터를 다시 불러옴
    useEffect(() => {
        const intervalId = setInterval(() => {
            reloadCurrentWeek();
        }, 5 * 60 * 1000); // 5분
        return () => clearInterval(intervalId);
    }, [reloadCurrentWeek]);

    return (
        <div style={{ padding: "16px" }}>
            <h2>상담 신청 (학생용)</h2>

            <WeekRangeControls
                fromDate={fromDate}
                toDate={toDate}
                onChangeFrom={handleChangeFromDate}
                onChangeTo={handleChangeToDate}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
                onResetWeek={handleResetWeek}
            />

            <section style={{ marginBottom: "16px" }}>
                <CounselingList
                    mode="student"
                    title="내 예약 목록"
                    reservations={myReservations}
                    selectedId={
                        selectedReservation && selectedReservation.reservationId
                    }
                    onSelect={handleSelectReservation}
                />
            </section>

            <section>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "24px",
                    }}
                >
                    {/* 왼쪽: 교수 선택 + 시간표 카드 */}
                    <div
                        style={{
                            flex: 3,
                            border: "1px solid #ddd",
                            padding: "12px",
                            borderRadius: "8px",
                            background: "#fafafa",
                            minHeight: "200px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                marginBottom: "8px",
                                gap: "12px",
                            }}
                        >
                            <h3 style={{ margin: 0 }}>상담 가능 시간대</h3>

                            {/* 오른쪽 끝으로 밀기 */}
                            <div style={{ marginLeft: "auto" }}>
                                <StudentProfessorSelect
                                    professors={professors}
                                    selectedId={selectedProfessorId}
                                    onChange={(id) => {
                                        setSelectedProfessorId(id);
                                        clearDetail();
                                    }}
                                />
                            </div>
                        </div>

                        <StudentOpenSlotGrid
                            fromDate={fromDate}
                            toDate={toDate}
                            slots={slots}
                            myReservedSlotIds={myReservedSlotIds}
                            onSelectSlot={handleSelectSlot}
                            selectedSlotId={selectedSlot && selectedSlot.slotId}
                        />
                    </div>

                    {/* 오른쪽: 상세 패널 카드 */}
                    <div
                        style={{
                            flex: 2,
                            border: "1px solid #ddd",
                            padding: "12px",
                            borderRadius: "8px",
                            background: "#fafafa",
                            minHeight: "200px",
                        }}
                    >
                        <h3 style={{ marginTop: 0 }}>상세 정보</h3>
                        <CounselingDetailPanel
                            mode="student"
                            slot={selectedSlot}
                            reservation={selectedReservation}
                            error={detailError}
                            loading={loadingDetail}
                            onReserve={handleReserve}
                            onCancel={handleCancel}
                            memo={memo}
                            onChangeMemo={setMemo}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

export default StudentCounselingPage;
