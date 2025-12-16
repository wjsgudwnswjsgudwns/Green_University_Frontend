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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 상태
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    field: "overallRisk",
    direction: "desc",
  });

  // 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (user && user.id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // 담당 지도학생들의 AI 분석 결과 조회
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

        setRiskStudents(riskStudentsData);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 필터링 및 정렬
  const getFilteredAndSortedStudents = () => {
    let filtered = [...riskStudents];

    // 위험도 필터
    if (selectedRiskLevel !== "ALL") {
      filtered = filtered.filter(
        (s) => s.analysis.overallRisk === selectedRiskLevel
      );
    }

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          String(s.studentId).toLowerCase().includes(term) ||
          s.studentName.toLowerCase().includes(term) ||
          (s.deptName && s.deptName.toLowerCase().includes(term)) ||
          s.subjectName.toLowerCase().includes(term)
      );
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.field) {
        case "studentId":
          aValue = a.studentId;
          bValue = b.studentId;
          break;
        case "studentName":
          aValue = a.studentName;
          bValue = b.studentName;
          break;
        case "subjectName":
          aValue = a.subjectName;
          bValue = b.subjectName;
          break;
        case "overallRisk":
          const riskValues = { CRITICAL: 4, RISK: 3, CAUTION: 2, NORMAL: 1 };
          aValue = riskValues[a.analysis.overallRisk] || 0;
          bValue = riskValues[b.analysis.overallRisk] || 0;
          break;
        case "attendance":
        case "homework":
        case "midterm":
        case "final":
        case "tuition":
        case "counseling":
          const statusValues = { CRITICAL: 4, RISK: 3, CAUTION: 2, NORMAL: 1 };
          const aStatus = a.analysis[`${sortConfig.field}Status`];
          const bStatus = b.analysis[`${sortConfig.field}Status`];
          aValue = statusValues[aStatus] || 0;
          bValue = statusValues[bStatus] || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
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
    const critical = riskStudents.filter(
      (s) => s.analysis.overallRisk === "CRITICAL"
    ).length;
    const risk = riskStudents.filter(
      (s) => s.analysis.overallRisk === "RISK"
    ).length;
    return { critical, risk, total: critical + risk };
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

  const filteredStudents = getFilteredAndSortedStudents();
  const summary = getRiskSummary();

  return (
    <div className="pc-page-container">
      <div className="pc-header">
        <h1 className="pc-title">담당 지도학생 중도 이탈 위험 관리</h1>
        <p className="pc-subtitle">
          내가 지도하는 학생 중 종합 위험도가 높은 학생들을 집중적으로
          관리합니다.
        </p>
      </div>

      {error && (
        <div className="pc-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* 요약 통계 */}
      <div className="pc-risk-summary-cards">
        <div className="pc-risk-summary-card pc-risk-card-critical">
          <div className="pc-risk-summary-content">
            <div className="pc-risk-summary-label">심각</div>
            <div className="pc-risk-summary-value">{summary.critical}명</div>
          </div>
        </div>
        <div className="pc-risk-summary-card pc-risk-card-warning">
          <div className="pc-risk-summary-content">
            <div className="pc-risk-summary-label">위험</div>
            <div className="pc-risk-summary-value">{summary.risk}명</div>
          </div>
        </div>
        <div className="pc-risk-summary-card pc-risk-card-total">
          <div className="pc-risk-summary-content">
            <div className="pc-risk-summary-label">전체 위험 학생</div>
            <div className="pc-risk-summary-value">{summary.total}명</div>
          </div>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="pc-risk-filters-section">
        <div className="pc-risk-filter-group">
          <label>위험도</label>
          <select
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pc-risk-search-input"
          />
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="pc-risk-students-section">
        <div className="pc-section-header">
          <h2>위험 학생 목록</h2>
          <span className="pc-alert-count">{filteredStudents.length}명</span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="pc-empty-state">
            <p>
              {riskStudents.length === 0
                ? "현재 담당 지도학생 중 위험 학생이 없습니다."
                : "검색 조건에 맞는 학생이 없습니다."}
            </p>
          </div>
        ) : (
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
                {filteredStudents.map((student, index) => (
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
                    <td>{getStatusBadge(student.analysis.attendanceStatus)}</td>
                    <td>{getStatusBadge(student.analysis.homeworkStatus)}</td>
                    <td>{getStatusBadge(student.analysis.midtermStatus)}</td>
                    <td>{getStatusBadge(student.analysis.finalStatus)}</td>
                    <td>{getStatusBadge(student.analysis.tuitionStatus)}</td>
                    <td>{getStatusBadge(student.analysis.counselingStatus)}</td>
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
