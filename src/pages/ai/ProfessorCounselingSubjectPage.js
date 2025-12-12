import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/professorCounselingSubject.css";

export default function ProfessorCounselingSubjectPage() {
  const { user } = useAuth();
  const { subjectId } = useParams();
  const navigate = useNavigate();

  const [subject, setSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [riskStudents, setRiskStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all, risk

  useEffect(() => {
    if (subjectId) {
      fetchData();
    }
  }, [subjectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // 과목 정보 조회
      const subjectResponse = await api.get(`/api/subject/${subjectId}`);

      // 과목 수강 학생 리스트 조회
      const studentsResponse = await api.get(
        `/api/stu-sub/subject/${subjectId}/students`
      );

      // 위험 학생 분석 결과 조회
      const riskResponse = await api.get(
        `/api/ai-analysis/subject/${subjectId}/risk-students`
      );

      if (subjectResponse.data) {
        setSubject(subjectResponse.data);
      }

      if (studentsResponse.data) {
        setStudents(studentsResponse.data || []);
      }

      if (riskResponse.data.code === 1) {
        setRiskStudents(riskResponse.data.data || []);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (studentId) => {
    navigate(`/professor/counseling/subject/${subjectId}/student/${studentId}`);
  };

  const handleBack = () => {
    navigate("/professor/counseling");
  };

  const getRiskLevel = (studentId) => {
    const riskStudent = riskStudents.find((rs) => rs.studentId === studentId);
    return riskStudent?.overallRisk || "NORMAL";
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "pcs-risk-normal" },
      CAUTION: { text: "주의", class: "pcs-risk-caution" },
      RISK: { text: "위험", class: "pcs-risk-warning" },
      CRITICAL: { text: "심각", class: "pcs-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return (
      <span className={`pcs-risk-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  if (loading) {
    return (
      <div className="pcs-page-container">
        <div className="pcs-loading">
          <div className="pcs-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const displayStudents =
    activeTab === "all"
      ? students
      : students.filter((student) => {
          const riskLevel = getRiskLevel(student.id);
          return riskLevel === "RISK" || riskLevel === "CRITICAL";
        });

  return (
    <div className="pcs-page-container">
      {/* Header with Back Button */}
      <div className="pcs-header">
        <button className="pcs-back-btn" onClick={handleBack}>
          <span className="material-symbols-outlined">arrow_back</span>
          뒤로 가기
        </button>
        <div className="pcs-header-content">
          <h1 className="pcs-title">{subject?.name || "과목명"}</h1>
          <div className="pcs-subject-info">
            <span>
              {subject?.subYear}학년 {subject?.semester}학기
            </span>
            <span className="pcs-divider">|</span>
            <span>
              {subject?.subDay} {subject?.startTime}교시 - {subject?.endTime}
              교시
            </span>
            <span className="pcs-divider">|</span>
            <span>
              수강 인원: {subject?.numOfStudent || 0} / {subject?.capacity}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="pcs-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Risk Summary */}
      {riskStudents.length > 0 && (
        <div className="pcs-risk-summary">
          <div className="pcs-summary-card pcs-summary-critical">
            <span className="material-symbols-outlined">crisis_alert</span>
            <div>
              <span className="pcs-summary-label">심각</span>
              <span className="pcs-summary-count">
                {
                  riskStudents.filter((rs) => rs.overallRisk === "CRITICAL")
                    .length
                }
                명
              </span>
            </div>
          </div>
          <div className="pcs-summary-card pcs-summary-risk">
            <span className="material-symbols-outlined">warning</span>
            <div>
              <span className="pcs-summary-label">위험</span>
              <span className="pcs-summary-count">
                {riskStudents.filter((rs) => rs.overallRisk === "RISK").length}
                명
              </span>
            </div>
          </div>
          <div className="pcs-summary-card pcs-summary-caution">
            <span className="material-symbols-outlined">error</span>
            <div>
              <span className="pcs-summary-label">주의</span>
              <span className="pcs-summary-count">
                {
                  riskStudents.filter((rs) => rs.overallRisk === "CAUTION")
                    .length
                }
                명
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="pcs-tabs">
        <button
          className={`pcs-tab ${activeTab === "all" ? "pcs-tab-active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          전체 학생
          <span className="pcs-tab-count">{students.length}</span>
        </button>
        <button
          className={`pcs-tab ${activeTab === "risk" ? "pcs-tab-active" : ""}`}
          onClick={() => setActiveTab("risk")}
        >
          위험 학생
          <span className="pcs-tab-count">
            {
              students.filter((student) => {
                const riskLevel = getRiskLevel(student.id);
                return riskLevel === "RISK" || riskLevel === "CRITICAL";
              }).length
            }
          </span>
        </button>
      </div>

      {/* Students List */}
      <div className="pcs-students-section">
        {displayStudents.length === 0 ? (
          <div className="pcs-empty-state">
            <span className="material-symbols-outlined">
              {activeTab === "all" ? "group_off" : "check_circle"}
            </span>
            <p>
              {activeTab === "all"
                ? "수강 학생이 없습니다."
                : "위험 학생이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="pcs-students-grid">
            {displayStudents.map((student) => {
              const riskLevel = getRiskLevel(student.id);
              return (
                <div
                  key={student.id}
                  className={`pcs-student-card ${
                    riskLevel === "CRITICAL" || riskLevel === "RISK"
                      ? "pcs-student-card-risk"
                      : ""
                  }`}
                  onClick={() => handleStudentClick(student.id)}
                >
                  <div className="pcs-student-header">
                    <div className="pcs-student-info-basic">
                      <span className="material-symbols-outlined">person</span>
                      <div>
                        <h3>{student.name}</h3>
                        <span className="pcs-student-id">{student.id}</span>
                      </div>
                    </div>
                    {getRiskBadge(riskLevel)}
                  </div>

                  <div className="pcs-student-body">
                    <div className="pcs-student-detail">
                      <span className="material-symbols-outlined">school</span>
                      <span>
                        {student.department?.name || "학과 정보 없음"} -{" "}
                        {student.grade}학년
                      </span>
                    </div>
                    <div className="pcs-student-detail">
                      <span className="material-symbols-outlined">mail</span>
                      <span>{student.email}</span>
                    </div>
                  </div>

                  <div className="pcs-student-footer">
                    <button className="pcs-view-detail-btn">
                      상세 분석 보기
                      <span className="material-symbols-outlined">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
