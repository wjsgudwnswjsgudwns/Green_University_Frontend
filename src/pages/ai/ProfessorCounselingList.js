import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function ProfessorCounselingList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [counselings, setCounselings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all, high, medium, low

  useEffect(() => {
    if (user?.userRole !== "professor") {
      navigate("/");
      return;
    }
    fetchCounselings();
  }, [user, navigate]);

  const fetchCounselings = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/api/counseling/counselor/${user.id}?counselorType=PROFESSOR`
      );
      setCounselings(response.data || []);
    } catch (err) {
      console.error("상담 내역 조회 실패:", err);
      setError("상담 내역을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getCounselingTypeLabel = (type) => {
    const types = {
      학업: "학업",
      정서: "정서",
      가정: "가정",
      경력: "진로/경력",
      기타: "기타",
    };
    return types[type] || type;
  };

  const getRiskLevelBadge = (analysis) => {
    if (!analysis) return null;

    const level = analysis.riskLevel;
    const score = analysis.riskScore;

    let className = "counseling-risk-badge";
    let label = "";

    if (level === "HIGH" || score >= 70) {
      className += " counseling-risk-high";
      label = "고위험";
    } else if (level === "MEDIUM" || score >= 40) {
      className += " counseling-risk-medium";
      label = "중위험";
    } else {
      className += " counseling-risk-low";
      label = "저위험";
    }

    return (
      <span className={className}>
        {label} ({score}점)
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 위험도 필터링
  const getFilteredCounselings = () => {
    if (filter === "all") return counselings;

    return counselings.filter((counseling) => {
      if (!counseling.analysis) return false;
      const score = counseling.analysis.riskScore;

      if (filter === "high") return score >= 70;
      if (filter === "medium") return score >= 40 && score < 70;
      if (filter === "low") return score < 40;
      return true;
    });
  };

  const filteredCounselings = getFilteredCounselings();

  // 통계 계산
  const stats = {
    total: counselings.length,
    high: counselings.filter((c) => c.analysis?.riskScore >= 70).length,
    medium: counselings.filter(
      (c) => c.analysis?.riskScore >= 40 && c.analysis?.riskScore < 70
    ).length,
    low: counselings.filter((c) => c.analysis?.riskScore < 40).length,
  };

  if (loading) {
    return (
      <div className="counseling-page-container">
        <div className="counseling-loading-container">
          <div className="counseling-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="counseling-page-container">
      <aside className="counseling-side-menu">
        <div className="counseling-side-menu-header">
          <h2>상담 관리</h2>
        </div>
        <nav className="counseling-side-menu-nav">
          <Link
            to="/professor/counseling/list"
            className="counseling-menu-item active"
          >
            상담 내역
          </Link>
          <Link
            to="/professor/counseling/form"
            className="counseling-menu-item"
          >
            상담 기록 작성
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <div className="counseling-header-actions">
          <h1>상담 내역 관리</h1>
          <Link
            to="/professor/counseling/form"
            className="counseling-create-button"
          >
            상담 기록 작성
          </Link>
        </div>
        <div className="counseling-divider"></div>

        {error && <div className="counseling-error-message">{error}</div>}

        {/* 통계 카드 */}
        <div className="counseling-stats">
          <div className="counseling-stat-card">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">총 상담 횟수</span>
              <span className="counseling-stat-value">{stats.total}회</span>
            </div>
          </div>
          <div className="counseling-stat-card counseling-stat-high">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">고위험</span>
              <span className="counseling-stat-value">{stats.high}명</span>
            </div>
          </div>
          <div className="counseling-stat-card counseling-stat-medium">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">중위험</span>
              <span className="counseling-stat-value">{stats.medium}명</span>
            </div>
          </div>
          <div className="counseling-stat-card counseling-stat-low">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">저위험</span>
              <span className="counseling-stat-value">{stats.low}명</span>
            </div>
          </div>
        </div>

        {/* 필터 버튼 */}
        <div className="counseling-filter-buttons">
          <button
            onClick={() => setFilter("all")}
            className={`counseling-filter-button ${
              filter === "all" ? "active" : ""
            }`}
          >
            전체 ({stats.total})
          </button>
          <button
            onClick={() => setFilter("high")}
            className={`counseling-filter-button ${
              filter === "high" ? "active" : ""
            }`}
          >
            고위험 ({stats.high})
          </button>
          <button
            onClick={() => setFilter("medium")}
            className={`counseling-filter-button ${
              filter === "medium" ? "active" : ""
            }`}
          >
            중위험 ({stats.medium})
          </button>
          <button
            onClick={() => setFilter("low")}
            className={`counseling-filter-button ${
              filter === "low" ? "active" : ""
            }`}
          >
            저위험 ({stats.low})
          </button>
        </div>

        {filteredCounselings.length === 0 ? (
          <div className="counseling-empty-state">
            <p>
              {filter === "all"
                ? "아직 상담 기록이 없습니다."
                : "해당 조건의 상담 기록이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="counseling-table-container">
            <table className="counseling-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>학생</th>
                  <th>상담 제목</th>
                  <th>상담 유형</th>
                  <th>위험도</th>
                  <th>상담 일자</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {filteredCounselings.map((counseling, index) => (
                  <tr
                    key={counseling.id}
                    onClick={() =>
                      navigate(`/professor/counseling/${counseling.id}`)
                    }
                    className="counseling-table-row-clickable"
                  >
                    <td>{filteredCounselings.length - index}</td>
                    <td className="counseling-student-cell">
                      {counseling.studentName}
                    </td>
                    <td className="counseling-title-cell">
                      {counseling.title}
                    </td>
                    <td>
                      <span className="counseling-type-badge">
                        {getCounselingTypeLabel(counseling.counselingType)}
                      </span>
                    </td>
                    <td>{getRiskLevelBadge(counseling.analysis)}</td>
                    <td>{formatDate(counseling.counselingDate)}</td>
                    <td>{formatDate(counseling.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
