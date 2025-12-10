import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function StaffCounselingStatistics() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState(
    new Date().getMonth() <= 6 ? 1 : 2
  );

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchDepartments();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedDept) {
      fetchDepartmentStatistics();
    }
  }, [selectedDept, selectedYear, selectedSemester]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/admin/departments/all");
      setDepartments(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedDept(response.data[0].id);
      }
    } catch (err) {
      console.error("학과 목록 조회 실패:", err);
      setError("학과 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentStatistics = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/api/counseling/risk/statistics/department/${selectedDept}`,
        {
          params: {
            year: selectedYear,
            semester: selectedSemester,
          },
        }
      );
      setStatistics(response.data);
    } catch (err) {
      console.error("학과 통계 조회 실패:", err);
      setError("학과 통계를 불러오는데 실패했습니다.");
      setStatistics(null);
    } finally {
      setLoading(false);
    }
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

  const getDeptName = () => {
    const dept = departments.find((d) => d.id === selectedDept);
    return dept ? dept.name : "";
  };

  if (loading && !statistics) {
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
            className="counseling-menu-item"
          >
            고위험 학생 현황
          </Link>
          <Link
            to="/staff/counseling/statistics"
            className="counseling-menu-item active"
          >
            학과별 통계
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <h1>학과별 중도탈락 위험도 통계</h1>
        <div className="counseling-divider"></div>

        {error && <div className="counseling-error-message">{error}</div>}

        {/* 학과 및 학기 선택 */}
        <div className="counseling-filter-section">
          <div className="counseling-form-group">
            <label>학과</label>
            <select
              value={selectedDept || ""}
              onChange={(e) => setSelectedDept(parseInt(e.target.value))}
              className="counseling-form-select"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
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

        {statistics ? (
          <>
            {/* 전체 통계 카드 */}
            <div className="counseling-statistics-summary">
              <h2>{getDeptName()} 위험도 분포</h2>
              <div className="counseling-stats">
                <div className="counseling-stat-card">
                  <div className="counseling-stat-content">
                    <span className="counseling-stat-label">전체 학생</span>
                    <span className="counseling-stat-value">
                      {statistics.totalStudents}명
                    </span>
                  </div>
                </div>
                <div className="counseling-stat-card counseling-stat-critical">
                  <div className="counseling-stat-content">
                    <span className="counseling-stat-label">긴급</span>
                    <span className="counseling-stat-value">
                      {statistics.criticalRiskCount}명
                    </span>
                  </div>
                </div>
                <div className="counseling-stat-card counseling-stat-high">
                  <div className="counseling-stat-content">
                    <span className="counseling-stat-label">고위험</span>
                    <span className="counseling-stat-value">
                      {statistics.highRiskCount}명
                    </span>
                  </div>
                </div>
                <div className="counseling-stat-card counseling-stat-medium">
                  <div className="counseling-stat-content">
                    <span className="counseling-stat-label">중위험</span>
                    <span className="counseling-stat-value">
                      {statistics.mediumRiskCount}명
                    </span>
                  </div>
                </div>
                <div className="counseling-stat-card counseling-stat-low">
                  <div className="counseling-stat-content">
                    <span className="counseling-stat-label">저위험</span>
                    <span className="counseling-stat-value">
                      {statistics.lowRiskCount}명
                    </span>
                  </div>
                </div>
              </div>

              <div className="counseling-detail-card">
                <div className="counseling-stat-detail">
                  <span className="counseling-stat-detail-label">
                    평균 위험도 점수
                  </span>
                  <span className="counseling-stat-detail-value">
                    {statistics.averageRiskScore.toFixed(1)}점
                  </span>
                </div>
                <div className="counseling-stat-detail">
                  <span className="counseling-stat-detail-label">
                    위험군 비율
                  </span>
                  <span className="counseling-stat-detail-value">
                    {statistics.totalStudents > 0
                      ? (
                          ((statistics.criticalRiskCount +
                            statistics.highRiskCount +
                            statistics.mediumRiskCount) /
                            statistics.totalStudents) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* 고위험 학생 TOP 10 */}
            {statistics.topRiskStudents &&
              statistics.topRiskStudents.length > 0 && (
                <div className="counseling-top-risk-section">
                  <h2>우선 관리 대상 (TOP 10)</h2>
                  <div className="counseling-table-container">
                    <table className="counseling-table">
                      <thead>
                        <tr>
                          <th>순위</th>
                          <th>학번</th>
                          <th>이름</th>
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
                        {statistics.topRiskStudents.map((student, index) => (
                          <tr key={student.studentId}>
                            <td>
                              <strong>{index + 1}</strong>
                            </td>
                            <td>{student.studentId}</td>
                            <td className="counseling-student-cell">
                              {student.studentName}
                            </td>
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
                </div>
              )}

            <div className="counseling-info-box">
              <span className="counseling-info-icon material-symbols-outlined">
                info
              </span>
              <p>
                위험도 점수는 성적(40%), 출석(30%), 상담(30%)을 종합하여
                산출됩니다. 80점 이상은 즉시 개입이 필요한 긴급 상황입니다.
              </p>
            </div>
          </>
        ) : (
          <div className="counseling-empty-state">
            <span className="counseling-empty-icon material-symbols-outlined">
              analytics
            </span>
            <p>해당 학과의 통계 데이터가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
