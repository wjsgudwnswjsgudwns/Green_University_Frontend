import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/schedule.css';

/**
 * ScheduleListPage shows a list of academic schedules. Each entry
 * includes a date range and description. Clicking the description
 * navigates to a detail page (not implemented here but reserved).
 */
export default function ScheduleListPage() {
  const schedules = [
    { id: 1, start: '2025-02-01', end: '2025-02-15', info: '2025-1학기 등록 기간' },
    { id: 2, start: '2025-03-01', end: '2025-03-05', info: '수강신청 변경 기간' },
    { id: 3, start: '2025-06-20', end: '2025-06-26', info: '기말고사' },
  ];
  return (
    <div className="schedule-list page-container">
      <h2>학사일정</h2>
      <table className="schedule-table">
        <thead>
          <tr>
            <th>시작일</th>
            <th>종료일</th>
            <th>내용</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((sch) => (
            <tr key={sch.id}>
              <td>{sch.start.substring(5)}</td>
              <td>{sch.end.substring(5)}</td>
              <td>
                <Link to={`/schedule/${sch.id}`}>{sch.info}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}