import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/professorCounseling.css";

export default function ProfessorCounselingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [riskAlerts, setRiskAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && user.id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // 교수가 담당하는 과목 리스트 조회
      const subjectsResponse = await api.get(
        `/api/subject/professor/${user.id}`
      );

      // 중도 이탈 위험 알림 조회
      const alertsResponse = await api.get(
        `/api/ai-risk-alert/professor/${user.id}/unchecked`
      );

      if (subjectsResponse.data) {
        setSubjects(subjectsResponse.data || []);
      }

      if (alertsResponse.data.code === 1) {
        setRiskAlerts(alertsResponse.data.data || []);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectClick = (subjectId) => {
    navigate(`/professor/counseling/subject/${subjectId}`);
  };

  const handleAlertClick = (alert) => {
    if (alert.studentId && alert.subjectId) {
      navigate(
        `/professor/counseling/subject/${alert.subjectId}/student/${alert.studentId}`
      );
    }
  };

  const getRiskLevelBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "pc-risk-normal" },
      CAUTION: { text: "주의", class: "pc-risk-caution" },
      RISK: { text: "위험", class: "pc-risk-warning" },
      CRITICAL: { text: "심각", class: "pc-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return <span className={`pc-risk-badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return (
      <div className="pc-page-container">
        <div className="pc-loading">
          <div className="pc-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-page-container">
      <div className="pc-header">
        <h1 className="pc-title">상담 관리</h1>
        <p className="pc-subtitle">
          담당 과목의 학생들을 관리하고 상담을 진행할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="pc-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* 중도 이탈 위험 알림 */}
      {riskAlerts.length > 0 && (
        <div className="pc-alerts-section">
          <div className="pc-section-header">
            <h2>
              <span className="material-symbols-outlined">warning</span>
              중도 이탈 위험 학생
            </h2>
            <span className="pc-alert-count">{riskAlerts.length}명</span>
          </div>
          <div className="pc-alerts-list">
            {riskAlerts.map((alert) => (
              <div
                key={alert.id}
                className="pc-alert-card"
                onClick={() => handleAlertClick(alert)}
              >
                <div className="pc-alert-header">
                  <div className="pc-alert-student">
                    <span className="material-symbols-outlined">
                      person_alert
                    </span>
                    <span>{alert.student?.name || "학생"}</span>
                  </div>
                  {getRiskLevelBadge(alert.riskLevel)}
                </div>
                <div className="pc-alert-body">
                  <div className="pc-alert-subject">
                    {alert.subject?.name || "과목명"}
                  </div>
                  <div className="pc-alert-reason">{alert.riskReason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 담당 과목 리스트 */}
      <div className="pc-subjects-section">
        <div className="pc-section-header">
          <h2>
            <span className="material-symbols-outlined">school</span>
            담당 과목
          </h2>
          <span className="pc-subject-count">{subjects.length}개</span>
        </div>

        {subjects.length === 0 ? (
          <div className="pc-empty-state">
            <span className="material-symbols-outlined">folder_off</span>
            <p>담당 과목이 없습니다.</p>
          </div>
        ) : (
          <div className="pc-subjects-grid">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="pc-subject-card"
                onClick={() => handleSubjectClick(subject.id)}
              >
                <div className="pc-subject-header">
                  <h3>{subject.name}</h3>
                  <span className="pc-subject-year">
                    {subject.subYear}학년 {subject.semester}학기
                  </span>
                </div>
                <div className="pc-subject-body">
                  <div className="pc-subject-info">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>
                      {subject.subDay} {subject.startTime}교시 -{" "}
                      {subject.endTime}
                      교시
                    </span>
                  </div>
                  <div className="pc-subject-info">
                    <span className="material-symbols-outlined">
                      location_on
                    </span>
                    <span>{subject.room?.name || "강의실 미정"}</span>
                  </div>
                  <div className="pc-subject-info">
                    <span className="material-symbols-outlined">group</span>
                    <span>
                      수강 인원: {subject.numOfStudent || 0} /{" "}
                      {subject.capacity}
                    </span>
                  </div>
                </div>
                <div className="pc-subject-footer">
                  <button className="pc-view-students-btn">
                    학생 명단 보기
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
