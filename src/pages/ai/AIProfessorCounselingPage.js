import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/staffAllStudents.css";
import "../../styles/AIProfessorCounseling.css";

export default function AIProfessorCounselingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  const [selectedRiskLevel, setSelectedRiskLevel] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [selectedRiskLevel, allStudents]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      // 교수의 담당 학생 조회
      const response = await api.get(
        `/api/ai-analysis/advisor/${user.id}/students`
      );

      if (response.data.code === 1) {
        // 학생별로 그룹화
        const groupedStudents = groupStudentsByStudent(
          response.data.data || []
        );
        setAllStudents(groupedStudents);
        setFilteredStudents(groupedStudents);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 학생별로 그룹화하고 최고 위험도 계산
  const groupStudentsByStudent = (analysisResults) => {
    const studentMap = new Map();

    analysisResults.forEach((result) => {
      const studentId = result.studentId;

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId: studentId,
          student: result.student,
          subjects: [],
          highestRisk: "NORMAL",
          riskPriority: 0,
        });
      }

      const studentData = studentMap.get(studentId);
      studentData.subjects.push(result);

      // 최고 위험도 업데이트
      const riskPriority = getRiskPriority(result.overallRisk);
      if (riskPriority > studentData.riskPriority) {
        studentData.highestRisk = result.overallRisk;
        studentData.riskPriority = riskPriority;
      }
    });

    return Array.from(studentMap.values());
  };

  const getRiskPriority = (risk) => {
    const priorities = {
      CRITICAL: 4,
      RISK: 3,
      CAUTION: 2,
      NORMAL: 1,
    };
    return priorities[risk] || 0;
  };

  const filterStudents = () => {
    let filtered = [...allStudents];

    if (selectedRiskLevel) {
      filtered = filtered.filter(
        (student) => student.highestRisk === selectedRiskLevel
      );
    }

    setFilteredStudents(filtered);
  };

  const handleReset = () => {
    setSelectedRiskLevel("");
  };

  const toggleStudentExpand = (studentId) => {
    setExpandedStudentId(expandedStudentId === studentId ? null : studentId);
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "sas-risk-normal" },
      CAUTION: { text: "주의", class: "sas-risk-caution" },
      RISK: { text: "위험", class: "sas-risk-warning" },
      CRITICAL: { text: "심각", class: "sas-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return (
      <span className={`sas-risk-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  const getStatusLabel = (status) => {
    const labels = {
      NORMAL: "정상",
      CAUTION: "주의",
      RISK: "위험",
      CRITICAL: "심각",
    };
    return labels[status] || "정상";
  };

  // 전체 분석 결과에서 위험도별 카운트
  const getTotalRiskCounts = () => {
    return {
      total: allStudents.length,
      normal: allStudents.filter((s) => s.highestRisk === "NORMAL").length,
      caution: allStudents.filter((s) => s.highestRisk === "CAUTION").length,
      risk: allStudents.filter((s) => s.highestRisk === "RISK").length,
      critical: allStudents.filter((s) => s.highestRisk === "CRITICAL").length,
    };
  };

  if (loading) {
    return (
      <div className="sas-page-container">
        <div className="sas-loading">
          <div className="sas-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const riskCounts = getTotalRiskCounts();

  return (
    <div className="sas-page-container">
      <div className="sas-header">
        <h1 className="sas-title">담당 학생 관리</h1>
        <p className="sas-subtitle">
          담당 학생들의 분석 결과를 확인하고 관리할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="sas-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      <div className="sas-statistics">
        <div className="sas-stat-card sas-stat-total">
          <div className="sas-stat-content">
            <span className="sas-stat-label">담당 학생</span>
            <span className="sas-stat-value">{riskCounts.total}명</span>
          </div>
        </div>

        <div className="sas-stat-card sas-stat-normal">
          <div className="sas-stat-content">
            <span className="sas-stat-label">정상</span>
            <span className="sas-stat-value">{riskCounts.normal}명</span>
          </div>
        </div>

        <div className="sas-stat-card sas-stat-caution">
          <div className="sas-stat-content">
            <span className="sas-stat-label">주의</span>
            <span className="sas-stat-value">{riskCounts.caution}명</span>
          </div>
        </div>

        <div className="sas-stat-card sas-stat-risk">
          <div className="sas-stat-content">
            <span className="sas-stat-label">위험</span>
            <span className="sas-stat-value">{riskCounts.risk}명</span>
          </div>
        </div>

        <div className="sas-stat-card sas-stat-critical">
          <div className="sas-stat-content">
            <span className="sas-stat-label">심각</span>
            <span className="sas-stat-value">{riskCounts.critical}명</span>
          </div>
        </div>
      </div>

      <div className="sas-filters">
        <div className="sas-filter-group">
          <label htmlFor="riskLevel">위험도</label>
          <select
            id="riskLevel"
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
          >
            <option value="">전체</option>
            <option value="NORMAL">정상</option>
            <option value="CAUTION">주의</option>
            <option value="RISK">위험</option>
            <option value="CRITICAL">심각</option>
          </select>
        </div>

        <button className="sas-reset-btn" onClick={handleReset}>
          초기화
        </button>
      </div>

      <div className="sas-results-info">
        <span className="sas-results-count">
          총 <strong>{filteredStudents.length}</strong>명의 학생
        </span>
      </div>

      <div className="sas-students-section">
        {filteredStudents.length === 0 ? (
          <div className="sas-empty-state">
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="sas-table-wrapper">
            <table className="sas-students-table">
              <thead>
                <tr>
                  <th>학번</th>
                  <th>이름</th>
                  <th>학과</th>
                  <th>학년</th>
                  <th>수강 과목 수</th>
                  <th>최고 위험도</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <React.Fragment key={student.studentId}>
                    <tr
                      className={`apc-student-row ${
                        expandedStudentId === student.studentId
                          ? "apc-expanded"
                          : ""
                      }`}
                    >
                      <td
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        {student.studentId}
                      </td>
                      <td
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        {student.student?.name || "학생"}
                      </td>
                      <td
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        {student.student?.department?.name || "학과"}
                      </td>
                      <td
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        {student.student?.grade}학년
                      </td>
                      <td
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        {student.subjects.length}개
                      </td>
                      <td
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        {getRiskBadge(student.highestRisk)}
                      </td>
                    </tr>

                    {/* 펼쳐진 상세 정보 */}
                    {expandedStudentId === student.studentId && (
                      <tr className="expanded-details">
                        <td colSpan="7">
                          <div className="subject-details-container">
                            <h3>수강 과목 상세 분석</h3>
                            <table className="subject-details-table">
                              <thead>
                                <tr>
                                  <th>과목명</th>
                                  <th>학기</th>
                                  <th>출결</th>
                                  <th>과제</th>
                                  <th>중간</th>
                                  <th>기말</th>
                                  <th>등록금</th>
                                  <th>상담</th>
                                  <th>종합</th>
                                </tr>
                              </thead>
                              <tbody>
                                {student.subjects.map((subject, index) => (
                                  <React.Fragment key={index}>
                                    <tr className="subject-row">
                                      <td className="subject-name">
                                        {subject.subject?.name || "과목명"}
                                      </td>
                                      <td>
                                        {subject.analysisYear}년{" "}
                                        {subject.semester}학기
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.attendanceStatus)}
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.homeworkStatus)}
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.midtermStatus)}
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.finalStatus)}
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.tuitionStatus)}
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.counselingStatus)}
                                      </td>
                                      <td>
                                        {getRiskBadge(subject.overallRisk)}
                                      </td>
                                    </tr>
                                    {/* AI 분석 상세 내용 (RISK, CRITICAL인 경우만) */}
                                    {subject.analysisDetail && (
                                      <tr className="ai-detail-row">
                                        <td colSpan="9">
                                          <div className="ai-analysis-detail">
                                            <h5>AI 분석 상세</h5>
                                            <p>{subject.analysisDetail}</p>
                                            {subject.analyzedAt && (
                                              <div className="analyzed-date">
                                                분석 일시:{" "}
                                                {new Date(
                                                  subject.analyzedAt
                                                ).toLocaleString("ko-KR")}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
