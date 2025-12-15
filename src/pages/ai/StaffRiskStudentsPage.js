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

  // 필터 상태
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 정렬 상태
  const [sortConfig, setSortConfig] = useState({
    field: "highestRisk",
    direction: "desc",
  });

  // AI 코멘트 모달 상태
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    filterAndSortStudents();
  }, [
    selectedCollege,
    selectedDepartment,
    selectedRiskLevel,
    searchTerm,
    sortConfig,
    allRiskStudents,
  ]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const collegesResponse = await api.get("/api/admin/colleges/all");
      const departmentsResponse = await api.get("/api/admin/departments/all");
      const allStudentsResponse = await api.get(
        "/api/ai-analysis/students/all"
      );

      if (collegesResponse.data) {
        setColleges(collegesResponse.data || []);
      }

      if (departmentsResponse.data) {
        setDepartments(departmentsResponse.data || []);
      }

      if (allStudentsResponse.data.code === 1) {
        // 학생별로 그룹화하고 위험 학생만 필터링
        const groupedStudents = groupAndFilterRiskStudents(
          allStudentsResponse.data.data || []
        );
        setAllRiskStudents(groupedStudents);
        setFilteredStudents(groupedStudents);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 학생별로 그룹화하고 RISK 또는 CRITICAL인 학생만 필터링
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

      // 위험 과목 분류
      if (result.overallRisk === "CRITICAL") {
        studentData.criticalSubjects.push(result);
      } else if (result.overallRisk === "RISK") {
        studentData.riskSubjects.push(result);
      }

      // 최고 위험도 업데이트
      const riskPriority = getRiskPriority(result.overallRisk);
      if (riskPriority > studentData.riskPriority) {
        studentData.highestRisk = result.overallRisk;
        studentData.riskPriority = riskPriority;
      }
    });

    // RISK 또는 CRITICAL인 학생만 필터링
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

  const filterAndSortStudents = () => {
    let filtered = [...allRiskStudents];

    // 단과대학 필터
    if (selectedCollege) {
      filtered = filtered.filter(
        (student) =>
          student.student?.department?.college?.id === parseInt(selectedCollege)
      );
    }

    // 학과 필터
    if (selectedDepartment) {
      filtered = filtered.filter(
        (student) =>
          student.student?.department?.id === parseInt(selectedDepartment)
      );
    }

    // 위험도 필터
    if (selectedRiskLevel) {
      filtered = filtered.filter(
        (student) => student.highestRisk === selectedRiskLevel
      );
    }

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          String(student.studentId).toLowerCase().includes(term) ||
          student.student?.name?.toLowerCase().includes(term) ||
          student.student?.department?.name?.toLowerCase().includes(term)
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
        case "name":
          aValue = a.student?.name || "";
          bValue = b.student?.name || "";
          break;
        case "department":
          aValue = a.student?.department?.name || "";
          bValue = b.student?.department?.name || "";
          break;
        case "grade":
          aValue = a.student?.grade || 0;
          bValue = b.student?.grade || 0;
          break;
        case "subjectCount":
          aValue = a.subjects.length;
          bValue = b.subjects.length;
          break;
        case "criticalCount":
          aValue = a.criticalSubjects.length;
          bValue = b.criticalSubjects.length;
          break;
        case "riskCount":
          aValue = a.riskSubjects.length;
          bValue = b.riskSubjects.length;
          break;
        case "highestRisk":
          aValue = a.riskPriority;
          bValue = b.riskPriority;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredStudents(filtered);
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

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment("");
  };

  const handleReset = () => {
    setSelectedCollege("");
    setSelectedDepartment("");
    setSelectedRiskLevel("");
    setSearchTerm("");
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
    // 학생의 과목들 중에서 분석 코멘트가 있는 것을 찾음
    const subjectWithComment = student.subjects.find(
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

  // 위험도별 카운트
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

      const response = await api.post("/api/ai-analysis/analyze-all", {
        year: new Date().getFullYear(),
        semester: 1, // 또는 CURRENT_SEMESTER에 맞게
      });

      if (response.data.code === 1) {
        alert(response.data.message);
        // 분석 완료 후 데이터 다시 조회
        await fetchInitialData();
      }
    } catch (err) {
      console.error("AI 분석 실행 실패:", err);
      alert("AI 분석 실행 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
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

      {/* 요약 통계 */}
      <div className="srs-risk-statistics">
        <div className="srs-risk-stat-card srs-risk-stat-critical">
          <div className="srs-risk-stat-content">
            <span className="srs-risk-stat-label">심각</span>
            <span className="srs-risk-stat-value">{riskCounts.critical}명</span>
          </div>
        </div>

        <div className="srs-risk-stat-card srs-risk-stat-warning">
          <div className="srs-risk-stat-content">
            <span className="srs-risk-stat-label">위험</span>
            <span className="srs-risk-stat-value">{riskCounts.risk}명</span>
          </div>
        </div>

        <div className="srs-risk-stat-card srs-risk-stat-total">
          <div className="srs-risk-stat-content">
            <span className="srs-risk-stat-label">전체 위험 학생</span>
            <span className="srs-risk-stat-value">{riskCounts.total}명</span>
          </div>
        </div>
      </div>

      {/* 필터 영역 */}
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
            onChange={(e) => setSelectedDepartment(e.target.value)}
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
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
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
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="srs-reset-btn" onClick={handleReset}>
          초기화
        </button>
      </div>

      <div className="srs-results-info">
        <span className="srs-results-count">
          총 <strong>{filteredStudents.length}</strong>명의 위험 학생
        </span>
      </div>

      {/* 학생 목록 */}
      <div className="srs-students-section">
        {filteredStudents.length === 0 ? (
          <div className="srs-empty-state">
            <p>
              {allRiskStudents.length === 0
                ? "현재 위험 학생이 없습니다. 🎉"
                : "검색 조건에 맞는 학생이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="srs-table-wrapper">
            <table className="srs-students-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("studentId")}>
                    학번 {getSortIcon("studentId")}
                  </th>
                  <th onClick={() => handleSort("name")}>
                    이름 {getSortIcon("name")}
                  </th>
                  <th onClick={() => handleSort("department")}>
                    학과 {getSortIcon("department")}
                  </th>
                  <th onClick={() => handleSort("grade")}>
                    학년 {getSortIcon("grade")}
                  </th>
                  <th onClick={() => handleSort("subjectCount")}>
                    전체 과목 {getSortIcon("subjectCount")}
                  </th>
                  <th onClick={() => handleSort("criticalCount")}>
                    심각 과목 {getSortIcon("criticalCount")}
                  </th>
                  <th onClick={() => handleSort("riskCount")}>
                    위험 과목 {getSortIcon("riskCount")}
                  </th>
                  <th onClick={() => handleSort("highestRisk")}>
                    최고 위험도 {getSortIcon("highestRisk")}
                  </th>
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
                    <td>{student.subjects.length}개</td>
                    <td>
                      <span className="srs-count-badge srs-count-critical">
                        {student.criticalSubjects.length}
                      </span>
                    </td>
                    <td>
                      <span className="srs-count-badge srs-count-risk">
                        {student.riskSubjects.length}
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
        )}
      </div>

      {/* AI 코멘트 모달 */}
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
