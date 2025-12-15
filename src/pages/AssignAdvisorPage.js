import React, { useState } from "react";
import api from "../api/axiosConfig";

const AssignAdvisorPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAssignAll = async () => {
    if (!window.confirm("전체 학생에게 담당 교수를 배정하시겠습니까?")) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post("/api/advisor/assign-all");
      setResult(response.data);
      alert("담당 교수 배정이 완료되었습니다!");
    } catch (err) {
      setError(err.response?.data?.message || "배정 중 오류가 발생했습니다.");
      alert("오류: " + (err.response?.data?.message || "배정 실패"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "50px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>담당 교수 일괄 배정</h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        ⚠️ 이 기능은 최초 1회만 실행하면 됩니다. 기존 DB의 모든 학생에게 담당
        교수를 자동으로 배정합니다.
      </p>

      <button
        onClick={handleAssignAll}
        disabled={loading}
        style={{
          padding: "15px 30px",
          fontSize: "18px",
          backgroundColor: loading ? "#ccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: "30px",
        }}
      >
        {loading ? "배정 중..." : "전체 학생 담당 교수 배정"}
      </button>

      {error && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "5px",
            marginBottom: "20px",
          }}
        >
          <strong>오류:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#efe",
            border: "1px solid #cfc",
            borderRadius: "5px",
          }}
        >
          <h2>✅ 배정 완료</h2>
          <div style={{ marginTop: "20px" }}>
            <p>
              <strong>전체 학생 수:</strong> {result.totalStudents}명
            </p>
            <p>
              <strong>새로 배정된 학생:</strong> {result.assignedCount}명
            </p>
            <p>
              <strong>이미 배정된 학생:</strong> {result.alreadyAssignedCount}명
            </p>
          </div>

          {result.departmentDetails && result.departmentDetails.length > 0 && (
            <div style={{ marginTop: "30px" }}>
              <h3>학과별 배정 현황</h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "15px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f0f0f0" }}>
                    <th style={tableHeaderStyle}>학과명</th>
                    <th style={tableHeaderStyle}>학생 수</th>
                    <th style={tableHeaderStyle}>교수 수</th>
                    <th style={tableHeaderStyle}>배정 완료</th>
                    <th style={tableHeaderStyle}>교수당 평균</th>
                  </tr>
                </thead>
                <tbody>
                  {result.departmentDetails.map((dept, index) => (
                    <tr key={index}>
                      <td style={tableCellStyle}>
                        {dept.deptName || `학과 ID: ${dept.deptId}`}
                      </td>
                      <td style={tableCellStyle}>{dept.studentCount}명</td>
                      <td style={tableCellStyle}>{dept.professorCount}명</td>
                      <td style={tableCellStyle}>{dept.assigned}명</td>
                      <td style={tableCellStyle}>
                        {dept.avgPerProfessor
                          ? dept.avgPerProfessor.toFixed(1) + "명"
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const tableHeaderStyle = {
  padding: "12px",
  textAlign: "left",
  borderBottom: "2px solid #ddd",
  fontWeight: "bold",
};

const tableCellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
};

export default AssignAdvisorPage;
