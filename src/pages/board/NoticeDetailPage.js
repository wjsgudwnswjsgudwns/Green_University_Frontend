import React from 'react';
import { useParams, Link } from 'react-router-dom';
import '../../styles/notice.css';

/**
 * NoticeDetailPage shows the content of a single notice. For now it
 * references a static list of notices. In production the notice would
 * be fetched from a server by ID.
 */
export default function NoticeDetailPage() {
  const { id } = useParams();
  const notices = [
    { id: '1', category: '[학사]', title: '2025-1학기 수강신청 안내', date: '2024-12-10', content: '2025학년도 1학기 수강신청은 2024년 12월 20일부터 24일까지 진행됩니다. 자세한 사항은 첨부파일을 참고해주세요.' },
    { id: '2', category: '[일반]', title: '도서관 리모델링 공사 안내', date: '2024-12-05', content: '도서관 리모델링 공사로 인해 1층 열람실이 임시 폐쇄됩니다. 이용에 참고 바랍니다.' },
    { id: '3', category: '[학사]', title: '겨울학기 등록 일정 안내', date: '2024-12-01', content: '겨울학기 등록 일정은 2025년 1월 2일부터 1월 6일까지입니다.' },
  ];
  const notice = notices.find((n) => n.id === id);

  if (!notice) {
    return (
      <div className="notice-detail page-container">
        <p>해당 공지사항을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="notice-detail page-container">
      <h2>{notice.title}</h2>
      <p className="notice-meta">
        <span>{notice.category}</span> | <span>{notice.date}</span>
      </p>
      <div className="notice-content">
        <p>{notice.content}</p>
      </div>
      <Link to="/board/notice" className="back-link">목록으로</Link>
    </div>
  );
}