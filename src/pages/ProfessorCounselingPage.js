// src/pages/CounselingProfessorPage.js
import React, { useState, useCallback, useEffect } from "react";
import ScheduleEditor from "../components/ScheduleEditor";
import WeekRangeControls from "../components/WeekRangeControls";

import {
    approveReservation,
    getProfessorReservations,
    cancelReservationByProfessor,
} from "../api/counselingApi";
import { useWeekRange } from "../hooks/useWeekRange";
import CounselingList from "../components/CounselingList";
import CounselingDetailPanel from "../components/CounselingDetailPanel";
import "../styles/professorMeeting.css";

function ProfessorCounselingPage() {
    // 공통 주간 범위 훅
    const { fromDate, toDate, setFromDate, setToDate, goPrevWeek, goNextWeek } =
        useWeekRange();

    // 주간 예약 목록 (교수 기준)
    const [reservations, setReservations] = useState([]);

    // 상세 패널 상태
    const [selectedSlot, setSelectedSlot] = useState(null); // 선택한 슬롯
    const [selectedReservation, setSelectedReservation] = useState(null); // 슬롯의 예약(0 또는 1개)
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");

    // 편집 모드 상태
    const [editMode, setEditMode] = useState(false);

    // 편집 모드 전 상세 상태 백업
    const [detailBackup, setDetailBackup] = useState(null);

    // 현재 주에 "적용 안 된 초안" 존재 여부
    const [hasDraft, setHasDraft] = useState(false);

    // 시간표(ScheduleEditor) 재마운트용 키
    const [reloadKey, setReloadKey] = useState(0);

    const clearDetail = useCallback(() => {
        setSelectedSlot(null);
        setSelectedReservation(null);
        setDetailError("");
        setDetailLoading(false);
    }, []);

    // 주간 예약 목록 재조회
    const reloadReservations = useCallback(async () => {
        try {
            const data = await getProfessorReservations(fromDate, toDate);
            const list = data || [];
            setReservations(list);
            return list; // ✅ 이거 추가
        } catch (e) {
            console.error("예약 조회 중 오류가 발생했습니다.", e);
            setReservations([]);
            return []; // ✅ 이거 추가
        }
    }, [fromDate, toDate]);

    // 주/날짜 변경 시 예약 목록 재조회
    useEffect(() => {
        reloadReservations();
    }, [reloadReservations]);

    // 주가 바뀔 때: 상세/백업/초안만 초기화 (편집 모드는 유지)
    const resetForWeekChange = () => {
        clearDetail();
        setDetailBackup(null);
        setHasDraft(false);
    };

    // 주 이동 전에, 초안이 있으면 confirm
    const confirmWeekChangeIfNeeded = () => {
        if (!hasDraft) return true;

        const ok = window.confirm(
            "편집 모드에서 적용되지 않은 변경 사항이 있습니다.\n" +
                "편집 모드를 종료하면 이 변경 사항이 사라집니다. 계속하시겠습니까?"
        );

        return ok;
    };

    // 날짜 변경 + 상세 초기화
    const handleChangeFromDate = (value) => {
        setFromDate(value);
        resetForWeekChange();
    };

    const handleChangeToDate = (value) => {
        setToDate(value);
        resetForWeekChange();
    };

    const handlePrevWeek = () => {
        if (!confirmWeekChangeIfNeeded()) return;
        goPrevWeek();
        resetForWeekChange();
    };

    const handleNextWeek = () => {
        if (!confirmWeekChangeIfNeeded()) return;
        goNextWeek();
        resetForWeekChange();
    };

    // 편집 모드 토글 로직 (OFF 시에도 confirm)
    const handleToggleEditMode = () => {
        if (editMode) {
            // ▶ 편집 모드 → 끌 때
            if (hasDraft) {
                const ok = window.confirm(
                    "편집 모드에서 적용되지 않은 변경 사항이 있습니다.\n" +
                        "편집 모드를 종료하면 이 변경 사항이 사라집니다. 계속하시겠습니까?"
                );
                if (!ok) {
                    return;
                }
            }

            // 초안 버리고 보기 모드로 전환
            setEditMode(false);
            setHasDraft(false);

            // 상세 상태 복원
            if (detailBackup) {
                setSelectedSlot(detailBackup.selectedSlot || null);
                setSelectedReservation(
                    detailBackup.selectedReservation || null
                );
                setDetailError(detailBackup.detailError || "");
            }
            setDetailBackup(null);
        } else {
            // ▶ 보기 모드 → 편집 모드 켤 때 (현재 상세 상태 백업)
            setDetailBackup({
                selectedSlot,
                selectedReservation,
                detailError,
            });
            clearDetail();
            setEditMode(true);
        }
    };

    // 🔹 시간표(스케줄러)에서 슬롯 선택 시
    //    → 이미 들고 있는 reservations에서 slotId로 찾아서 정보만 교체
    const handleSelectSlot = (slot) => {
        if (editMode) {
            return;
        }

        if (!slot) {
            clearDetail();
            return;
        }

        setSelectedSlot(slot);

        const res = reservations.find(
            (r) =>
                Number(r.slotId) === Number(slot.slotId) &&
                r.status !== "CANCELED" &&
                r.status !== "REJECTED"
        );

        setSelectedReservation(res || null);
        setDetailError("");
        setDetailLoading(false); // 클릭 시엔 로딩 없음
    };

    // 🔹 예약 목록(위쪽 리스트)에서 선택 시
    //    → 서버 재호출 없이 reservation 그대로 쓰고, slot만 맞춰 세팅
    const handleSelectReservationFromList = (reservation) => {
        if (editMode) {
            return;
        }

        if (!reservation) {
            clearDetail();
            return;
        }

        const slotStart =
            reservation.slotStartAt ?? reservation.startAt ?? null;
        const slotEnd = reservation.slotEndAt ?? reservation.endAt ?? null;

        const pseudoSlot = {
            slotId: reservation.slotId,
            slotStartAt: slotStart,
            slotEndAt: slotEnd,
            studentName: reservation.studentName,
        };

        setSelectedSlot(pseudoSlot);
        setSelectedReservation(reservation);
        setDetailError("");
        setDetailLoading(false);
    };

    // 예약 수락
    const handleReserve = async (title, description) => {
        const reservation = selectedReservation;

        if (!reservation) {
            alert("승인할 예약이 없습니다.");
            return;
        }

        const reservationId =
            reservation.reservationId ?? reservation.id ?? null;
        if (!reservationId) {
            console.error("예약 ID를 찾을 수 없습니다.", reservation);
            alert("예약 ID를 찾을 수 없습니다.");
            return;
        }

        try {
            setDetailLoading(true);
            setDetailError("");

            // ✅ 빈 문자열이면 아예 안 보내기 (서버에서 기본값 적용되게)
            const body = {};
            if (title?.trim()) body.title = title.trim();
            if (description?.trim()) body.description = description.trim();

            await approveReservation(reservationId, body);

            // 승인 후 목록 갱신 + 상세도 갱신
            const newList = await reloadReservations(); // 아래 2번에서 reloadReservations 수정 필요

            if (selectedSlot) {
                const res = newList.find(
                    (r) =>
                        Number(r.slotId) === Number(selectedSlot.slotId) &&
                        r.status !== "CANCELED" &&
                        r.status !== "REJECTED"
                );
                setSelectedReservation(res || null);
            }

            setReloadKey((prev) => prev + 1);
        } catch (e) {
            console.error("예약 승인 실패", e);
            alert("예약 승인 중 오류가 발생했습니다.");
        } finally {
            setDetailLoading(false);
        }
    };

    // 예약 취소 (교수 취소 API)
    const handleCancel = async (reason) => {
        const reservation = selectedReservation;
        if (!reservation) return;

        const reservationId =
            reservation.reservationId ?? reservation.id ?? null;
        if (!reservationId) {
            console.error("예약 ID를 찾을 수 없습니다.", reservation);
            setDetailError("예약 ID를 찾을 수 없습니다.");
            return;
        }

        try {
            setDetailLoading(true);
            setDetailError("");

            await cancelReservationByProfessor(reservationId, reason); // ✅ reason 전달

            const newList = await reloadReservations();
            setSelectedReservation(null);
            setSelectedSlot(null);
            setReloadKey((prev) => prev + 1);
        } catch (e) {
            console.error("예약 취소 실패", e);
            setDetailError("예약 취소 중 오류가 발생했습니다.");
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="pcp-page-container">
            {/* 페이지 헤더 */}
            <div className="pcp-page-header">
                <h1 className="pcp-page-title">상담 관리 (교수용)</h1>
                <p className="pcp-page-subtitle">
                    학생들의 상담 예약을 관리하고 시간표를 편집할 수 있습니다.
                </p>
            </div>

            {/* 1) 날짜 / 주간 범위 */}
            <div className="pcp-week-controls">
                <div className="pcp-week-controls-inner">
                    <div>
                        <label>FROM:</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) =>
                                handleChangeFromDate(e.target.value)
                            }
                        />
                    </div>
                    <div>
                        <label>TO:</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => handleChangeToDate(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        className="pcp-week-nav-btn"
                        onClick={handlePrevWeek}
                    >
                        ◀ 이전 주
                    </button>
                    <button
                        type="button"
                        className="pcp-week-nav-btn"
                        onClick={handleNextWeek}
                    >
                        다음 주 ▶
                    </button>
                </div>
            </div>

            {/* 2) 예약 보기 (전체 폭) */}
            <section className="pcp-reservations-section">
                <CounselingList
                    mode="professor"
                    title="예약 보기 (교수용)"
                    reservations={reservations}
                    selectedId={
                        selectedReservation &&
                        (selectedReservation.reservationId ??
                            selectedReservation.id)
                    }
                    onSelect={handleSelectReservationFromList}
                />
            </section>

            {/* 3) 아래에서 시간표 + 상세를 나란히 배치 */}
            <section className="pcp-schedule-detail-section">
                {/* 왼쪽: 시간표 + 편집 토글 */}
                <div className="pcp-schedule-container">
                    <div className="pcp-schedule-header">
                        <h3 className="pcp-schedule-title">시간표 편집</h3>
                        <button
                            type="button"
                            className={`pcp-edit-toggle-btn ${
                                editMode ? "active" : ""
                            }`}
                            onClick={handleToggleEditMode}
                        >
                            {editMode ? "편집 모드 해제" : "편집 모드 켜기"}
                        </button>
                    </div>

                    <ScheduleEditor
                        key={`${editMode ? "edit" : "view"}-${reloadKey}`}
                        fromDate={fromDate}
                        toDate={toDate}
                        editMode={editMode}
                        onSelectSlot={handleSelectSlot}
                        onHasDraftChange={setHasDraft}
                    />
                </div>

                {/* 오른쪽: 상세 패널 */}
                <div className="pcp-detail-container">
                    <h3 className="pcp-detail-title">상세 정보</h3>
                    <CounselingDetailPanel
                        mode="professor"
                        slot={selectedSlot}
                        reservation={selectedReservation}
                        error={detailError}
                        onReserve={handleReserve}
                        onCancel={handleCancel}
                    />
                </div>
            </section>
        </div>
    );
}

export default ProfessorCounselingPage;
