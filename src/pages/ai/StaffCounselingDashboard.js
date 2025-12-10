import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function StaffCounselingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all, critical, high, medium
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState(
    new Date().getMonth() <= 6 ? 1 : 2
  );

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchHighRiskStudents();
  }, [user, navigate, selectedYear, selectedSemester]);

  const fetchHighRiskStudents = async () => {
    try {
      setLoading(true);
      const minScore = 60; // 60점 이상 학생 조회
      const response = await api.get(
        `/api/counseling/risk/high-risk-students`,
        {
          params: {
            year: selectedYear,
            semester: selectedSemester,
            minScore: minScore,
          },
        }
      );
      setStudents(response.data || []);
    } catch (err) {
      console.error("고위험 학생 조회 실패:", err);
      setError("고위험 학생 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelBadge = (level, score) => {
    let className = "counseling-risk-badge";
    let label = "";

    if (level === "CRITICAL" || score >= 80) {
      className += " counseling-risk-critical";
      label = "긴급";
    } else if (level === "HIGH" || score >= 70) {
      className += " counseling-risk-high";
      label = "고위험";
    } else if (level === "MEDIUM" || score >= 60) {
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

  // 필터링
  const getFilteredStudents = () => {
    if (filter === "all") return students;

    return students.filter((student) => {
      const score = student.totalRiskScore;
      if (filter === "critical") return score >= 80;
      if (filter === "high") return score >= 70 && score < 80;
      if (filter === "medium") return score >= 60 && score < 70;
      return true;
    });
  };

  const filteredStudents = getFilteredStudents();

  // 통계
  const stats = {
    total: students.length,
    critical: students.filter((s) => s.totalRiskScore >= 80).length,
    high: students.filter(
      (s) => s.totalRiskScore >= 70 && s.totalRiskScore < 80
    ).length,
    medium: students.filter(
      (s) => s.totalRiskScore >= 60 && s.totalRiskScore < 70
    ).length,
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
          <h2>중도탈락 관리</h2>
        </div>
        <nav className="counseling-side-menu-nav">
          <Link
            to="/staff/counseling/dashboard"
            className="counseling-menu-item active"
          >
            고위험 학생 현황
          </Link>
          <Link
            to="/staff/counseling/statistics"
            className="counseling-menu-item"
          >
            학과별 통계
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <h1>고위험 학생 모니터링</h1>
        <div className="counseling-divider"></div>

        {error && <div className="counseling-error-message">{error}</div>}

        {/* 학기 선택 */}
        <div className="counseling-semester-selector">
          <div className="counseling-form-group">
            <label>학년도</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="counseling-form-select"
            >
              {[2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="counseling-form-group">
            <label>학기</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(parseInt(e.target.value))}
              className="counseling-form-select"
            >
              <option value={1}>1학기</option>
              <option value={2}>2학기</option>
            </select>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="counseling-stats">
          <div className="counseling-stat-card">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">위험군 학생</span>
              <span className="counseling-stat-value">{stats.total}명</span>
            </div>
          </div>
          <div className="counseling-stat-card counseling-stat-critical">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">긴급 (80점 이상)</span>
              <span className="counseling-stat-value">{stats.critical}명</span>
            </div>
          </div>
          <div className="counseling-stat-card counseling-stat-high">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">고위험 (70-79점)</span>
              <span className="counseling-stat-value">{stats.high}명</span>
            </div>
          </div>
          <div className="counseling-stat-card counseling-stat-medium">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">중위험 (60-69점)</span>
              <span className="counseling-stat-value">{stats.medium}명</span>
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
            onClick={() => setFilter("critical")}
            className={`counseling-filter-button ${
              filter === "critical" ? "active" : ""
            }`}
          >
            긴급 ({stats.critical})
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
        </div>

        <div className="counseling-info-box">
          <p>
            60점 이상의 학생들이 표시됩니다. 긴급(80점 이상) 학생은 즉시 개입이
            필요합니다.
          </p>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="counseling-empty-state">
            <p>
              {filter === "all"
                ? "현재 위험군 학생이 없습니다."
                : "해당 조건의 학생이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="counseling-table-container">
            <table className="counseling-table">
              <thead>
                <tr>
                  <th>학번</th>
                  <th>이름</th>
                  <th>학과</th>
                  <th>학년</th>
                  <th>총합 위험도</th>
                  <th>성적</th>
                  <th>출석</th>
                  <th>상담</th>
                  <th>최근 상담일</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.studentId}>
                    <td>{student.studentId}</td>
                    <td className="counseling-student-cell">
                      {student.studentName}
                    </td>
                    <td>{student.departmentName}</td>
                    <td>{student.grade}학년</td>
                    <td>
                      {getRiskLevelBadge(
                        student.riskLevel,
                        student.totalRiskScore
                      )}
                    </td>
                    <td>
                      <span className="counseling-score-badge">
                        {student.gradeRiskScore}점
                      </span>
                    </td>
                    <td>
                      <span className="counseling-score-badge">
                        {student.attendanceRiskScore}점
                      </span>
                    </td>
                    <td>
                      <span className="counseling-score-badge">
                        {student.counselingRiskScore}점
                      </span>
                    </td>
                    <td>{formatDate(student.lastCounselingDate)}</td>
                    <td>
                      <button
                        onClick={() =>
                          navigate(
                            `/staff/counseling/student/${student.studentId}?year=${selectedYear}&semester=${selectedSemester}`
                          )
                        }
                        className="counseling-button counseling-button-small"
                      >
                        상세보기
                      </button>
                    </td>
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
