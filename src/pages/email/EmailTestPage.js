import React, { useState } from "react";
import api from "../../api/axiosConfig";
import "./EmailTest.css";

export default function EmailTestPage() {
  const [formData, setFormData] = useState({
    studentId: "",
    subjectId: "",
    riskLevel: "RISK",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await api.post("/api/test/send-risk-email", {
        studentId: parseInt(formData.studentId),
        subjectId: parseInt(formData.subjectId),
        riskLevel: formData.riskLevel,
      });

      setResult(response.data.data);
      alert("테스트 이메일이 발송되었습니다!");
    } catch (err) {
      console.error("이메일 발송 실패:", err);
      setError(
        err.response?.data?.message || "이메일 발송 중 오류가 발생했습니다."
      );
      alert(
        "이메일 발송 실패: " + (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="email-test-container">
      <div className="email-test-card">
        <div className="email-test-header">
          <h1>📧 위험 알림 이메일 테스트</h1>
          <p>학생과 지도교수에게 테스트 이메일을 발송합니다</p>
        </div>

        <form onSubmit={handleSubmit} className="email-test-form">
          <div className="form-group">
            <label htmlFor="studentId">
              학생 ID <span className="required">*</span>
            </label>
            <input
              type="number"
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="예: 2023000011"
              required
            />
            <span className="form-hint">테스트할 학생의 ID를 입력하세요</span>
          </div>

          <div className="form-group">
            <label htmlFor="subjectId">
              과목 ID <span className="required">*</span>
            </label>
            <input
              type="number"
              id="subjectId"
              name="subjectId"
              value={formData.subjectId}
              onChange={handleChange}
              placeholder="예: 1"
              required
            />
            <span className="form-hint">테스트할 과목의 ID를 입력하세요</span>
          </div>

          <div className="form-group">
            <label htmlFor="riskLevel">
              위험도 레벨 <span className="required">*</span>
            </label>
            <select
              id="riskLevel"
              name="riskLevel"
              value={formData.riskLevel}
              onChange={handleChange}
              required
            >
              <option value="RISK">위험 (RISK)</option>
              <option value="CRITICAL">심각 (CRITICAL)</option>
            </select>
            <span className="form-hint">
              이메일에 표시될 위험도를 선택하세요
            </span>
          </div>

          <button type="submit" disabled={loading} className="submit-button">
            {loading ? (
              <>
                <span className="spinner"></span>
                이메일 발송 중...
              </>
            ) : (
              <>
                <span>📤</span>
                테스트 이메일 보내기
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="alert alert-error">
            <div className="alert-icon">❌</div>
            <div className="alert-content">
              <strong>오류 발생</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="alert alert-success">
            <div className="alert-icon">✅</div>
            <div className="alert-content">
              <strong>발송 완료</strong>
              <div className="result-details">
                <div className="result-item">
                  <span className="result-label">학생:</span>
                  <span className="result-value">
                    {result.studentName} ({result.studentEmail})
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">과목:</span>
                  <span className="result-value">{result.subjectName}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">위험도:</span>
                  <span
                    className={`result-badge ${result.riskLevel.toLowerCase()}`}
                  >
                    {result.riskLevel === "CRITICAL" ? "심각" : "위험"}
                  </span>
                </div>
                {result.advisorName && (
                  <div className="result-item">
                    <span className="result-label">지도교수:</span>
                    <span className="result-value">
                      {result.advisorName} ({result.advisorEmail})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="info-box">
          <div className="info-icon">ℹ️</div>
          <div className="info-content">
            <h3>테스트 방법</h3>
            <ol>
              <li>실제 존재하는 학생 ID를 입력하세요</li>
              <li>실제 존재하는 과목 ID를 입력하세요</li>
              <li>위험도 레벨을 선택하세요</li>
              <li>버튼을 클릭하면 학생과 지도교수에게 이메일이 발송됩니다</li>
              <li>이메일 수신함을 확인하세요 (스팸함도 확인!)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
