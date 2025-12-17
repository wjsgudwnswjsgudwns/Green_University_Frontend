import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import DatePicker from "react-datepicker";
import { registerLocale } from "react-datepicker";
import ko from "date-fns/locale/ko";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/scheduleInfo.css";

registerLocale("ko", ko);

export default function ScheduleRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    startDay: null,
    endDay: null,
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

  const handleDateChange = (name, date) => {
    setFormData((prev) => ({
      ...prev,
      [name]: date,
    }));
    setError("");
  };

  const formatDateForAPI = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.startDay || !formData.endDay || !formData.information) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    if (formData.startDay > formData.endDay) {
      setError("시작 날짜는 종료 날짜보다 이전이어야 합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        startDay: formatDateForAPI(formData.startDay),
        endDay: formatDateForAPI(formData.endDay),
        information: formData.information,
      };
      await api.post("/api/schedule", submitData);
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
    <div className="sch-container">
      <aside className="sch-side-menu">
        <div className="sch-side-menu-header">
          <h2>학사정보</h2>
        </div>
        <nav className="sch-side-menu-nav">
          <Link to="/board/notice" className="sch-menu-item">
            공지사항
          </Link>
          <Link to="/schedule" className="sch-menu-item">
            학사일정
          </Link>
          <Link to="/schedule/manage" className="sch-menu-item active">
            학사일정 등록
          </Link>
        </nav>
      </aside>

      <main className="sch-main">
        <h1>학사일정 등록</h1>
        <div className="sch-divider"></div>

        {error && <div className="sch-error-message">{error}</div>}

        <div className="sch-register-container">
          <form onSubmit={handleSubmit}>
            <table className="sch-register-table">
              <tbody>
                <tr>
                  <td className="sch-register-label">
                    시작날짜 <span className="sch-required">*</span>
                  </td>
                  <td className="sch-register-content">
                    <DatePicker
                      selected={formData.startDay}
                      onChange={(date) => handleDateChange("startDay", date)}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="시작 날짜를 선택하세요"
                      disabled={isSubmitting}
                      className="sch-register-input"
                      locale="ko"
                      dateFormatCalendar="yyyy년 M월"
                      required
                    />
                  </td>
                </tr>
                <tr>
                  <td className="sch-register-label">
                    종료날짜 <span className="sch-required">*</span>
                  </td>
                  <td className="sch-register-content">
                    <DatePicker
                      selected={formData.endDay}
                      onChange={(date) => handleDateChange("endDay", date)}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="종료 날짜를 선택하세요"
                      disabled={isSubmitting}
                      className="sch-register-input"
                      locale="ko"
                      minDate={formData.startDay}
                      dateFormatCalendar="yyyy년 M월"
                      required
                    />
                  </td>
                </tr>
                <tr>
                  <td className="sch-register-label">
                    내용 <span className="sch-required">*</span>
                  </td>
                  <td className="sch-register-content">
                    <textarea
                      name="information"
                      value={formData.information}
                      onChange={handleChange}
                      placeholder="학사일정 내용을 입력하세요"
                      disabled={isSubmitting}
                      className="sch-register-textarea"
                      rows="6"
                      required
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="sch-register-buttons">
              <button
                type="button"
                className="sch-cancel-button"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="submit"
                className="sch-submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "등록 중..." : "등록"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
