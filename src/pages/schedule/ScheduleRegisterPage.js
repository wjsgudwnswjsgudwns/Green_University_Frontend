import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/schedule.css";

export default function ScheduleRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    startDay: "",
    endDay: "",
    information: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 직원이 아니면 접근 불가
  if (user?.userRole !== "staff") {
    navigate("/");
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.startDay || !formData.endDay || !formData.information) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    const startDate = new Date(formData.startDay);
    const endDate = new Date(formData.endDay);

    if (startDate > endDate) {
      setError("시작 날짜는 종료 날짜보다 이전이어야 합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post("/api/schedule", formData);
      alert("학사일정이 등록되었습니다.");
      navigate("/schedule/manage");
    } catch (err) {
      console.error("학사일정 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("학사일정 등록에 실패했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm("작성을 취소하시겠습니까?")) {
      navigate("/schedule/manage");
    }
  };

  return (
    <div className="schedule-container">
      <aside className="side-menu">
        <div className="side-menu-header">
          <h2>학사정보</h2>
        </div>
        <nav className="side-menu-nav">
          <Link to="/board/notice" className="menu-item">
            공지사항
          </Link>
          <Link to="/schedule" className="menu-item">
            학사일정
          </Link>
          <Link to="/schedule/manage" className="menu-item">
            학사일정 등록
          </Link>
        </nav>
      </aside>

      <main className="schedule-main">
        <h1>학사일정 등록</h1>
        <div className="divider"></div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="schedule-register-form">
          <div className="form-group-vertical">
            <label htmlFor="startDay">
              시작날짜 <span className="required">*</span>
            </label>
            <input
              type="date"
              id="startDay"
              name="startDay"
              value={formData.startDay}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group-vertical">
            <label htmlFor="endDay">
              종료날짜 <span className="required">*</span>
            </label>
            <input
              type="date"
              id="endDay"
              name="endDay"
              value={formData.endDay}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group-vertical">
            <label htmlFor="information">
              내용 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="information"
              name="information"
              value={formData.information}
              onChange={handleChange}
              placeholder="학사일정 내용을 입력하세요"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-buttons-center">
            <button
              type="button"
              className="cancel-button-large"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="submit-button-large"
              disabled={isSubmitting}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
