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
        try {
            setLoadingDetail(true);
            setDetailError("");

            await reserveSlot(selectedSlot.slotId, memo);

            await reloadCurrentWeek();

            setSelectedSlot(null);
            setMemo("");
        } catch (e) {
            console.error(e);
            setDetailError("예약 처리 중 오류가 발생했습니다.");
        } finally {
            setLoadingDetail(false);
        }
    };

    // 예약 취소
    const handleCancel = async () => {
        if (!selectedReservation) return;
        try {
            setLoadingDetail(true);
            setDetailError("");

            await cancelReservation(selectedReservation.reservationId);

            await reloadCurrentWeek();

            setSelectedReservation(null);
            setSelectedSlot(null);
        } catch (e) {
            console.error(e);
            setDetailError("예약 취소 중 오류가 발생했습니다.");
        } finally {
            setLoadingDetail(false);
        }
    };

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
