import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/scheduleInfo.css";

export default function ScheduleManagePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 직원이 아니면 접근 불가
  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchSchedules();
  }, [user, navigate]);

  const fetchSchedules = async () => {
    try {
      const response = await api.get("/api/schedule/manage");
      setSchedules(response.data);
    } catch (err) {
      console.error("학사일정 조회 실패:", err);
      setError("학사일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("이 학사일정을 삭제하시겠습니까?")) {
      return;
    }

    try {
      await api.delete(`/api/schedule/${id}`);
      alert("학사일정이 삭제되었습니다.");
      fetchSchedules();
    } catch (err) {
      console.error("학사일정 삭제 실패:", err);
      alert("학사일정 삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="sch-page-container">
        <div className="sch-loading-container">
          <div className="sch-spinner"></div>
          <p>로딩 중...</p>
        </div>
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
        <div className="sch-manage-header">
          <h1>학사일정 등록</h1>
          <button
            className="sch-register-button"
            onClick={() => navigate("/schedule/register")}
          >
            등록
          </button>
        </div>

        <div className="sch-divider"></div>

        {error && <div className="sch-error-message">{error}</div>}

        <div className="sch-manage-table-container">
          <table className="sch-manage-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>날짜</th>
                <th>내용</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length > 0 ? (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{schedule.id}</td>
                    <td>
                      {schedule.startDay?.split("T")[0]}~
                      {schedule.endDay?.split("T")[0]}
                    </td>
                    <td>{schedule.information}</td>
                    <td>
                      <button
                        className="sch-delete-button-small"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="sch-no-data-cell">
                    등록된 학사일정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
