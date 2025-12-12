import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/staffCounseling.css";

export default function StaffCounselingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allRiskStudents, setAllRiskStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [selectedCollege, selectedDepartment, selectedRiskLevel, allRiskStudents]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      // 단과대 목록 조회 - 수정된 API 경로
      const collegesResponse = await api.get("/api/admin/colleges/all");

      // 학과 목록 조회 - 수정된 API 경로
      const departmentsResponse = await api.get("/api/admin/departments/all");

      // 전체 위험 학생 조회
      const riskStudentsResponse = await api.get(
        "/api/ai-analysis/risk-students/all"
      );

      if (collegesResponse.data) {
        setColleges(collegesResponse.data || []);
      }

      if (departmentsResponse.data) {
        const depts = departmentsResponse.data || [];
        console.log("학과 데이터:", depts);
        console.log("첫 번째 학과:", depts[0]);
        setDepartments(depts);
      }

      if (riskStudentsResponse.data.code === 1) {
        // 백엔드에서 이미 CAUTION, RISK, CRITICAL만 반환함
        setAllRiskStudents(riskStudentsResponse.data.data || []);
        setFilteredStudents(riskStudentsResponse.data.data || []);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = [...allRiskStudents];

    // 단과대 필터
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
        (student) => student.overallRisk === selectedRiskLevel
      );
    }

    setFilteredStudents(filtered);
  };

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment(""); // 단과대 변경 시 학과 초기화
  };

  const handleReset = () => {
    setSelectedCollege("");
    setSelectedDepartment("");
    setSelectedRiskLevel("");
  };

  const handleStudentClick = (student) => {
    // 학생 상세 페이지로 이동 (교수 페이지 재활용)
    navigate(
      `/staff/counseling/student/${student.studentId}/subject/${student.subjectId}`
    );
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "stc-risk-normal" },
      CAUTION: { text: "주의", class: "stc-risk-caution" },
      RISK: { text: "위험", class: "stc-risk-warning" },
      CRITICAL: { text: "심각", class: "stc-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return (
      <span className={`stc-risk-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  const getFilteredDepartments = () => {
    if (!selectedCollege) return departments;
    return departments.filter((dept) => {
      // DTO 사용 시: collegeId 직접 비교
      // 엔티티 직접 사용 시: college.id 비교
      const collegeId = dept.collegeId || dept.college?.id;
      return collegeId === parseInt(selectedCollege);
    });
  };

  if (loading) {
    return (
      <div className="stc-page-container">
        <div className="stc-loading">
          <div className="stc-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stc-page-container">
      {/* Header */}
      <div className="stc-header">
        <h1 className="stc-title">학생 상담 관리</h1>
        <p className="stc-subtitle">
          전체 학생의 중도 이탈 위험도를 확인하고 관리할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="stc-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Statistics Summary */}
      <div className="stc-statistics">
        <div className="stc-stat-card stc-stat-total">
          <div className="stc-stat-content">
            <span className="stc-stat-label">전체 위험 학생</span>
            <span className="stc-stat-value">{allRiskStudents.length}명</span>
          </div>
        </div>

        <div className="stc-stat-card stc-stat-critical">
          <div className="stc-stat-content">
            <span className="stc-stat-label">심각</span>
            <span className="stc-stat-value">
              {
                allRiskStudents.filter((s) => s.overallRisk === "CRITICAL")
                  .length
              }
              명
            </span>
          </div>
        </div>

        <div className="stc-stat-card stc-stat-risk">
          <div className="stc-stat-content">
            <span className="stc-stat-label">위험</span>
            <span className="stc-stat-value">
              {allRiskStudents.filter((s) => s.overallRisk === "RISK").length}명
            </span>
          </div>
        </div>

        <div className="stc-stat-card stc-stat-caution">
          <div className="stc-stat-content">
            <span className="stc-stat-label">주의</span>
            <span className="stc-stat-value">
              {
                allRiskStudents.filter((s) => s.overallRisk === "CAUTION")
                  .length
              }
              명
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="stc-filters">
        <div className="stc-filter-group">
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

        <div className="stc-filter-group">
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

        <div className="stc-filter-group">
          <label htmlFor="riskLevel">위험도</label>
          <select
            id="riskLevel"
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
          >
            <option value="">전체</option>
            <option value="CRITICAL">심각</option>
            <option value="RISK">위험</option>
            <option value="CAUTION">주의</option>
          </select>
        </div>

        <button className="stc-reset-btn" onClick={handleReset}>
          초기화
        </button>
      </div>

      {/* Results Info */}
      <div className="stc-results-info">
        <span className="stc-results-count">
          총 <strong>{filteredStudents.length}</strong>명의 학생
        </span>
      </div>

      {/* Students List */}
      <div className="stc-students-section">
        {filteredStudents.length === 0 ? (
          <div className="stc-empty-state">
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="stc-students-grid">
            {filteredStudents.map((result) => (
              <div
                key={`${result.studentId}-${result.subjectId}`}
                className="stc-student-card"
                onClick={() => handleStudentClick(result)}
              >
                <div className="stc-card-header">
                  <div className="stc-student-info">
                    <div>
                      <h3>{result.student?.name || "학생"}</h3>
                      <span className="stc-student-id">{result.studentId}</span>
                    </div>
                  </div>
                  {getRiskBadge(result.overallRisk)}
                </div>

                <div className="stc-card-body">
                  <div className="stc-info-row">
                    <span>
                      {result.student?.department?.name || "학과"} -{" "}
                      {result.student?.grade}학년
                    </span>
                  </div>

                  <div className="stc-info-row">
                    <span>{result.subject?.name || "과목명"}</span>
                  </div>

                  <div className="stc-info-row">
                    <span>
                      담당: {result.subject?.professor?.name || "교수"}
                    </span>
                  </div>
                </div>

                <div className="stc-card-footer">
                  <button className="stc-view-btn">상세 보기</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
