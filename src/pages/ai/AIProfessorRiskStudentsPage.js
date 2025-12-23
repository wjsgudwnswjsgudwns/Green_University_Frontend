import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import CounselingFormModal from "./CounselingFormModal";
import "../../styles/professorCounseling.css";
import "../../styles/riskStudents.css";

export default function AIProfessorRiskStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [riskStudents, setRiskStudents] = useState([]);
  const [allRiskStudents, setAllRiskStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 상태
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    field: "overallRisk",
    direction: "desc",
  });

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (user && user.id) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    fetchRiskStudentsData();
  }, [selectedRiskLevel, searchTerm, currentPage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // 통계용 전체 위험 학생 데이터
      await fetchAllRiskStudents();

      // 페이징된 위험 학생 데이터
      await fetchRiskStudentsData();
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRiskStudents = async () => {
    try {
      const response = await api.get(
        `/api/ai-analysis/advisor/${user.id}/students`
      );

      if (response.data?.code === 1) {
        const analysisResults = response.data.data || [];

        // RISK 또는 CRITICAL인 학생만 필터링
        const riskStudentsData = analysisResults
          .filter(
            (result) =>
              result.overallRisk === "RISK" || result.overallRisk === "CRITICAL"
          )
          .map((result) => ({
            studentId: result.studentId,
            studentName: result.student?.name || "-",
            deptName: result.student?.department?.name || "-",
            subjectId: result.subjectId,
            subjectName: result.subject?.name || "-",
            subYear: result.subject?.subYear || "-",
            semester: result.subject?.semester || "-",
            analysis: result,
          }));

        setAllRiskStudents(riskStudentsData);
      }
    } catch (err) {
      console.error("전체 위험 학생 조회 실패:", err);
    }
  };

  const fetchRiskStudentsData = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        size: pageSize.toString(),
      });

      // RISK 또는 CRITICAL 중에서만 필터링
      if (selectedRiskLevel !== "ALL") {
        params.append("riskLevel", selectedRiskLevel);
      }

      const response = await api.get(
        `/api/ai-analysis/advisor/${
          user.id
        }/students/paged?${params.toString()}`
      );

      if (response.data.code === 1) {
        const pageData = response.data.data;

        // 페이징된 데이터에서 RISK, CRITICAL만 추출하여 평탄화
        const riskStudentsData = [];

        for (const student of pageData.content || []) {
          // RISK나 CRITICAL인 과목만 필터링
          const riskSubjects =
            student.subjects?.filter(
              (subject) =>
                subject.overallRisk === "RISK" ||
                subject.overallRisk === "CRITICAL"
            ) || [];

          // 각 위험 과목을 개별 행으로 변환
          for (const subject of riskSubjects) {
            riskStudentsData.push({
              studentId: student.studentId,
              studentName: student.student?.name || "-",
              deptName: student.student?.department?.name || "-",
              subjectId: subject.subjectId,
              subjectName: subject.subject?.name || "-",
              subYear: subject.analysisYear || "-",
              semester: subject.semester || "-",
              analysis: subject,
            });
          }
        }

        // 검색어 필터링
        let filtered = riskStudentsData;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = riskStudentsData.filter(
            (s) =>
              String(s.studentId).toLowerCase().includes(term) ||
              s.studentName.toLowerCase().includes(term) ||
              (s.deptName && s.deptName.toLowerCase().includes(term)) ||
              s.subjectName.toLowerCase().includes(term)
          );
        }

        setRiskStudents(filtered);
        setTotalPages(pageData.totalPages || 0);
        setTotalElements(filtered.length);
      }
    } catch (err) {
      console.error("위험 학생 데이터 조회 실패:", err);
      setError("위험 학생 데이터를 불러오는데 실패했습니다.");
    }
  };

  const handleSort = (field) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (field) => {
    if (sortConfig.field !== field) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const handleCounselingClick = (student) => {
    setSelectedStudent({
      studentId: student.studentId,
      studentName: student.studentName,
      subjectId: student.subjectId,
      subjectName: student.subjectName,
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleModalSubmit = async () => {
    await fetchData();
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "pc-risk-normal" },
      CAUTION: { text: "주의", class: "pc-risk-caution" },
      RISK: { text: "위험", class: "pc-risk-warning" },
      CRITICAL: { text: "심각", class: "pc-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return <span className={`pc-risk-badge ${badge.class}`}>{badge.text}</span>;
  };

  const getStatusBadge = (status) => {
    if (!status)
      return <span className="pc-status-badge pc-status-normal">-</span>;

    const badges = {
      NORMAL: { text: "정상", class: "pc-status-normal" },
      CAUTION: { text: "주의", class: "pc-status-caution" },
      RISK: { text: "위험", class: "pc-status-risk" },
      CRITICAL: { text: "심각", class: "pc-status-critical" },
    };
    const badge = badges[status] || badges.NORMAL;
    return (
      <span className={`pc-status-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  const getRiskSummary = () => {
    const critical = allRiskStudents.filter(
      (s) => s.analysis.overallRisk === "CRITICAL"
    ).length;
    const risk = allRiskStudents.filter(
      (s) => s.analysis.overallRisk === "RISK"
    ).length;
    return { critical, risk, total: critical + risk };
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleReset = () => {
    setSelectedRiskLevel("ALL");
    setSearchTerm("");
    setCurrentPage(0);
  };

  if (loading) {
    return (
      <div className="pc-page-container">
        <div className="pc-loading">
          <div className="pc-loading-spinner"></div>
          <p>위험 학생 데이터를 분석하는 중...</p>
        </div>
      </div>
    );
  }

  const summary = getRiskSummary();

  return (
    <div className="pc-page-container">
      <div className="pc-header">
        <h1 className="pc-title">위험 학생 관리</h1>
      </div>

      {error && <div className="pc-error-message">{error}</div>}

      <div className="pc-risk-statistics-container">
        <div className="pc-risk-donut-section">
          <h3>위험도 분포</h3>
          <div className="pc-risk-donut-chart">
            <svg viewBox="0 0 200 200" className="pc-risk-donut-svg">
              <RiskDonutChart
                critical={summary.critical}
                risk={summary.risk}
                total={summary.total}
              />
            </svg>
            <div className="pc-risk-donut-center">
              <div className="pc-risk-donut-total">{summary.total}</div>
              <div className="pc-risk-donut-label">전체</div>
            </div>
          </div>
          <div className="pc-risk-donut-legend">
            <div className="pc-risk-legend-item">
              <span className="pc-risk-legend-dot pc-risk-legend-critical"></span>
              <span>심각</span>
            </div>
            <div className="pc-risk-legend-item">
              <span className="pc-risk-legend-dot pc-risk-legend-risk"></span>
              <span>위험</span>
            </div>
          </div>
        </div>

        <div className="pc-risk-bars-section">
          <h3>위험 학생 현황</h3>
          <div className="pc-risk-bar-chart">
            <RiskBarItem
              label="심각"
              count={summary.critical}
              total={summary.total}
              color="critical"
            />
            <RiskBarItem
              label="위험"
              count={summary.risk}
              total={summary.total}
              color="risk"
            />
            <div className="pc-risk-bar-total">
              <span className="pc-risk-bar-total-label">전체 위험 학생</span>
              <span className="pc-risk-bar-total-value">{summary.total}명</span>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="pc-risk-filters-section">
        <div className="pc-risk-filter-group">
          <label>위험도</label>
          <select
            value={selectedRiskLevel}
            onChange={(e) => {
              setSelectedRiskLevel(e.target.value);
              setCurrentPage(0);
            }}
            className="pc-risk-filter-select"
          >
            <option value="ALL">전체</option>
            <option value="CRITICAL">심각</option>
            <option value="RISK">위험</option>
          </select>
        </div>

        <div className="pc-risk-filter-group pc-risk-search-group">
          <label>검색</label>
          <input
            type="text"
            placeholder="학번, 이름, 학과, 과목명 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(0);
            }}
            className="pc-risk-search-input"
          />
        </div>

        <button className="pc-reset-btn" onClick={handleReset}>
          초기화
        </button>
      </div>

      {/* 학생 목록 */}
      <div className="pc-risk-students-section">
        <div className="pc-section-header">
          <h2>위험 학생 목록</h2>
          <span className="pc-alert-count">
            {totalElements}명
            {totalPages > 1 && (
              <span
                style={{ marginLeft: "10px", fontSize: "14px", color: "#666" }}
              >
                (페이지 {currentPage + 1} / {totalPages})
              </span>
            )}
          </span>
        </div>

        {riskStudents.length === 0 ? (
          <div className="pc-empty-state">
            <p>
              {allRiskStudents.length === 0
                ? "현재 담당 지도학생 중 위험 학생이 없습니다."
                : "검색 조건에 맞는 학생이 없습니다."}
            </p>
          </div>
        ) : (
          <>
            <div className="pc-risk-table-container">
              <table className="pc-students-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort("studentId")}
                      style={{ cursor: "pointer" }}
                    >
                      학번 {getSortIcon("studentId")}
                    </th>
                    <th
                      onClick={() => handleSort("studentName")}
                      style={{ cursor: "pointer" }}
                    >
                      이름 {getSortIcon("studentName")}
                    </th>
                    <th>학과</th>
                    <th
                      onClick={() => handleSort("subjectName")}
                      style={{ cursor: "pointer" }}
                    >
                      과목명 {getSortIcon("subjectName")}
                    </th>
                    <th>학년/학기</th>
                    <th
                      onClick={() => handleSort("attendance")}
                      style={{ cursor: "pointer" }}
                    >
                      출결 {getSortIcon("attendance")}
                    </th>
                    <th
                      onClick={() => handleSort("homework")}
                      style={{ cursor: "pointer" }}
                    >
                      과제 {getSortIcon("homework")}
                    </th>
                    <th
                      onClick={() => handleSort("midterm")}
                      style={{ cursor: "pointer" }}
                    >
                      중간 {getSortIcon("midterm")}
                    </th>
                    <th
                      onClick={() => handleSort("final")}
                      style={{ cursor: "pointer" }}
                    >
                      기말 {getSortIcon("final")}
                    </th>
                    <th
                      onClick={() => handleSort("tuition")}
                      style={{ cursor: "pointer" }}
                    >
                      등록금 {getSortIcon("tuition")}
                    </th>
                    <th
                      onClick={() => handleSort("counseling")}
                      style={{ cursor: "pointer" }}
                    >
                      상담 {getSortIcon("counseling")}
                    </th>
                    <th
                      onClick={() => handleSort("overallRisk")}
                      style={{ cursor: "pointer" }}
                    >
                      종합위험도 {getSortIcon("overallRisk")}
                    </th>
                    <th>상담입력</th>
                    <th>상담이력</th>
                  </tr>
                </thead>
                <tbody>
                  {riskStudents.map((student, index) => (
                    <tr
                      key={`${student.studentId}-${student.subjectId}-${index}`}
                    >
                      <td>{student.studentId}</td>
                      <td>{student.studentName}</td>
                      <td>{student.deptName}</td>
                      <td>{student.subjectName}</td>
                      <td>
                        {student.subYear}학년 {student.semester}학기
                      </td>
                      <td>
                        {getStatusBadge(student.analysis.attendanceStatus)}
                      </td>
                      <td>{getStatusBadge(student.analysis.homeworkStatus)}</td>
                      <td>{getStatusBadge(student.analysis.midtermStatus)}</td>
                      <td>{getStatusBadge(student.analysis.finalStatus)}</td>
                      <td>{getStatusBadge(student.analysis.tuitionStatus)}</td>
                      <td>
                        {getStatusBadge(student.analysis.counselingStatus)}
                      </td>
                      <td>{getRiskBadge(student.analysis.overallRisk)}</td>
                      <td>
                        <button
                          className="pc-counseling-btn"
                          onClick={() => handleCounselingClick(student)}
                        >
                          상담입력
                        </button>
                      </td>
                      <td>
                        <button
                          className="pc-counseling-btn"
                          onClick={() =>
                            navigate(
                              `/aiprofessor/counseling/history/${student.studentId}`
                            )
                          }
                        >
                          상담이력
                        </button>
                      </td>
                    </tr>
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

      {/* Counseling Form Modal */}
      {isModalOpen && selectedStudent && (
        <CounselingFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          studentName={selectedStudent.studentName}
          subjectName={selectedStudent.subjectName}
          studentId={selectedStudent.studentId}
          subjectId={selectedStudent.subjectId}
          professorId={user.id}
        />
      )}
    </div>
  );
}

function RiskDonutChart({ critical, risk, total }) {
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

  const criticalPercent = (critical / total) * 100;
  const riskPercent = (risk / total) * 100;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  const segments = [
    { percent: criticalPercent, color: "#dc3545" },
    { percent: riskPercent, color: "#fd7e14" },
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

function RiskBarItem({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="pc-risk-bar-item">
      <div className="pc-risk-bar-label">
        <span className="pc-risk-bar-text">{label}</span>
        <span className="pc-risk-bar-value">
          {count}명 ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="pc-risk-bar-track">
        <div
          className={`pc-risk-bar-fill pc-risk-bar-fill-${color}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
