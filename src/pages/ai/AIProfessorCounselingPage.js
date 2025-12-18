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

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    fetchStudentsData();
  }, [user, selectedRiskLevel, currentPage]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      // 통계용 전체 데이터
      await fetchAllStudents();

      // 페이징된 데이터
      await fetchStudentsData();
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStudents = async () => {
    try {
      const response = await api.get(
        `/api/ai-analysis/advisor/${user.id}/students`
      );

      if (response.data.code === 1) {
        const allResults = response.data.data || [];

        // 학생별로 그룹핑 (통계 계산용)
        const studentMap = new Map();

        allResults.forEach((result) => {
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

          const riskPriority = getRiskPriority(result.overallRisk);
          if (riskPriority > studentData.riskPriority) {
            studentData.highestRisk = result.overallRisk;
            studentData.riskPriority = riskPriority;
          }
        });

        const groupedStudents = Array.from(studentMap.values());
        setAllStudents(groupedStudents);
      }
    } catch (err) {
      console.error("전체 학생 조회 실패:", err);
    }
  };

  const fetchStudentsData = async () => {
    if (!user?.id) return;

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        size: pageSize.toString(),
      });

      // riskLevel 필터 추가
      if (selectedRiskLevel) {
        params.append("riskLevel", selectedRiskLevel);
      }

      const response = await api.get(
        `/api/ai-analysis/advisor/${
          user.id
        }/students/paged?${params.toString()}`
      );

      console.log("📥 paged raw response", response.data.data);

      const pageData = response.data.data;

      console.log("📥 pageData.content", pageData.content);

      const studentsData = pageData.content || [];

      console.log("📥 studentsData", studentsData);

      setFilteredStudents(studentsData); //
      setTotalPages(pageData.totalPages);
      setTotalElements(pageData.totalElements);
    } catch (e) {
      console.error(e);
    }
  };

  // const groupStudentsByStudent = (analysisResults) => {
  //   const studentMap = new Map();

  //   analysisResults.forEach((result) => {
  //     const studentId = result.studentId;

  //     if (!studentMap.has(studentId)) {
  //       studentMap.set(studentId, {
  //         studentId: studentId,
  //         student: result.student,
  //         subjects: [],
  //         highestRisk: "NORMAL",
  //         riskPriority: 0,
  //       });
  //     }

  //     const studentData = studentMap.get(studentId);
  //     studentData.subjects.push(result);

  //     const riskPriority = getRiskPriority(result.overallRisk);
  //     if (riskPriority > studentData.riskPriority) {
  //       studentData.highestRisk = result.overallRisk;
  //       studentData.riskPriority = riskPriority;
  //     }
  //   });

  //   return Array.from(studentMap.values());
  // };

  const getRiskPriority = (risk) => {
    const priorities = {
      CRITICAL: 4,
      RISK: 3,
      CAUTION: 2,
      NORMAL: 1,
    };
    return priorities[risk] || 0;
  };

  const handleReset = () => {
    setSelectedRiskLevel("");
    setCurrentPage(0);
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

  const getTotalRiskCounts = () => {
    return {
      total: allStudents.length,
      normal: allStudents.filter((s) => s.highestRisk === "NORMAL").length,
      caution: allStudents.filter((s) => s.highestRisk === "CAUTION").length,
      risk: allStudents.filter((s) => s.highestRisk === "RISK").length,
      critical: allStudents.filter((s) => s.highestRisk === "CRITICAL").length,
    };
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchInitialData();
  }, [user]);

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
        <h1 className="sas-title">전체 학생 관리</h1>
      </div>

      {error && <div className="sas-error-message">{error}</div>}

      <div className="apc-statistics-container">
        <div className="apc-donut-section">
          <h3>위험도 분포</h3>
          <div className="apc-donut-chart">
            <svg viewBox="0 0 200 200" className="apc-donut-svg">
              <DonutChart
                normal={riskCounts.normal}
                caution={riskCounts.caution}
                risk={riskCounts.risk}
                critical={riskCounts.critical}
                total={riskCounts.total}
              />
            </svg>
            <div className="apc-donut-center">
              <div className="apc-donut-total">{riskCounts.total}</div>
              <div className="apc-donut-label">전체</div>
            </div>
          </div>
          <div className="apc-donut-legend">
            <div className="apc-legend-item">
              <span className="apc-legend-dot apc-legend-normal"></span>
              <span>정상</span>
            </div>
            <div className="apc-legend-item">
              <span className="apc-legend-dot apc-legend-caution"></span>
              <span>주의</span>
            </div>
            <div className="apc-legend-item">
              <span className="apc-legend-dot apc-legend-risk"></span>
              <span>위험</span>
            </div>
            <div className="apc-legend-item">
              <span className="apc-legend-dot apc-legend-critical"></span>
              <span>심각</span>
            </div>
          </div>
        </div>

        <div className="apc-bars-section">
          <h3>위험도별 학생 수</h3>
          <div className="apc-bar-chart">
            <BarItem
              label="정상"
              count={riskCounts.normal}
              total={riskCounts.total}
              color="normal"
            />
            <BarItem
              label="주의"
              count={riskCounts.caution}
              total={riskCounts.total}
              color="caution"
            />
            <BarItem
              label="위험"
              count={riskCounts.risk}
              total={riskCounts.total}
              color="risk"
            />
            <BarItem
              label="심각"
              count={riskCounts.critical}
              total={riskCounts.total}
              color="critical"
            />
          </div>
        </div>
      </div>

      <div className="sas-filters">
        <div className="sas-filter-group">
          <label htmlFor="riskLevel">위험도</label>
          <select
            id="riskLevel"
            value={selectedRiskLevel}
            onChange={(e) => {
              setSelectedRiskLevel(e.target.value);
              setCurrentPage(0);
            }}
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
          총 <strong>{totalElements}</strong>명의 학생
          {totalPages > 1 && (
            <span style={{ marginLeft: "10px", color: "#666" }}>
              (페이지 {currentPage + 1} / {totalPages})
            </span>
          )}
        </span>
      </div>

      <div className="sas-students-section">
        {filteredStudents.length === 0 ? (
          <div className="sas-empty-state">
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <>
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
                          {student.subjects?.length || 0}개
                        </td>
                        <td
                          onClick={() => toggleStudentExpand(student.studentId)}
                        >
                          {getRiskBadge(student.highestRisk)}
                        </td>
                      </tr>

                      {expandedStudentId === student.studentId && (
                        <tr className="expanded-details">
                          <td colSpan="6">
                            <div className="subject-details-container">
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
                                  {student.subjects?.map((subject, index) => (
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
                                          {getRiskBadge(
                                            subject.attendanceStatus
                                          )}
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
                                          {getRiskBadge(
                                            subject.counselingStatus
                                          )}
                                        </td>
                                        <td>
                                          {getRiskBadge(subject.overallRisk)}
                                        </td>
                                      </tr>
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

            {totalPages > 1 && (
              <div className="sas-pagination">
                <button
                  className="sas-page-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  이전
                </button>

                <div className="sas-page-numbers">
                  {[...Array(totalPages)].map((_, index) => (
                    <button
                      key={index}
                      className={`sas-page-num ${
                        currentPage === index ? "active" : ""
                      }`}
                      onClick={() => handlePageChange(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <button
                  className="sas-page-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DonutChart({ normal, caution, risk, critical, total }) {
  if (total === 0) {
    return (
      <circle
        cx="100"
        cy="100"
        r="70"
        fill="none"
        stroke="#e0e6ed"
        strokeWidth="40"
      />
    );
  }

  const normalPercent = (normal / total) * 100;
  const cautionPercent = (caution / total) * 100;
  const riskPercent = (risk / total) * 100;
  const criticalPercent = (critical / total) * 100;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  const segments = [
    { percent: normalPercent, color: "#28a745" },
    { percent: cautionPercent, color: "#ffc107" },
    { percent: riskPercent, color: "#fd7e14" },
    { percent: criticalPercent, color: "#dc3545" },
  ];

  return (
    <g transform="rotate(-90 100 100)">
      {segments.map((segment, index) => {
        if (segment.percent === 0) return null;

        const dashArray = (segment.percent / 100) * circumference;
        const dashOffset = -offset;

        offset += dashArray;

        return (
          <circle
            key={index}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="40"
            strokeDasharray={`${dashArray} ${circumference}`}
            strokeDashoffset={dashOffset}
          />
        );
      })}
    </g>
  );
}

function BarItem({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="apc-bar-item">
      <div className="apc-bar-label">
        <span className="apc-bar-text">{label}</span>
        <span className="apc-bar-value">
          {count}명 ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="apc-bar-track">
        <div
          className={`apc-bar-fill apc-bar-fill-${color}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
