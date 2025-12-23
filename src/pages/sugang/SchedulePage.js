import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/schedule.css";

const SchedulePage = () => {
  const navigate = useNavigate();
  const [scheduleList, setScheduleList] = useState([]);
  const [sumGrades, setSumGrades] = useState(0);
  const [loading, setLoading] = useState(false);

  // 요일 매핑
  const dayMap = {
    월: 0,
    화: 1,
    수: 2,
    목: 3,
    금: 4,
  };

  // 시간대 (8시부터 18시까지)
  const timeSlots = Array.from({ length: 11 }, (_, i) => i + 8);

  useEffect(() => {
    fetchSchedule();
  }, []);

  // 시간표 데이터 조회
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/sugang/schedule");
      const data = response.data;

      setScheduleList(data.scheduleList || []);
      setSumGrades(data.sumGrades || 0);
    } catch (error) {
      console.error("시간표 조회 실패:", error);
      // 401 에러는 axios 인터셉터가 처리하므로 여기서는 다른 에러만 처리
      if (error.response?.status === 401) {
        // 인증 에러는 인터셉터가 처리하므로 여기서는 아무것도 하지 않음
        return;
      } else if (error.response?.status === 400) {
        alert(error.response.data.message || "시간표를 불러올 수 없습니다.");
      } else if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("시간표를 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 특정 요일, 시간대에 해당하는 과목 찾기
  const getSubjectAtTime = (day, time) => {
    return scheduleList.find((subject) => {
      const dayIndex = dayMap[subject.subDay];
      return (
        dayIndex === day && time >= subject.startTime && time < subject.endTime
      );
    });
  };

  // 시간 포맷팅
  const formatTime = (hour) => {
    return `${hour < 10 ? "0" : ""}${hour}:00`;
  };

  // 이전 시간대에 같은 과목이 있는지 확인
  const getPreviousSubject = (day, time) => {
    if (time <= 8) return null;
    return getSubjectAtTime(day, time - 1);
  };

  // 다음 시간대에 같은 과목이 있는지 확인
  const getNextSubject = (day, time) => {
    if (time >= 18) return null;
    return getSubjectAtTime(day, time + 1);
  };

  // 셀 스타일 계산 (과목이 여러 시간대에 걸쳐있는 경우)
  const getCellStyle = (day, time, subject) => {
    if (!subject) return {};

    // 해당 시간대가 과목 시간 범위에 포함되는지 확인
    const isInRange = time >= subject.startTime && time < subject.endTime;
    const isStart = time === subject.startTime;
    const isEnd = time === subject.endTime - 1;

    // 이전/다음 시간대에 같은 과목이 있는지 확인
    const prevSubject = getPreviousSubject(day, time);
    const nextSubject = getNextSubject(day, time);
    const hasPrevSame =
      prevSubject && prevSubject.subjectId === subject.subjectId;
    const hasNextSame =
      nextSubject && nextSubject.subjectId === subject.subjectId;

    if (isInRange) {
      const bgColor = getSubjectColor(subject.subjectId);
      const style = {
        backgroundColor: bgColor,
        color: "#fff",
        fontWeight: "600",
        height: "60px",
      };

      // 같은 강의의 연속된 셀인 경우 위쪽 border 제거
      if (hasPrevSame) {
        style.borderTop = "none";
      } else {
        style.borderTop = "1px solid rgba(255, 255, 255, 0.3)";
      }

      // 좌우 border는 항상 배경색과 비슷한 색상으로 (구분이 안되게)
      style.borderLeft = "1px solid rgba(255, 255, 255, 0.2)";
      style.borderRight = "1px solid rgba(255, 255, 255, 0.2)";

      // 마지막 셀인 경우 하단 border 유지
      if (isEnd || !hasNextSame) {
        style.borderBottom = "1px solid rgba(255, 255, 255, 0.3)";
      } else {
        style.borderBottom = "none";
      }

      return style;
    }

    return {};
  };

  // 과목별 색상 (과목 ID 기반)
  const getSubjectColor = (subjectId) => {
    const colors = [
      "#216d30",
      "#2a8fbd",
      "#8b5a3c",
      "#6b4c93",
      "#c94c4c",
      "#d4a017",
      "#2ecc71",
      "#3498db",
      "#9b59b6",
      "#e74c3c",
    ];
    return colors[subjectId % colors.length];
  };

  if (loading) {
    return (
      <div className="schedule-container">
        <p className="loading-text">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="sugang-application-wrapper">
      {/* 사이드 메뉴 */}
      <div className="sugang-application-sidebar">
        <div className="sugang-application-sidebar-header">
          <h2>수강신청</h2>
        </div>
        <div className="sugang-application-menu-mid">
          <table className="sugang-application-menu-table">
            <tbody>
              <tr>
                <td>
                  <a
                    href="/sugang/subjectList"
                    className="sugang-application-menu-link"
                  >
                    강의 시간표 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/schedule"
                    className="sugang-application-menu-link sugang-application-menu-active"
                  >
                    나의 시간표
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/pre"
                    className="sugang-application-menu-link"
                  >
                    예비 수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/application"
                    className="sugang-application-menu-link"
                  >
                    수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/list"
                    className="sugang-application-menu-link"
                  >
                    수강 신청 내역 조회
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="schedule-main">
        <h1>나의 시간표</h1>
        <div className="split--div"></div>

        {scheduleList.length > 0 ? (
          <>
            <div className="schedule-info">
              <span className="schedule-grade-info">
                총 신청 학점: <strong>{sumGrades}학점</strong>
              </span>
            </div>

            <div className="schedule-table-wrapper">
              <table className="schedule-table" border="1">
                <thead>
                  <tr>
                    <th className="time-header">시간</th>
                    <th>월</th>
                    <th>화</th>
                    <th>수</th>
                    <th>목</th>
                    <th>금</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((time) => (
                    <tr key={time}>
                      <td className="time-cell">{formatTime(time)}</td>
                      {[0, 1, 2, 3, 4].map((day) => {
                        const subject = getSubjectAtTime(day, time);
                        const cellStyle = getCellStyle(day, time, subject);
                        const isStart = subject && time === subject.startTime;

                        return (
                          <td
                            key={`${day}-${time}`}
                            className="schedule-cell"
                            style={cellStyle}
                          >
                            {isStart && (
                              <div className="subject-info">
                                <div className="sch-subject-name">
                                  {subject.subjectName}
                                </div>
                                <div className="subject-details">
                                  {subject.roomId && (
                                    <span className="subject-room">
                                      {subject.roomId}
                                    </span>
                                  )}
                                  {subject.professorName && (
                                    <span className="subject-professor">
                                      {subject.professorName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 과목 목록 */}
            <div className="schedule-subject-list">
              <h4>
                <span style={{ fontWeight: 600 }}>수강 과목 목록</span>
              </h4>
              <table className="sub--list--table">
                <thead>
                  <tr>
                    <th>학수번호</th>
                    <th style={{ width: "250px" }}>강의명</th>
                    <th>담당교수</th>
                    <th>학점</th>
                    <th>요일시간 (강의실)</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleList.map((subject) => (
                    <tr key={subject.subjectId}>
                      <td>{subject.subjectId}</td>
                      <td className="sub--list--name">{subject.subjectName}</td>
                      <td>{subject.professorName}</td>
                      <td>{subject.grades}</td>
                      <td>
                        {subject.subDay} {formatTime(subject.startTime)}-
                        {formatTime(subject.endTime)}
                        {subject.roomId && ` (${subject.roomId})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="no--list--p">수강 신청 내역이 없습니다.</p>
        )}
      </main>
    </div>
  );
};

export default SchedulePage;
