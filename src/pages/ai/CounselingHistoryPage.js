// CounselingHistoryPage.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counselingHistory.css";

export default function CounselingHistoryPage() {
  const { studentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [counselings, setCounselings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && studentId) {
      fetchData();
    }
  }, [user, studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // 학생 정보 조회
      const studentResponse = await api.get(`/api/students/${studentId}`);
      setStudent(studentResponse.data);

      // 상담 이력 조회
      const counselingResponse = await api.get(
        `/api/ai-counseling/professor/${user.id}/student/${studentId}`
      );

      if (counselingResponse.data?.code === 1) {
        setCounselings(counselingResponse.data.data || []);
      } else {
        setCounselings([]);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "ch-risk-normal" },
      CAUTION: { text: "주의", class: "ch-risk-caution" },
      RISK: { text: "위험", class: "ch-risk-warning" },
      CRITICAL: { text: "심각", class: "ch-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return <span className={`ch-risk-badge ${badge.class}`}>{badge.text}</span>;
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "-";
    const date = new Date(dateTimeStr);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="ch-page-container">
        <div className="ch-loading">
          <div className="ch-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-page-container">
      <div className="ch-header">
        <h1 className="ch-title">상담 이력 조회</h1>
        <button className="ch-back-btn" onClick={() => navigate(-1)}>
          뒤로가기
        </button>
      </div>

      {error && (
        <div className="ch-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {student && (
        <div className="ch-student-info">
          <h2>학생 정보</h2>
          <div className="ch-info-grid">
            <div className="ch-info-item">
              <span className="ch-info-label">학번</span>
              <span className="ch-info-value">{student.id}</span>
            </div>
            <div className="ch-info-item">
              <span className="ch-info-label">이름</span>
              <span className="ch-info-value">{student.name}</span>
            </div>
            <div className="ch-info-item">
              <span className="ch-info-label">학과</span>
              <span className="ch-info-value">
                {student.department?.name || "-"}
              </span>
            </div>
            <div className="ch-info-item">
              <span className="ch-info-label">학년</span>
              <span className="ch-info-value">{student.grade}학년</span>
            </div>
          </div>
        </div>
      )}

      <div className="ch-counseling-section">
        <div className="ch-section-header">
          <h2>상담 이력</h2>
          <span className="ch-count-badge">총 {counselings.length}건</span>
        </div>

        {counselings.length === 0 ? (
          <div className="ch-empty-state">
            <p>상담 이력이 없습니다.</p>
          </div>
        ) : (
          <table className="ch-counseling-table">
            <thead>
              <tr>
                <th>상담일시</th>
                <th>과목</th>
                <th>교수</th>
                <th>상태</th>
                <th>AI 분석</th>
                <th>상담내용</th>
              </tr>
            </thead>
            <tbody>
              {counselings.map((counseling) => (
                <tr key={counseling.id}>
                  <td>{formatDateTime(counseling.scheduledAt)}</td>
                  <td className="ch-subject-cell">
                    {counseling.subject?.name || "과목명"}
                  </td>
                  <td>{counseling.professor?.name || "교수명"}</td>
                  <td>
                    {counseling.isCompleted ? (
                      <span className="ch-status-badge ch-status-completed">
                        완료
                      </span>
                    ) : (
                      <span className="ch-status-badge ch-status-pending">
                        예정
                      </span>
                    )}
                  </td>
                  <td>
                    {counseling.aiAnalysisResult ? (
                      getRiskBadge(counseling.aiAnalysisResult)
                    ) : (
                      <span className="ch-status-badge">-</span>
                    )}
                  </td>
                  <td className="ch-content-cell">
                    {counseling.counselingContent || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
