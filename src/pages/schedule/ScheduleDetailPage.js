import React from 'react';
import { useParams, Link } from 'react-router-dom';
import '../../styles/schedule.css';

/**
 * ScheduleDetailPage shows details for an academic schedule item. A
 * simple mock implementation referencing a static schedule list.
 */
export default function ScheduleDetailPage() {
  const { id } = useParams();
  const schedules = [
    { id: '1', start: '2025-02-01', end: '2025-02-15', info: '2025-1학기 등록 기간', description: '등록금 납부 후 학사포탈에서 등록 확인을 하시기 바랍니다.' },
    { id: '2', start: '2025-03-01', end: '2025-03-05', info: '수강신청 변경 기간', description: '수강신청 정정은 지정된 기간에만 가능합니다.' },
    { id: '3', start: '2025-06-20', end: '2025-06-26', info: '기말고사', description: '각 교과목별 기말고사 일정은 해당 강좌 공지사항을 확인하세요.' },
  ];
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) {
    return (
      <div className="schedule-detail page-container">
        <p>일정 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="schedule-detail page-container">
      <h2>{schedule.info}</h2>
      <p className="schedule-meta">
        <span>기간: {schedule.start} ~ {schedule.end}</span>
      </p>
      <div className="schedule-content">
        <p>{schedule.description}</p>
      </div>
      <Link to="/schedule" className="back-link">목록으로</Link>
    </div>
  );
}