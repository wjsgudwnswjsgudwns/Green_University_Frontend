import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/scheduleInfo.css";
import "../../styles/scheduleCalendar.css";

export default function ScheduleListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await api.get("/api/schedule");
      const data = response.data;
      setSchedules(data);
    } catch (err) {
      console.error("학사일정 조회 실패:", err);
      setError("학사일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 날짜 파싱 함수
  const parseDate = (dateStr) => {
    if (!dateStr) return null;

    // MM-DD 형식
    if (dateStr.match(/^\d{2}-\d{2}$/)) {
      const [month, day] = dateStr.split("-").map(Number);
      return new Date(currentYear, month - 1, day);
    }
    // YYYY-MM-DD 형식
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return null;
  };

  // 달력 생성 함수
  const generateCalendar = (year, month) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendar = [];
    let week = [];

    // 이전 달의 빈 칸 채우기
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push({ day: null, date: null });
    }

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      week.push({ day, date });

      if (week.length === 7 || day === daysInMonth) {
        // 마지막 주의 빈 칸 채우기
        while (week.length < 7) {
          week.push({ day: null, date: null });
        }
        calendar.push(week);
        week = [];
      }
    }

    return calendar;
  };

  // 해당 월의 일정 처리 및 그리드 위치 계산
  const getSchedulePositions = (year, month, calendar) => {
    const positions = [];
    const layers = []; // 각 층별로 사용 중인 그리드 셀 추적

    schedules.forEach((schedule) => {
      const startDate = parseDate(schedule.startDay);
      const endDate = parseDate(schedule.endDay);

      if (!startDate || !endDate) return;

      // 현재 달력에 표시될 일정만 필터링
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      if (endDate < monthStart || startDate > monthEnd) return;

      // 현재 월의 범위 내에서 시작일과 종료일 조정
      const displayStart = startDate < monthStart ? monthStart : startDate;
      const displayEnd = endDate > monthEnd ? monthEnd : endDate;

      // 첫 주의 빈 칸 개수
      const emptyDaysInFirstWeek = calendar[0].filter((d) => !d.day).length;

      // 시작 날짜의 인덱스
      const startDayNum = displayStart.getDate();
      const startIndex = emptyDaysInFirstWeek + startDayNum - 1;

      // 시작 위치 (row, col)
      const startRow = Math.floor(startIndex / 7) + 2; // +2는 헤더 행
      const startCol = (startIndex % 7) + 1;

      // 종료 날짜의 인덱스
      const endDayNum = displayEnd.getDate();
      const endIndex = emptyDaysInFirstWeek + endDayNum - 1;

      // 종료 위치
      const endRow = Math.floor(endIndex / 7) + 2;
      const endCol = (endIndex % 7) + 1;

      // 이 일정이 차지하는 모든 셀 계산
      const occupiedCells = [];
      for (let row = startRow; row <= endRow; row++) {
        const colStart = row === startRow ? startCol : 1;
        const colEnd = row === endRow ? endCol : 7;
        for (let col = colStart; col <= colEnd; col++) {
          occupiedCells.push({ row, col });
        }
      }

      // 겹치지 않는 층(layer) 찾기
      let layerIndex = 0;
      let foundLayer = false;

      while (!foundLayer) {
        if (!layers[layerIndex]) {
          layers[layerIndex] = [];
        }

        // 현재 층에서 겹치는지 확인
        const hasConflict = occupiedCells.some((cell) =>
          layers[layerIndex].some(
            (occupied) => occupied.row === cell.row && occupied.col === cell.col
          )
        );

        if (!hasConflict) {
          // 이 층을 사용
          layers[layerIndex].push(...occupiedCells);
          foundLayer = true;
        } else {
          layerIndex++;
        }
      }

      // 같은 주에 있는 경우
      if (startRow === endRow) {
        positions.push({
          ...schedule,
          gridRow: startRow,
          gridColumnStart: startCol,
          gridColumnEnd: endCol + 1,
          startDate: displayStart,
          endDate: displayEnd,
          layer: layerIndex,
        });
      } else {
        // 여러 주에 걸친 경우 - 각 주별로 분리
        // 첫 번째 주
        positions.push({
          ...schedule,
          gridRow: startRow,
          gridColumnStart: startCol,
          gridColumnEnd: 8, // 주의 끝까지
          startDate: displayStart,
          endDate: displayEnd,
          isFirst: true,
          layer: layerIndex,
        });

        // 중간 주들
        for (let row = startRow + 1; row < endRow; row++) {
          positions.push({
            ...schedule,
            gridRow: row,
            gridColumnStart: 1,
            gridColumnEnd: 8,
            startDate: displayStart,
            endDate: displayEnd,
            isMiddle: true,
            layer: layerIndex,
          });
        }

        // 마지막 주
        if (endRow > startRow) {
          positions.push({
            ...schedule,
            gridRow: endRow,
            gridColumnStart: 1,
            gridColumnEnd: endCol + 1,
            startDate: displayStart,
            endDate: displayEnd,
            isLast: true,
            layer: layerIndex,
          });
        }
      }
    });

    return positions;
  };

  const handleScheduleClick = (id) => {
    navigate(`/schedule/${id}`);
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  if (loading) {
    return (
      <div className="sch-page-container">
        <div className="sch-loading-container">
          <div className="sch-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  const calendar = generateCalendar(currentYear, selectedMonth);
  const schedulePositions = getSchedulePositions(
    currentYear,
    selectedMonth,
    calendar
  );

  return (
    <div className="sch-container">
      <aside className="sch-side-menu">
        <div className="sch-side-menu-header">
          <h2>학사정보</h2>
        </div>
        <nav className="sch-side-menu-nav">
          <Link to="/board/notice" className="sch-menu-item">
            공지사항
          </Link>
          <Link to="/schedule" className="sch-menu-item active">
            학사일정
          </Link>
          {user?.userRole === "staff" && (
            <Link to="/schedule/manage" className="sch-menu-item">
              학사일정 등록
            </Link>
          )}
        </nav>
      </aside>

      <main className="sch-main">
        <h1>학사일정</h1>
        <div className="sch-divider"></div>

        {error && <div className="sch-error-message">{error}</div>}

        <div className="calendar-container">
          {/* 월 선택 헤더 */}
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={handlePrevMonth}>
              ◀
            </button>
            <h2 className="calendar-title">
              {currentYear}년 {selectedMonth}월
            </h2>
            <button className="calendar-nav-btn" onClick={handleNextMonth}>
              ▶
            </button>
          </div>

          <div className="calendar-content-wrapper">
            {/* 달력 그리드 */}
            <div className="calendar-grid-wrapper">
              <div className="calendar-grid-container">
                {/* 요일 헤더 */}
                {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
                  <div
                    key={day}
                    className={`calendar-weekday ${
                      idx === 0 ? "sunday" : idx === 6 ? "saturday" : ""
                    }`}
                  >
                    {day}
                  </div>
                ))}

                {/* 날짜 셀 */}
                {calendar.map((week, weekIdx) =>
                  week.map((dayInfo, dayIdx) => (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`calendar-day ${!dayInfo.day ? "empty" : ""} ${
                        dayIdx === 0 ? "sunday" : dayIdx === 6 ? "saturday" : ""
                      }`}
                      style={{
                        gridRow: weekIdx + 2, // 요일 헤더가 1행, 날짜는 2행부터
                        gridColumn: dayIdx + 1,
                      }}
                    >
                      {dayInfo.day && (
                        <div className="day-number">{dayInfo.day}</div>
                      )}
                    </div>
                  ))
                )}

                {/* 일정 레이어 */}
                {schedulePositions.map((schedule, idx) => {
                  const topMargin = 26 + (schedule.layer || 0) * 30;

                  // 층별 색상 배열
                  const layerColors = [
                    {
                      bg: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
                      text: "#1a5524",
                      border: "#216d30",
                    },
                    {
                      bg: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                      text: "#0d47a1",
                      border: "#1976d2",
                    },
                    {
                      bg: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
                      text: "#e65100",
                      border: "#f57c00",
                    },
                    {
                      bg: "linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)",
                      text: "#880e4f",
                      border: "#c2185b",
                    },
                    {
                      bg: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)",
                      text: "#4a148c",
                      border: "#7b1fa2",
                    },
                  ];

                  const colorIndex = (schedule.layer || 0) % layerColors.length;
                  const colors = layerColors[colorIndex];

                  return (
                    <div
                      key={`${schedule.id}-${idx}`}
                      className="schedule-event"
                      style={{
                        gridRow: schedule.gridRow,
                        gridColumn: `${schedule.gridColumnStart} / ${schedule.gridColumnEnd}`,
                        marginTop: `${topMargin}px`,
                        background: colors.bg,
                        color: colors.text,
                        borderLeftColor: colors.border,
                      }}
                      onClick={() => handleScheduleClick(schedule.id)}
                      title={`${schedule.information} (${
                        schedule.startDate.getMonth() + 1
                      }/${schedule.startDate.getDate()} ~ ${
                        schedule.endDate.getMonth() + 1
                      }/${schedule.endDate.getDate()})`}
                    >
                      {/* 첫 번째 조각이거나 단일 행인 경우에만 텍스트 표시 */}
                      {!schedule.isMiddle &&
                        !schedule.isLast &&
                        schedule.information}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 일정 리스트 */}
            <div className="schedule-list-wrapper">
              <h3 className="schedule-list-title">
                {selectedMonth}월 학사일정
              </h3>
              <div className="schedule-list">
                {schedules
                  .filter((schedule) => {
                    const startDate = parseDate(schedule.startDay);
                    const endDate = parseDate(schedule.endDay);
                    if (!startDate || !endDate) return false;

                    const monthStart = new Date(
                      currentYear,
                      selectedMonth - 1,
                      1
                    );
                    const monthEnd = new Date(currentYear, selectedMonth, 0);

                    return !(endDate < monthStart || startDate > monthEnd);
                  })
                  .sort((a, b) => {
                    const dateA = parseDate(a.startDay);
                    const dateB = parseDate(b.startDay);
                    return dateA - dateB;
                  })
                  .map((schedule) => {
                    const startDate = parseDate(schedule.startDay);
                    const endDate = parseDate(schedule.endDay);

                    return (
                      <div
                        key={schedule.id}
                        className="schedule-list-item"
                        onClick={() => handleScheduleClick(schedule.id)}
                      >
                        <div className="schedule-list-date">
                          {startDate.getMonth() + 1}/{startDate.getDate()} ~{" "}
                          {endDate.getMonth() + 1}/{endDate.getDate()}
                        </div>
                        <div className="schedule-list-info">
                          {schedule.information}
                        </div>
                      </div>
                    );
                  })}
                {schedules.filter((schedule) => {
                  const startDate = parseDate(schedule.startDay);
                  const endDate = parseDate(schedule.endDay);
                  if (!startDate || !endDate) return false;

                  const monthStart = new Date(
                    currentYear,
                    selectedMonth - 1,
                    1
                  );
                  const monthEnd = new Date(currentYear, selectedMonth, 0);

                  return !(endDate < monthStart || startDate > monthEnd);
                }).length === 0 && (
                  <div className="schedule-list-empty">
                    이번 달 학사일정이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
