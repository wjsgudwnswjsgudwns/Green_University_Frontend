import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/scheduleInfo.css";

export default function ScheduleDetailPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [schedule, setSchedule] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    startDay: "",
    endDay: "",
    information: "",
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchScheduleDetail();
  }, [id]);

  const fetchScheduleDetail = async () => {
    try {
      const response = await api.get(`/api/schedule/${id}`);
      setSchedule(response.data);
      setFormData({
        startDay: response.data.startDay,
        endDay: response.data.endDay,
        information: response.data.information,
      });
    } catch (err) {
      console.error("학사일정 조회 실패:", err);
      setError("학사일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      startDay: schedule.startDay,
      endDay: schedule.endDay,
      information: schedule.information,
    });
    setIsEditing(false);
    setError("");
  };

  const handleUpdate = async (e) => {
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
      await api.put(`/api/schedule/${id}`, formData);
      alert("학사일정이 수정되었습니다.");
      setIsEditing(false);
      fetchScheduleDetail();
    } catch (err) {
      console.error("학사일정 수정 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("학사일정 수정에 실패했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("이 학사일정을 삭제하시겠습니까?")) {
      return;
    }

    try {
      await api.delete(`/api/schedule/${id}`);
      alert("학사일정이 삭제되었습니다.");
      navigate("/schedule");
    } catch (err) {
      console.error("학사일정 삭제 실패:", err);
      alert("학사일정 삭제에 실패했습니다.");
    }
  };

  const getMenuItemClass = (path) => {
    if (path === "/schedule" && location.pathname.startsWith("/schedule/")) {
      return "sch-menu-item active";
    }
    return `sch-menu-item${location.pathname === path ? " active" : ""}`;
  };

  if (loading) {
    return (
      <div className="sch-container">
        <aside className="sch-side-menu">
          <div className="sch-side-menu-header">
            <h2>학사정보</h2>
          </div>
          <nav className="sch-side-menu-nav">
            <Link
              to="/board/notice"
              className={getMenuItemClass("/board/notice")}
            >
              공지사항
            </Link>
            <Link to="/schedule" className={getMenuItemClass("/schedule")}>
              학사일정
            </Link>
            {user?.userRole === "staff" && (
              <Link
                to="/schedule/manage"
                className={getMenuItemClass("/schedule/manage")}
              >
                학사일정 등록
              </Link>
            )}
          </nav>
        </aside>
        <main className="sch-main">
          <div className="sch-loading-container">
            <div className="sch-spinner"></div>
            <p>로딩 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="sch-container">
        <aside className="sch-side-menu">
          <div className="sch-side-menu-header">
            <h2>학사정보</h2>
          </div>
          <nav className="sch-side-menu-nav">
            <Link
              to="/board/notice"
              className={getMenuItemClass("/board/notice")}
            >
              공지사항
            </Link>
            <Link to="/schedule" className={getMenuItemClass("/schedule")}>
              학사일정
            </Link>
            {user?.userRole === "staff" && (
              <Link
                to="/schedule/manage"
                className={getMenuItemClass("/schedule/manage")}
              >
                학사일정 등록
              </Link>
            )}
          </nav>
        </aside>
        <main className="sch-main">
          <div className="sch-error-container">
            <p>학사일정을 찾을 수 없습니다.</p>
            <button onClick={() => navigate("/schedule")}>목록으로</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="sch-container">
      <aside className="sch-side-menu">
        <div className="sch-side-menu-header">
          <h2>학사정보</h2>
        </div>
        <nav className="sch-side-menu-nav">
          <Link
            to="/board/notice"
            className={getMenuItemClass("/board/notice")}
          >
            공지사항
          </Link>
          <Link to="/schedule" className={getMenuItemClass("/schedule")}>
            학사일정
          </Link>
          {user?.userRole === "staff" && (
            <Link
              to="/schedule/manage"
              className={getMenuItemClass("/schedule/manage")}
            >
              학사일정 등록
            </Link>
          )}
        </nav>
      </aside>

      <main className="sch-main">
        <div className="sch-page">
          <div className="sch-header">
            <h1>학사일정 상세</h1>
            <button
              className="sch-back-button"
              onClick={() => navigate("/schedule")}
            >
              목록으로
            </button>
          </div>

          <div className="sch-divider"></div>

          {error && <div className="sch-error-message">{error}</div>}

          {isEditing ? (
            <form onSubmit={handleUpdate} className="sch-form">
              <div className="sch-form-group">
                <label htmlFor="startDay">
                  시작 날짜 <span className="sch-required">*</span>
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

              <div className="sch-form-group">
                <label htmlFor="endDay">
                  종료 날짜 <span className="sch-required">*</span>
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

              <div className="sch-form-group">
                <label htmlFor="information">
                  일정 내용 <span className="sch-required">*</span>
                </label>
                <textarea
                  id="information"
                  name="information"
                  value={formData.information}
                  onChange={handleChange}
                  rows="4"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="sch-form-buttons">
                <button
                  type="button"
                  className="sch-cancel-button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="sch-submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "수정 중..." : "수정"}
                </button>
              </div>
            </form>
          ) : (
            <div className="sch-detail">
              <div className="sch-detail-row">
                <div className="sch-detail-label">기간</div>
                <div className="sch-detail-value">
                  {schedule.startDay} ~ {schedule.endDay}
                </div>
              </div>

              <div className="sch-detail-row">
                <div className="sch-detail-label">일정 내용</div>
                <div className="sch-detail-value">{schedule.information}</div>
              </div>

              {user?.userRole === "staff" && (
                <div className="sch-detail-buttons">
                  <button className="sch-edit-button" onClick={handleEdit}>
                    수정
                  </button>
                  <button className="sch-delete-button" onClick={handleDelete}>
                    삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
