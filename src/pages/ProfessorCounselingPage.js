// src/pages/CounselingProfessorPage.js
import React, { useState } from "react";
import ScheduleEditor from "../components/ScheduleEditor";
import ReservationView from "../components/ReservationView";
import WeekRangeControls from "../components/WeekRangeControls";
import ReservationDetailPanel from "../components/ReservationDetailPanel";
import { approveReservation, getSlotReservations } from "../api/counselingApi";

// YYYY-MM-DD 로 포맷
function formatYmdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 기준 날짜가 포함된 주 월요일
function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=일,1=월...
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

function ProfessorCounselingPage() {
  // ✅ 공통 기간 상태
  const today = new Date();
  const monday = getMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const [fromDate, setFromDateState] = useState(formatYmdLocal(monday));
  const [toDate, setToDateState] = useState(formatYmdLocal(friday));

  // 🔹 상세 패널 상태
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotReservations, setSlotReservations] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // 🔹 편집 모드 상태
  const [editMode, setEditMode] = useState(false);

  // 🔹 편집 모드 전 상세 상태 백업
  const [detailBackup, setDetailBackup] = useState(null);

  // 🔹 현재 주에 "적용 안 된 초안" 존재 여부
  const [hasDraft, setHasDraft] = useState(false);

  const clearDetail = () => {
    setSelectedSlot(null);
    setSlotReservations([]);
    setDetailError("");
    setDetailLoading(false);
  };

  // ✅ 주가 바뀔 때: 상세/백업/초안만 초기화 (편집 모드는 유지)
  const resetForWeekChange = () => {
    clearDetail();
    setDetailBackup(null);
    setHasDraft(false);
  };

  // ✅ 주 이동 전에, 초안이 있으면 confirm
  const confirmWeekChangeIfNeeded = () => {
    if (!hasDraft) return true;

    const ok = window.confirm(
      "현재 주에서 편집 중인 내용 중 아직 적용되지 않은 변경 사항이 있습니다.\n" +
        "주를 이동하면 이 변경 사항이 사라집니다. 계속 진행하시겠습니까?"
    );
    return ok;
  };

  const setFromDate = (value) => {
    setFromDateState(value);
    // 필요하면 여기에도 확인 로직 추가 가능
  };

  const setToDate = (value) => {
    setToDateState(value);
  };

  const handlePrevWeek = () => {
    if (!confirmWeekChangeIfNeeded()) return;

    const newFrom = addDaysStr(fromDate, -7);
    const newTo = addDaysStr(newFrom, 4); // 항상 월~금
    setFromDateState(newFrom);
    setToDateState(newTo);
    resetForWeekChange();
    // editMode는 유지
  };

  const handleNextWeek = () => {
    if (!confirmWeekChangeIfNeeded()) return;

    const newFrom = addDaysStr(fromDate, 7);
    const newTo = addDaysStr(newFrom, 4); // 항상 월~금
    setFromDateState(newFrom);
    setToDateState(newTo);
    resetForWeekChange();
    // editMode는 유지
  };

  // ✅ 편집 모드 토글 로직 (OFF 시에도 confirm)
  const handleToggleEditMode = () => {
    if (editMode) {
      // ▶ 편집 모드 → 끌 때
      if (hasDraft) {
        const ok = window.confirm(
          "편집 모드에서 적용되지 않은 변경 사항이 있습니다.\n" +
            "편집 모드를 종료하면 이 변경 사항이 사라집니다. 계속하시겠습니까?"
        );
        if (!ok) {
          // 취소 → 그대로 편집 모드 유지
          return;
        }
      }

      // 초안 버리고 보기 모드로 전환
      setEditMode(false);
      setHasDraft(false);

      // 상세 상태 복원
      if (detailBackup) {
        setSelectedSlot(detailBackup.selectedSlot || null);
        setSlotReservations(detailBackup.slotReservations || []);
        setDetailError(detailBackup.detailError || "");
      }
      setDetailBackup(null);
    } else {
      // ▶ 보기 모드 → 편집 모드 켤 때
      setDetailBackup({
        selectedSlot,
        slotReservations,
        detailError,
      });
      clearDetail();
      setEditMode(true);
    }
  };

  // 슬롯 선택 시 상세 정보 가져오기 (목록/시간표 공통)
  const handleSelectSlot = async (slot) => {
    // 🔒 편집 모드에서는 상세 패널이 동작하지 않음
    if (editMode) {
      return;
    }

    if (!slot) {
      clearDetail();
      return;
    }

    setSelectedSlot(slot);
    setSlotReservations([]);
    setDetailError("");

    try {
      setDetailLoading(true);
      const data = await getSlotReservations(slot.slotId);
      setSlotReservations(data || []);
    } catch (e) {
      console.error(e);
      setDetailError("예약 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveReservation = async (reservation) => {
    // reservation: ReservationDetailPanel에서 넘겨주는 activeReservation
    const reservationId = reservation.reservationId;

    // 일단 제목/내용은 비우면 백엔드에서 기본값 채워줌
    const title = "";
    const description = "";

    try {
      await approveReservation(reservationId, { title, description });
      // TODO: 슬롯/예약 다시 조회해서 UI 갱신
    } catch (e) {
      console.error("예약 승인 실패", e);
      alert("예약 승인 중 오류가 발생했습니다.");
    }
  };

  // ✅ 예약 취소 핸들러 (교수가 취소할 수 있게 할 거면 여기에서 API 호출)
  const handleCancelReservation = async (reservation) => {
    console.log("예약 취소 클릭:", reservation);

    // 아직은 학생 전용 cancelReservation만 있는 상태라면
    // 1) 백엔드에서 "교수도 취소 가능"한 전용 API를 하나 파고
    // 2) 그 API를 여기서 호출하는 구조로 가는 게 가장 안전함.

    // 예시 (교수 취소용 API가 있다고 가정):
    // try {
    //     await cancelReservationByProfessor(reservation.reservationId);
    //     await loadSlotReservations(selectedSlot.slotId);
    // } catch (e) {
    //     console.error(e);
    //     alert("예약 취소 중 오류가 발생했습니다.");
    // }
  };
  return (
    <div style={{ padding: "16px" }}>
      <h2>상담 관리 (교수용)</h2>

      {/* 1) 날짜 / 주간 범위 */}
      <WeekRangeControls
        fromDate={fromDate}
        toDate={toDate}
        onChangeFrom={setFromDate}
        onChangeTo={setToDate}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
      />

      {/* 2) 예약 보기 (전체 폭) */}
      <section style={{ marginBottom: "24px" }}>
        <ReservationView
          fromDate={fromDate}
          toDate={toDate}
          onSelectReservation={handleSelectSlot}
        />
      </section>

      {/* 3) 아래에서만 시간표 + 상세를 나란히 배치 */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          {/* 왼쪽: 시간표 + 편집 토글 */}
          <div style={{ flex: 3 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h3 style={{ margin: 0 }}>시간표 편집</h3>
              <button type="button" onClick={handleToggleEditMode}>
                {editMode ? "편집 모드 해제" : "편집 모드 켜기"}
              </button>
            </div>

            <ScheduleEditor
              key={`${fromDate}-${editMode ? "edit" : "view"}`} // 모드/주 변경 시 초안 초기화
              fromDate={fromDate}
              toDate={toDate}
              editMode={editMode}
              onSelectSlot={handleSelectSlot}
              onHasDraftChange={setHasDraft}
            />
          </div>

          {/* 오른쪽: 상세 패널 – 시간표랑만 나란히 */}
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
            <ReservationDetailPanel
              selectedSlot={selectedSlot}
              reservations={slotReservations}
              loading={detailLoading}
              error={detailError}
              onApproveReservation={(r) => handleApproveReservation(r)}
              onCancelReservation={(r) => handleCancelReservation(r)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProfessorCounselingPage;
