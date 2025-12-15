import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/staffStudentDetail.css";

export default function StaffStudentDetailPage() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Fetching data for student:", studentId);

      // 학생 정보 조회
      const studentResponse = await api.get(`/api/students/${studentId}`);
      console.log("Student response:", studentResponse);

      // 학생의 모든 과목별 분석 결과 조회
      const analysisResponse = await api.get(
        `/api/ai-analysis/student/${studentId}`
      );
      console.log("Analysis response:", analysisResponse);

      if (studentResponse.data) {
        setStudent(studentResponse.data);
      }

      if (analysisResponse.data.code === 1) {
        const results = analysisResponse.data.data || [];
        setAnalysisResults(results);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      console.error("Error response:", err.response);

      if (err.response?.status === 401) {
        setError("인증이 필요합니다. 다시 로그인해주세요.");
      } else if (err.response?.status === 404) {
        setError("해당 학생의 정보를 찾을 수 없습니다.");
      } else {
        setError(
          `데이터를 불러오는데 실패했습니다. (${
            err.response?.status || "Network Error"
          })`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const getStatusColor = (status) => {
    const colors = {
      NORMAL: "ssd-status-normal",
      CAUTION: "ssd-status-caution",
      RISK: "ssd-status-risk",
      CRITICAL: "ssd-status-critical",
    };
    return colors[status] || "ssd-status-normal";
  };

  const getStatusText = (status) => {
    const texts = {
      NORMAL: "정상",
      CAUTION: "주의",
      RISK: "위험",
      CRITICAL: "심각",
    };
    return texts[status] || "정상";
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "ssd-risk-normal" },
      CAUTION: { text: "주의", class: "ssd-risk-caution" },
      RISK: { text: "위험", class: "ssd-risk-warning" },
      CRITICAL: { text: "심각", class: "ssd-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return (
      <span className={`ssd-risk-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  const getHighestRisk = () => {
    if (analysisResults.length === 0) return "NORMAL";

    const riskPriorities = {
      CRITICAL: 4,
      RISK: 3,
      CAUTION: 2,
      NORMAL: 1,
    };

    let highestRisk = "NORMAL";
    let highestPriority = 0;

    analysisResults.forEach((result) => {
      const priority = riskPriorities[result.overallRisk] || 0;
      if (priority > highestPriority) {
        highestRisk = result.overallRisk;
        highestPriority = priority;
      }
    });

    return highestRisk;
  };

  if (loading) {
    return (
      <div className="ssd-page-container">
        <div className="ssd-loading">
          <div className="ssd-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const highestRisk = getHighestRisk();

  return (
    <div className="ssd-page-container">
      {/* Header */}
      <div className="ssd-header">
        <div className="ssd-header-content">
          <div className="ssd-header-left">
            <h1 className="ssd-title">{student?.name} 학생 분석</h1>
            <p className="ssd-subtitle">
              {student?.department?.name} {student?.grade}학년 | 학번:{" "}
              {studentId}
            </p>
          </div>
          {getRiskBadge(highestRisk)}
        </div>
      </div>

      {error && <div className="ssd-error-message">{error}</div>}

      {/* Student Info Summary */}
      <div className="ssd-summary-section">
        <div className="ssd-summary-card">
          <div>
            <label>이름</label>
            <span>{student?.name}</span>
          </div>
        </div>
        <div className="ssd-summary-card">
          <div>
            <label>학과</label>
            <span>{student?.department?.name}</span>
          </div>
        </div>
        <div className="ssd-summary-card">
          <div>
            <label>학년</label>
            <span>{student?.grade}학년</span>
          </div>
        </div>
        <div className="ssd-summary-card">
          <div>
            <label>수강 과목</label>
            <span>{analysisResults.length}개</span>
          </div>
        </div>
      </div>

      {/* Subject List Table */}
      <div className="ssd-table-section">
        <h2 className="ssd-section-title">수강 과목 분석 결과</h2>

        {analysisResults.length === 0 ? (
          <div className="ssd-empty-state">
            <p>수강 중인 과목이 없습니다.</p>
          </div>
        ) : (
          <div className="ssd-table-container">
            <table className="ssd-table">
              <thead>
                <tr>
                  <th>과목명</th>
                  <th>담당교수</th>
                  <th>출결</th>
                  <th>과제</th>
                  <th>중간고사</th>
                  <th>기말고사</th>
                  <th>등록금</th>
                  <th>상담</th>
                  <th>종합위험도</th>
                </tr>
              </thead>
              <tbody>
                {analysisResults.map((result) => (
                  <tr key={result.subjectId}>
                    <td className="ssd-table-subject">
                      <div className="ssd-subject-name">
                        {result.subject?.name || "과목명"}
                      </div>
                    </td>
                    <td className="ssd-table-professor">
                      {result.subject?.professor?.name || "교수"}
                    </td>
                    <td>
                      <span
                        className={`ssd-status-badge ${getStatusColor(
                          result.attendanceStatus
                        )}`}
                      >
                        {getStatusText(result.attendanceStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ssd-status-badge ${getStatusColor(
                          result.homeworkStatus
                        )}`}
                      >
                        {getStatusText(result.homeworkStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ssd-status-badge ${getStatusColor(
                          result.midtermStatus
                        )}`}
                      >
                        {getStatusText(result.midtermStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ssd-status-badge ${getStatusColor(
                          result.finalStatus
                        )}`}
                      >
                        {getStatusText(result.finalStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ssd-status-badge ${getStatusColor(
                          result.tuitionStatus
                        )}`}
                      >
                        {getStatusText(result.tuitionStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ssd-status-badge ${getStatusColor(
                          result.counselingStatus
                        )}`}
                      >
                        {getStatusText(result.counselingStatus)}
                      </span>
                    </td>
                    <td>{getRiskBadge(result.overallRisk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Back Button */}
        <div className="ssd-back-btn-container">
          <button className="ssd-back-btn" onClick={handleBack}>
            뒤로 가기
          </button>
        </div>
      </div>
    </div>
  );
}
