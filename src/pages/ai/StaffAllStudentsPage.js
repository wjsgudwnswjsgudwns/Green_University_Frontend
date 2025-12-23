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

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);

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

    // 학번순 정렬
    filtered.sort((a, b) => a.studentId - b.studentId);

    setFilteredStudents(filtered);
    setCurrentPage(0); // 필터 변경 시 첫 페이지로
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

  const getTotalRiskCounts = () => {
    return {
      total: allStudents.length,
      normal: allStudents.filter((s) => s.highestRisk === "NORMAL").length,
      caution: allStudents.filter((s) => s.highestRisk === "CAUTION").length,
      risk: allStudents.filter((s) => s.highestRisk === "RISK").length,
      critical: allStudents.filter((s) => s.highestRisk === "CRITICAL").length,
    };
  };

  // 페이징 계산
  const totalPages = Math.ceil(filteredStudents.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
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

      <div className="sas-statistics-container">
        <div className="sas-donut-section">
          <h3>위험도 분포</h3>
          <div className="sas-donut-chart">
            <svg viewBox="0 0 200 200" className="sas-donut-svg">
              <DonutChart
                normal={riskCounts.normal}
                caution={riskCounts.caution}
                risk={riskCounts.risk}
                critical={riskCounts.critical}
                total={riskCounts.total}
              />
            </svg>
            <div className="sas-donut-center">
              <div className="sas-donut-total">{riskCounts.total}</div>
              <div className="sas-donut-label">전체</div>
            </div>
          </div>
          <div className="sas-donut-legend">
            <div className="sas-legend-item">
              <span className="sas-legend-dot sas-legend-normal"></span>
              <span>정상</span>
            </div>
            <div className="sas-legend-item">
              <span className="sas-legend-dot sas-legend-caution"></span>
              <span>주의</span>
            </div>
            <div className="sas-legend-item">
              <span className="sas-legend-dot sas-legend-risk"></span>
              <span>위험</span>
            </div>
            <div className="sas-legend-item">
              <span className="sas-legend-dot sas-legend-critical"></span>
              <span>심각</span>
            </div>
          </div>
        </div>

        <div className="sas-bars-section">
          <h3>위험도별 학생 수</h3>
          <div className="sas-bar-chart">
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
          {totalPages > 1 && (
            <span style={{ marginLeft: "10px", color: "#666" }}>
              (페이지 {currentPage + 1} / {totalPages})
            </span>
          )}
        </span>
      </div>

      <div className="sas-students-section">
        {currentStudents.length === 0 ? (
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
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStudents.map((student) => (
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
    { percent: normalPercent, color: "#28a745", className: "normal" },
    { percent: cautionPercent, color: "#ffc107", className: "caution" },
    { percent: riskPercent, color: "#fd7e14", className: "risk" },
    { percent: criticalPercent, color: "#dc3545", className: "critical" },
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
            className={`sas-donut-segment sas-donut-${segment.className}`}
          />
        );
      })}
    </g>
  );
}

function BarItem({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="sas-bar-item">
      <div className="sas-bar-label">
        <span className="sas-bar-text">{label}</span>
        <span className="sas-bar-value">
          {count}명 ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="sas-bar-track">
        <div
          className={`sas-bar-fill sas-bar-fill-${color}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
