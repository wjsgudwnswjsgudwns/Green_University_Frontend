import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axiosConfig";
import CounselingWriteModal from "./CounselingWriteModal";
import "../../styles/professorCounselingStudentDetail.css";

export default function ProfessorCounselingStudentDetailPage() {
  const { user } = useAuth();
  const { subjectId, studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [subject, setSubject] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [counselings, setCounselings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (studentId && subjectId) {
      fetchData();
    }
  }, [studentId, subjectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // 학생 정보 조회
      const studentResponse = await api.get(`/api/student/${studentId}`);

      // 과목 정보 조회
      const subjectResponse = await api.get(`/api/subject/${subjectId}`);

      // AI 분석 결과 조회
      const analysisResponse = await api.get(
        `/api/ai-analysis/student/${studentId}/subject/${subjectId}`
      );

      // 상담 내역 조회
      const counselingsResponse = await api.get(
        `/api/ai-counseling/professor/${user.id}/student/${studentId}`
      );

      if (studentResponse.data) {
        setStudent(studentResponse.data);
      }

      if (subjectResponse.data) {
        setSubject(subjectResponse.data);
      }

      if (analysisResponse.data.code === 1) {
        setAnalysisResult(analysisResponse.data.data);
      }

      if (counselingsResponse.data.code === 1) {
        setCounselings(counselingsResponse.data.data || []);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/professor/counseling/subject/${subjectId}`);
  };

  const handleWriteCounseling = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleModalSubmit = async (counselingData) => {
    try {
      const response = await api.post("/api/ai-counseling", {
        studentId: parseInt(studentId),
        professorId: user.id,
        subjectId: parseInt(subjectId),
        ...counselingData,
      });

      if (response.data.code === 1) {
        alert("상담 일정이 등록되었습니다.");
        setShowModal(false);
        fetchData(); // 데이터 새로고침
      }
    } catch (err) {
      console.error("상담 등록 실패:", err);
      alert("상담 등록에 실패했습니다.");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      NORMAL: "pcsd-status-normal",
      CAUTION: "pcsd-status-caution",
      RISK: "pcsd-status-risk",
      CRITICAL: "pcsd-status-critical",
    };
    return colors[status] || "pcsd-status-normal";
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

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return "-";
    const date = new Date(dateTimeString);
    return date.toLocaleString("ko-KR");
  };

  if (loading) {
    return (
      <div className="pcsd-page-container">
        <div className="pcsd-loading">
          <div className="pcsd-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pcsd-page-container">
      {/* Header */}
      <div className="pcsd-header">
        <button className="pcsd-back-btn" onClick={handleBack}>
          <span className="material-symbols-outlined">arrow_back</span>
          뒤로 가기
        </button>
        <div className="pcsd-header-content">
          <div className="pcsd-header-left">
            <h1 className="pcsd-title">{student?.name} 학생 분석</h1>
            <p className="pcsd-subtitle">
              {subject?.name} | {student?.department?.name} {student?.grade}학년
            </p>
          </div>
          <button className="pcsd-write-btn" onClick={handleWriteCounseling}>
            <span className="material-symbols-outlined">edit_note</span>
            상담 일정 등록
          </button>
        </div>
      </div>

      {error && (
        <div className="pcsd-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Overall Risk Status */}
      {analysisResult && (
        <div
          className={`pcsd-overall-risk ${getStatusColor(
            analysisResult.overallRisk
          )}`}
        >
          <div className="pcsd-risk-icon">
            <span className="material-symbols-outlined">
              {analysisResult.overallRisk === "CRITICAL"
                ? "crisis_alert"
                : analysisResult.overallRisk === "RISK"
                ? "warning"
                : analysisResult.overallRisk === "CAUTION"
                ? "error"
                : "check_circle"}
            </span>
          </div>
          <div className="pcsd-risk-content">
            <h2>종합 위험도</h2>
            <p className="pcsd-risk-level">
              {getStatusText(analysisResult.overallRisk)}
            </p>
            {analysisResult.analysisDetail && (
              <p className="pcsd-risk-detail">
                {analysisResult.analysisDetail}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Analysis Grid */}
      {analysisResult && (
        <div className="pcsd-analysis-grid">
          {/* 출결 */}
          <div className="pcsd-analysis-card">
            <div className="pcsd-card-header">
              <span className="material-symbols-outlined">fact_check</span>
              <h3>출결</h3>
            </div>
            <div
              className={`pcsd-card-status ${getStatusColor(
                analysisResult.attendanceStatus
              )}`}
            >
              {getStatusText(analysisResult.attendanceStatus)}
            </div>
          </div>

          {/* 과제 */}
          <div className="pcsd-analysis-card">
            <div className="pcsd-card-header">
              <span className="material-symbols-outlined">assignment</span>
              <h3>과제</h3>
            </div>
            <div
              className={`pcsd-card-status ${getStatusColor(
                analysisResult.homeworkStatus
              )}`}
            >
              {getStatusText(analysisResult.homeworkStatus)}
            </div>
          </div>

          {/* 중간고사 */}
          <div className="pcsd-analysis-card">
            <div className="pcsd-card-header">
              <span className="material-symbols-outlined">quiz</span>
              <h3>중간고사</h3>
            </div>
            <div
              className={`pcsd-card-status ${getStatusColor(
                analysisResult.midtermStatus
              )}`}
            >
              {getStatusText(analysisResult.midtermStatus)}
            </div>
          </div>

          {/* 기말고사 */}
          <div className="pcsd-analysis-card">
            <div className="pcsd-card-header">
              <span className="material-symbols-outlined">school</span>
              <h3>기말고사</h3>
            </div>
            <div
              className={`pcsd-card-status ${getStatusColor(
                analysisResult.finalStatus
              )}`}
            >
              {getStatusText(analysisResult.finalStatus)}
            </div>
          </div>

          {/* 등록금 */}
          <div className="pcsd-analysis-card">
            <div className="pcsd-card-header">
              <span className="material-symbols-outlined">payments</span>
              <h3>등록금</h3>
            </div>
            <div
              className={`pcsd-card-status ${getStatusColor(
                analysisResult.tuitionStatus
              )}`}
            >
              {getStatusText(analysisResult.tuitionStatus)}
            </div>
          </div>

          {/* 상담 */}
          <div className="pcsd-analysis-card">
            <div className="pcsd-card-header">
              <span className="material-symbols-outlined">forum</span>
              <h3>상담</h3>
            </div>
            <div
              className={`pcsd-card-status ${getStatusColor(
                analysisResult.counselingStatus
              )}`}
            >
              {getStatusText(analysisResult.counselingStatus)}
            </div>
          </div>
        </div>
      )}

      {/* Counseling History */}
      <div className="pcsd-counseling-section">
        <h2 className="pcsd-section-title">
          <span className="material-symbols-outlined">history</span>
          상담 내역
        </h2>

        {counselings.length === 0 ? (
          <div className="pcsd-empty-state">
            <span className="material-symbols-outlined">event_busy</span>
            <p>상담 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="pcsd-counseling-list">
            {counselings.map((counseling) => (
              <div key={counseling.id} className="pcsd-counseling-item">
                <div className="pcsd-counseling-header">
                  <div className="pcsd-counseling-date">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>{formatDateTime(counseling.scheduledAt)}</span>
                  </div>
                  <span
                    className={`pcsd-counseling-badge ${
                      counseling.isCompleted
                        ? "pcsd-badge-completed"
                        : "pcsd-badge-scheduled"
                    }`}
                  >
                    {counseling.isCompleted ? "완료" : "예정"}
                  </span>
                </div>
                {counseling.isCompleted && counseling.counselingContent && (
                  <div className="pcsd-counseling-content">
                    <p>{counseling.counselingContent}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CounselingWriteModal
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          studentName={student?.name}
          subjectName={subject?.name}
        />
      )}
    </div>
  );
}
