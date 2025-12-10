// src/pages/CounselingStudentPage.js
import React, { useEffect, useState } from "react";
import WeekRangeControls from "../components/WeekRangeControls";
import StudentProfessorSelect from "../components/StudentProfessorSelect";
import StudentOpenSlotGrid from "../components/StudentOpenSlotGrid";
import StudentReservationList from "../components/StudentReservationList";
import StudentReservationDetailPanel from "../components/StudentReservationDetailPanel";
import {
    getMyMajorProfessors,
    getMyReservations,
    reserveSlot,
    cancelReservation,
    getStudentSlots,
} from "../api/counselingApi";

// YYYY-MM-DD 포맷
function formatYmdLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// 기준 날짜가 포함된 주 월요일
function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// yyyy-MM-dd + days
function addDaysStr(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() + days);
    return formatYmdLocal(base);
}

function CounselingStudentPage() {
    // 날짜 범위 (월~금)
    const today = new Date();
    const monday = getMonday(today);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const [fromDate, setFromDateState] = useState(formatYmdLocal(monday));
    const [toDate, setToDateState] = useState(formatYmdLocal(friday));

    // 교수 선택
    const [professors, setProfessors] = useState([]);
    const [selectedProfessorId, setSelectedProfessorId] = useState(null);

    // 슬롯 / 예약
    const [openSlots, setOpenSlots] = useState([]); // 실제로는 해당 교수의 전체 슬롯
    const [myReservations, setMyReservations] = useState([]);

    // 상세 패널 상태
    const [selectedOpenSlot, setSelectedOpenSlot] = useState(null);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [memo, setMemo] = useState("");

    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState("");

    // 날짜 변경 시 상세 초기화
    const clearDetail = () => {
        setSelectedOpenSlot(null);
        setSelectedReservation(null);
        setMemo("");
        setDetailError("");
        setLoadingDetail(false);
    };

    const setFromDate = (value) => {
        setFromDateState(value);
        clearDetail();
    };

    const setToDate = (value) => {
        setToDateState(value);
        clearDetail();
    };

    const handlePrevWeek = () => {
        const newFrom = addDaysStr(fromDate, -7);
        const newTo = addDaysStr(newFrom, 4);
        setFromDate(newFrom);
        setToDate(newTo);
    };

    const handleNextWeek = () => {
        const newFrom = addDaysStr(fromDate, 7);
        const newTo = addDaysStr(newFrom, 4);
        setFromDate(newFrom);
        setToDate(newTo);
    };

    // 초기: 내 학과 교수 목록
    useEffect(() => {
        (async () => {
            try {
                const data = await getMyMajorProfessors();
                setProfessors(data || []);
                if (data && data.length > 0) {
                    setSelectedProfessorId(data[0].id);
                }
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    // 교수/기간 변경 시: 슬롯 전체 조회 (OPEN + RESERVED 등)
    useEffect(() => {
        if (!selectedProfessorId) {
            setOpenSlots([]);
            return;
        }
        (async () => {
            try {
                const data = await getStudentSlots(
                    selectedProfessorId,
                    fromDate,
                    toDate
                );
                setOpenSlots(data || []);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [selectedProfessorId, fromDate, toDate]);

    // 기간 변경 시: 내 예약 목록 조회
    useEffect(() => {
        (async () => {
            try {
                const data = await getMyReservations(fromDate, toDate);
                setMyReservations(data || []);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [fromDate, toDate]);

    // 🔹 내가 예약한 슬롯 id 리스트 (그리드 색칠용)
    const myReservedSlotIds =
        myReservations
            ?.filter((r) => r.status !== "CANCELED" && r.status !== "REJECTED")
            .map((r) => Number(r.slotId)) || [];

    // 🔹 내 예약 목록에서 선택 (리스트 → 상세)
    const handleSelectReservation = (reservation) => {
        setSelectedReservation(reservation);

        // 선택한 예약에 해당하는 슬롯을 그리드에서도 찾아서 선택 (필요할 경우)
        const slot = openSlots.find(
            (s) => Number(s.slotId) === Number(reservation.slotId)
        );
        setSelectedOpenSlot(slot || null);

        setMemo("");
        setDetailError("");
    };

    // 🔹 그리드에서 슬롯 선택
    //  - isMine === true  → 내 예약 상세 보기
    //  - isMine === false → 새 예약 만들기
    const handleSelectOpenSlot = (slot, meta = {}) => {
        const { isMine } = meta;

        if (isMine) {
            // 내 예약인 슬롯 → 내 예약 목록에서 연결된 예약 찾기
            const myRes = myReservations.find(
                (r) =>
                    Number(r.slotId) === Number(slot.slotId) &&
                    r.status !== "CANCELED" &&
                    r.status !== "REJECTED"
            );

            if (myRes) {
                // ✅ 내 예약 상세 모드
                setSelectedReservation(myRes);
                setSelectedOpenSlot(slot);
                setMemo("");
                setDetailError("");
                return;
            }
            // 만약 이론상 안 맞는 경우면, 그냥 새 예약 모드로 폴백
        }

        // ✅ 일반 OPEN 슬롯 클릭 → 새 예약 만들기 모드
        setSelectedOpenSlot(slot);
        setSelectedReservation(null);
        setMemo("");
        setDetailError("");
    };

    // 🔹 예약 생성
    const handleReserve = async () => {
        if (!selectedOpenSlot) return;
        try {
            setLoadingDetail(true);
            setDetailError("");
            await reserveSlot(selectedOpenSlot.slotId, memo);

            const [slotsData, myResData] = await Promise.all([
                getStudentSlots(selectedProfessorId, fromDate, toDate),
                getMyReservations(fromDate, toDate),
            ]);
            setOpenSlots(slotsData || []);
            setMyReservations(myResData || []);

            setSelectedOpenSlot(null);
            setMemo("");
        } catch (e) {
            console.error(e);
            setDetailError("예약 처리 중 오류가 발생했습니다.");
        } finally {
            setLoadingDetail(false);
        }
    };

    // 🔹 예약 취소
    const handleCancel = async () => {
        if (!selectedReservation) return;
        try {
            setLoadingDetail(true);
            setDetailError("");

            await cancelReservation(selectedReservation.reservationId);

            const [slotsData, myResData] = await Promise.all([
                getStudentSlots(selectedProfessorId, fromDate, toDate),
                getMyReservations(fromDate, toDate),
            ]);
            setOpenSlots(slotsData || []);
            setMyReservations(myResData || []);

            setSelectedReservation(null);
            setSelectedOpenSlot(null);
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

            {/* 1) 날짜 / 주간 범위 */}
            <WeekRangeControls
                fromDate={fromDate}
                toDate={toDate}
                onChangeFrom={setFromDate}
                onChangeTo={setToDate}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
            />

            {/* 2) 내 예약 목록 */}
            <section style={{ marginBottom: "16px" }}>
                <StudentReservationList
                    reservations={myReservations}
                    selectedId={
                        selectedReservation && selectedReservation.reservationId
                    }
                    onSelect={handleSelectReservation}
                />
            </section>

            {/* 3) 아래: 왼쪽(교수 선택 + 슬롯 그리드) / 오른쪽(상세 패널) */}
            <section>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "24px",
                    }}
                >
                    {/* 왼쪽: 교수 선택 + 시간표 */}
                    <div style={{ flex: 3 }}>
                        <StudentProfessorSelect
                            professors={professors}
                            selectedId={selectedProfessorId}
                            onChange={(id) => {
                                setSelectedProfessorId(id);
                                clearDetail();
                            }}
                        />
                        <StudentOpenSlotGrid
                            fromDate={fromDate}
                            toDate={toDate}
                            slots={openSlots}
                            myReservedSlotIds={myReservedSlotIds}
                            onSelectSlot={handleSelectOpenSlot}
                        />
                    </div>

                    {/* 오른쪽: 상세 패널 */}
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
                        <StudentReservationDetailPanel
                            openSlot={selectedOpenSlot}
                            reservation={selectedReservation}
                            memo={memo}
                            onChangeMemo={setMemo}
                            onReserve={handleReserve}
                            onCancel={handleCancel}
                            loading={loadingDetail}
                            error={detailError}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

export default CounselingStudentPage;
