import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/notice.css';

/**
 * NoticeListPage displays a list of notices (공지사항). Each notice has
 * a category, title and published date. Clicking on a notice takes the
 * user to the detail page. Data is mocked for now.
 */
export default function NoticeListPage() {
  const notices = [
    { id: 1, category: '[학사]', title: '2025-1학기 수강신청 안내', date: '2024-12-10', content: '수강신청 기간은...' },
    { id: 2, category: '[일반]', title: '도서관 리모델링 공사 안내', date: '2024-12-05', content: '도서관 공사가...' },
    { id: 3, category: '[학사]', title: '겨울학기 등록 일정 안내', date: '2024-12-01', content: '겨울학기 등록은...' },
  ];
  return (
    <div className="notice-list page-container">
      <h2>공지사항</h2>
      <table className="notice-table">
        <thead>
          <tr>
            <th>번호</th>
            <th>분류</th>
            <th>제목</th>
            <th>등록일</th>
          </tr>
        </thead>
        <tbody>
          {notices.map((notice) => (
            <tr key={notice.id}>
              <td>{notice.id}</td>
              <td>{notice.category}</td>
              <td>
                <Link to={`/board/notice/${notice.id}`}>{notice.title}</Link>
              </td>
              <td>{notice.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}