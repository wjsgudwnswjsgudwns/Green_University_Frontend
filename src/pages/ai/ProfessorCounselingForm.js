import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function ProfessorCounselingForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    studentId: "",
    title: "",
    content: "",
    counselingType: "학업",
    counselingDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (user?.userRole !== "professor") {
      navigate("/");
      return;
    }
    fetchMyStudents();
  }, [user, navigate]);

  // 내 수강생 목록 조회
  const fetchMyStudents = async () => {
    try {
      // 교수가 담당하는 과목의 학생들 조회
      const response = await api.get(`/api/professor/subject`);

      // 모든 과목에서 학생 목록 추출 및 중복 제거
      const allStudents = [];
      const studentIds = new Set();

      if (response.data && Array.isArray(response.data)) {
        for (const subject of response.data) {
          if (subject.id) {
            try {
              const studentResponse = await api.get(
                `/api/professor/subject/${subject.id}/students`
              );

              if (studentResponse.data && Array.isArray(studentResponse.data)) {
                studentResponse.data.forEach((student) => {
                  if (!studentIds.has(student.studentId)) {
                    studentIds.add(student.studentId);
                    allStudents.push({
                      id: student.studentId,
                      name: student.name,
                      studentNumber: student.studentNumber,
                      deptName: student.deptName,
                    });
                  }
                });
              }
            } catch (err) {
              console.error(`과목 ${subject.id} 학생 조회 실패:`, err);
            }
          }
        }
      }

      setStudents(allStudents);
    } catch (err) {
      console.error("학생 목록 조회 실패:", err);
      setError("학생 목록을 불러오는데 실패했습니다.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.studentId) {
      setError("학생을 선택해주세요.");
      return;
    }

    if (!formData.title.trim()) {
      setError("상담 제목을 입력해주세요.");
      return;
    }

    if (!formData.content.trim()) {
      setError("상담 내용을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        studentId: parseInt(formData.studentId),
        counselorId: user.id,
        counselorType: "PROFESSOR",
        title: formData.title,
        content: formData.content,
        counselingType: formData.counselingType,
        counselingDate: formData.counselingDate,
      };

      await api.post("/api/counseling", requestData);

      setSuccess("상담 기록이 등록되었습니다. AI 분석이 완료되었습니다.");

      // 폼 초기화
      setFormData({
        studentId: "",
        title: "",
        content: "",
        counselingType: "학업",
        counselingDate: new Date().toISOString().split("T")[0],
      });

      // 2초 후 목록 페이지로 이동
      setTimeout(() => {
        navigate("/professor/counseling/list");
      }, 2000);
    } catch (err) {
      console.error("상담 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("상담 등록에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="counseling-page-container">
      <aside className="counseling-side-menu">
        <div className="counseling-side-menu-header">
          <h2>상담 관리</h2>
        </div>
        <nav className="counseling-side-menu-nav">
          <Link
            to="/professor/counseling/list"
            className="counseling-menu-item"
          >
            상담 내역
          </Link>
          <Link
            to="/professor/counseling/form"
            className="counseling-menu-item active"
          >
            상담 기록 작성
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <h1>상담 기록 작성</h1>
        <div className="counseling-divider"></div>

        {error && <div className="counseling-error-message">{error}</div>}
        {success && <div className="counseling-success-message">{success}</div>}

        <div className="counseling-info-box counseling-ai-info">
          <div>
            <p>
              <strong>AI 자동 분석</strong>
            </p>
            <p>
              상담 내용을 저장하면 AI가 자동으로 중도이탈 위험도를 분석합니다.
              분석 결과는 상담 상세 페이지에서 확인하실 수 있습니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="counseling-form">
          <div className="counseling-form-section">
            <h3>기본 정보</h3>

            <div className="counseling-form-group">
              <label
                htmlFor="studentId"
                className="counseling-form-label required"
              >
                학생 선택
              </label>
              <select
                id="studentId"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                className="counseling-form-select"
                required
              >
                <option value="">학생을 선택하세요</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.studentNumber}) -{" "}
                    {student.deptName}
                  </option>
                ))}
              </select>
            </div>

            <div className="counseling-form-group">
              <label
                htmlFor="counselingDate"
                className="counseling-form-label required"
              >
                상담 일자
              </label>
              <input
                type="date"
                id="counselingDate"
                name="counselingDate"
                value={formData.counselingDate}
                onChange={handleChange}
                className="counseling-form-input"
                required
              />
            </div>

            <div className="counseling-form-group">
              <label
                htmlFor="counselingType"
                className="counseling-form-label required"
              >
                상담 유형
              </label>
              <select
                id="counselingType"
                name="counselingType"
                value={formData.counselingType}
                onChange={handleChange}
                className="counseling-form-select"
                required
              >
                <option value="학업">학업</option>
                <option value="정서">정서</option>
                <option value="가정">가정</option>
                <option value="경력">진로/경력</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </div>

          <div className="counseling-form-section">
            <h3>상담 내용</h3>

            <div className="counseling-form-group">
              <label htmlFor="title" className="counseling-form-label required">
                상담 제목
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="counseling-form-input"
                placeholder="예: 학업 부진 관련 상담"
                required
              />
            </div>

            <div className="counseling-form-group">
              <label
                htmlFor="content"
                className="counseling-form-label required"
              >
                상담 내용
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                className="counseling-form-textarea"
                placeholder="상담 내용을 자세히 입력해주세요.&#10;&#10;예시:&#10;- 학생의 상태 및 고민 사항&#10;- 상담 과정에서 나눈 대화 내용&#10;- 학생의 감정 상태 및 태도&#10;- 관찰된 문제점 및 특이사항&#10;&#10;상세할수록 AI 분석 정확도가 높아집니다."
                rows="12"
                required
              />
              <div className="counseling-form-hint">
                상담 내용은 학생도 확인할 수 있습니다. AI 분석 결과는
                교수/직원만 확인 가능합니다.
              </div>
            </div>
          </div>

          <div className="counseling-form-actions">
            <button
              type="button"
              onClick={() => navigate("/professor/counseling/list")}
              className="counseling-button counseling-button-secondary"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="counseling-button counseling-button-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="counseling-button-spinner"></span>
                  AI 분석 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">save</span>
                  저장 및 AI 분석
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
