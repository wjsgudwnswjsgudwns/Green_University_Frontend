import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/staffAllStudents.css";

export default function StaffAllStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
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
  }, [selectedCollege, selectedDepartment, selectedRiskLevel, allStudents]);

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
        // 학생별로 그룹화
        const groupedStudents = groupStudentsByStudent(
          allStudentsResponse.data.data || []
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

    if (selectedCollege) {
      filtered = filtered.filter(
        (student) =>
          student.student?.department?.college?.id === parseInt(selectedCollege)
      );
    }

    if (selectedDepartment) {
      filtered = filtered.filter(
        (student) =>
          student.student?.department?.id === parseInt(selectedDepartment)
      );
    }

    if (selectedRiskLevel) {
      filtered = filtered.filter(
        (student) => student.highestRisk === selectedRiskLevel
      );
    }

    setFilteredStudents(filtered);
  };

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment("");
  };

  const handleReset = () => {
    setSelectedCollege("");
    setSelectedDepartment("");
    setSelectedRiskLevel("");
  };

  const handleStudentClick = (student) => {
    navigate(`/staff/student/${student.studentId}`);
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

  const getFilteredDepartments = () => {
    if (!selectedCollege) return departments;
    return departments.filter((dept) => {
      const collegeId = dept.collegeId || dept.college?.id;
      return collegeId === parseInt(selectedCollege);
    });
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
        <h1 className="sas-title">전체 학생 관리</h1>
        <p className="sas-subtitle">
          전체 학생의 분석 결과를 확인하고 관리할 수 있습니다.
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
            <span className="sas-stat-label">전체 학생</span>
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

        <div className="sas-filter-group">
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
                    <td>{getRiskBadge(student.highestRisk)}</td>
                    <td>
                      <button
                        className="sas-detail-btn"
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
    </div>
  );
}
