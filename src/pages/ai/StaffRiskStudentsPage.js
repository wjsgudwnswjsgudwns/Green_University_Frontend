import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/staffRiskStudents.css";

export default function StaffRiskStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allRiskStudents, setAllRiskStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [analyzing, setAnalyzing] = useState(false);

  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchRiskStudentsData();
  }, [
    selectedCollege,
    selectedDepartment,
    selectedRiskLevel,
    searchTerm,
    currentPage,
  ]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const collegesResponse = await api.get("/api/admin/colleges/all");
      const departmentsResponse = await api.get("/api/admin/departments/all");

      if (collegesResponse.data) {
        setColleges(collegesResponse.data || []);
      }

      if (departmentsResponse.data) {
        setDepartments(departmentsResponse.data || []);
      }

      // 통계용 전체 데이터 로드
      await fetchAllRiskStudents();

      // 페이징된 위험 학생 데이터 로드
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
      const allStudentsResponse = await api.get(
        "/api/ai-analysis/students/all"
      );
      if (allStudentsResponse.data.code === 1) {
        const groupedStudents = groupAndFilterRiskStudents(
          allStudentsResponse.data.data || []
        );
        setAllRiskStudents(groupedStudents);
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

      if (selectedCollege) params.append("collegeId", selectedCollege);
      if (selectedDepartment) params.append("departmentId", selectedDepartment);
      if (selectedRiskLevel) params.append("riskLevel", selectedRiskLevel);
      if (searchTerm) params.append("searchTerm", searchTerm);

      const response = await api.get(
        `/api/ai-analysis/risk-students/paged?${params.toString()}`
      );

      if (response.data.code === 1) {
        const pageData = response.data.data;
        setFilteredStudents(pageData.content || []);
        setTotalPages(pageData.totalPages || 0);
        setTotalElements(pageData.totalElements || 0);
      }
    } catch (err) {
      console.error("위험 학생 데이터 조회 실패:", err);
      setError("위험 학생 데이터를 불러오는데 실패했습니다.");
    }
  };

  const groupAndFilterRiskStudents = (analysisResults) => {
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
          criticalSubjects: [],
          riskSubjects: [],
        });
      }

      const studentData = studentMap.get(studentId);
      studentData.subjects.push(result);

      if (result.overallRisk === "CRITICAL") {
        studentData.criticalSubjects.push(result);
      } else if (result.overallRisk === "RISK") {
        studentData.riskSubjects.push(result);
      }

      const riskPriority = getRiskPriority(result.overallRisk);
      if (riskPriority > studentData.riskPriority) {
        studentData.highestRisk = result.overallRisk;
        studentData.riskPriority = riskPriority;
      }
    });

    return Array.from(studentMap.values()).filter(
      (student) =>
        student.highestRisk === "RISK" || student.highestRisk === "CRITICAL"
    );
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

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment("");
    setCurrentPage(0);
  };

  const handleReset = () => {
    setSelectedCollege("");
    setSelectedDepartment("");
    setSelectedRiskLevel("");
    setSearchTerm("");
    setCurrentPage(0);
  };

  const handleStudentClick = (student) => {
    navigate(`/staff/student/${student.studentId}`);
  };

  const handleShowComment = (student, e) => {
    e.stopPropagation();
    setSelectedStudent(student);
    setShowCommentModal(true);
  };

  const handleCloseModal = () => {
    setShowCommentModal(false);
    setSelectedStudent(null);
  };

  const getAIComment = (student) => {
    const subjectWithComment = student.subjects?.find(
      (subject) =>
        subject.analysisDetail && subject.analysisDetail.trim() !== ""
    );
    return subjectWithComment?.analysisDetail || "AI 분석 코멘트가 없습니다.";
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "srs-risk-normal" },
      CAUTION: { text: "주의", class: "srs-risk-caution" },
      RISK: { text: "위험", class: "srs-risk-warning" },
      CRITICAL: { text: "심각", class: "srs-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return (
      <span className={`srs-risk-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  const getFilteredDepartments = () => {
    if (!selectedCollege) return departments;
    return departments.filter((dept) => {
      const collegeId = dept.collegeId || dept.college?.id;
      return collegeId === parseInt(selectedCollege);
    });
  };

  const getRiskCounts = () => {
    return {
      total: allRiskStudents.length,
      critical: allRiskStudents.filter((s) => s.highestRisk === "CRITICAL")
        .length,
      risk: allRiskStudents.filter((s) => s.highestRisk === "RISK").length,
    };
  };

  const handleRunAIAnalysis = async () => {
    if (!window.confirm("전체 학생 AI 분석을 실행하시겠습니까?")) return;

    try {
      setAnalyzing(true);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentSemester = currentMonth <= 6 ? 1 : 2;

      const response = await api.post("/api/ai-analysis/analyze-all", {
        year: currentYear,
        semester: currentSemester,
      });

      if (response.data.code === 1) {
        alert(response.data.message);
        await fetchInitialData();
      }
    } catch (err) {
      console.error("AI 분석 실행 실패:", err);
      alert("AI 분석 실행 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading) {
    return (
      <div className="srs-page-container">
        <div className="srs-loading">
          <div className="srs-loading-spinner"></div>
          <p>위험 학생 데이터를 분석하는 중...</p>
        </div>
      </div>
    );
  }

  const riskCounts = getRiskCounts();

  return (
    <div className="srs-page-container">
      <div className="srs-header">
        <h1 className="srs-title">중도 이탈 위험 학생 관리</h1>
        <p className="srs-subtitle">
          전체 학생 중 중도 이탈 위험이 높은 학생들을 집중적으로 관리합니다.
        </p>

        <div style={{ marginTop: "16px" }}>
          <button
            className="srs-ai-run-btn"
            onClick={handleRunAIAnalysis}
            disabled={analyzing}
          >
            {analyzing ? "AI 분석 실행 중..." : "AI 분석 수동 실행"}
          </button>
        </div>
      </div>

      {error && (
        <div className="srs-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      <div className="srs-risk-statistics">
        <h3>위험 학생 현황</h3>
        <div className="srs-bar-chart">
          <RiskBarItem
            label="심각"
            count={riskCounts.critical}
            total={riskCounts.total}
            color="critical"
          />
          <RiskBarItem
            label="위험"
            count={riskCounts.risk}
            total={riskCounts.total}
            color="risk"
          />
          <div className="srs-bar-total">
            <span className="srs-bar-total-label">전체 위험 학생</span>
            <span className="srs-bar-total-value">{riskCounts.total}명</span>
          </div>
        </div>
      </div>

      <div className="srs-filters">
        <div className="srs-filter-group">
          <label htmlFor="college">단과대학</label>
          <select
            id="college"
            value={selectedCollege}
            onChange={handleCollegeChange}
          >
            <option value="">전체</option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </select>
        </div>

        <div className="srs-filter-group">
          <label htmlFor="department">학과</label>
          <select
            id="department"
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setCurrentPage(0);
            }}
            disabled={!selectedCollege}
          >
            <option value="">전체</option>
            {getFilteredDepartments().map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="srs-filter-group">
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
            <option value="CRITICAL">심각</option>
            <option value="RISK">위험</option>
          </select>
        </div>

        <div className="srs-filter-group srs-search-group">
          <label htmlFor="search">검색</label>
          <input
            id="search"
            type="text"
            placeholder="학번, 이름, 학과 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(0);
            }}
          />
        </div>

        <button className="srs-reset-btn" onClick={handleReset}>
          초기화
        </button>
      </div>

      <div className="srs-results-info">
        <span className="srs-results-count">
          총 <strong>{totalElements}</strong>명의 위험 학생
          {totalPages > 1 && (
            <span style={{ marginLeft: "10px", color: "#666" }}>
              (페이지 {currentPage + 1} / {totalPages})
            </span>
          )}
        </span>
      </div>

      <div className="srs-students-section">
        {filteredStudents.length === 0 ? (
          <div className="srs-empty-state">
            <p>
              {totalElements === 0
                ? "현재 위험 학생이 없습니다."
                : "검색 조건에 맞는 학생이 없습니다."}
            </p>
          </div>
        ) : (
          <>
            <div className="srs-table-wrapper">
              <table className="srs-students-table">
                <thead>
                  <tr>
                    <th>학번</th>
                    <th>이름</th>
                    <th>학과</th>
                    <th>학년</th>
                    <th>전체 과목</th>
                    <th>심각 과목</th>
                    <th>위험 과목</th>
                    <th>최고 위험도</th>
                    <th>AI 분석</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.studentId}</td>
                      <td>{student.student?.name || "학생"}</td>
                      <td>{student.student?.department?.name || "학과"}</td>
                      <td>{student.student?.grade}학년</td>
                      <td>{student.subjects?.length || 0}개</td>
                      <td>
                        <span className="srs-count-badge srs-count-critical">
                          {student.criticalSubjects?.length || 0}
                        </span>
                      </td>
                      <td>
                        <span className="srs-count-badge srs-count-risk">
                          {student.riskSubjects?.length || 0}
                        </span>
                      </td>
                      <td>{getRiskBadge(student.highestRisk)}</td>
                      <td>
                        <button
                          className="srs-comment-btn"
                          onClick={(e) => handleShowComment(student, e)}
                          title="AI 분석 보기"
                        >
                          AI 분석
                        </button>
                      </td>
                      <td>
                        <button
                          className="srs-detail-btn"
                          onClick={() => handleStudentClick(student)}
                        >
                          상세보기
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

      {showCommentModal && selectedStudent && (
        <div className="srs-modal-overlay" onClick={handleCloseModal}>
          <div
            className="srs-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="srs-modal-header">
              <h3>AI 위험도 분석</h3>
              <button className="srs-modal-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            <div className="srs-modal-body">
              <div className="srs-student-info-box">
                <p>
                  <strong>학생:</strong> {selectedStudent.student?.name} (
                  {selectedStudent.studentId})
                </p>
                <p>
                  <strong>학과:</strong>{" "}
                  {selectedStudent.student?.department?.name}
                </p>
                <p>
                  <strong>위험도:</strong>{" "}
                  {getRiskBadge(selectedStudent.highestRisk)}
                </p>
              </div>
              <div className="srs-comment-box">
                <h4>AI 분석 결과</h4>
                <p className="srs-comment-text">
                  {getAIComment(selectedStudent)}
                </p>
              </div>
            </div>
            <div className="srs-modal-footer">
              <button
                className="srs-modal-btn-primary"
                onClick={handleCloseModal}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskBarItem({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="srs-bar-item">
      <div className="srs-bar-label">
        <span className="srs-bar-text">{label}</span>
        <span className="srs-bar-value">
          {count}명 ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="srs-bar-track">
        <div
          className={`srs-bar-fill srs-bar-fill-${color}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
