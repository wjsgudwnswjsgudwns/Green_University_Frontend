import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/scheduleInfo.css";

export default function ScheduleListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 월별로 그룹핑된 데이터
  const [groupedSchedules, setGroupedSchedules] = useState({});

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await api.get("/api/schedule");
      const data = response.data;
      setSchedules(data);

      // 월별로 그룹핑
      const grouped = {};
      data.forEach((schedule) => {
        // startDay에서 월 추출 (YYYY-MM-DD 또는 MM-DD 형식)
        let month = 1;
        if (schedule.startDay) {
          const dateStr = schedule.startDay;
          // MM-DD 형식인 경우
          if (dateStr.match(/^\d{2}-\d{2}/)) {
            month = parseInt(dateStr.substring(0, 2));
          }
          // YYYY-MM-DD 형식인 경우
          else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            month = parseInt(dateStr.substring(5, 7));
          }
        }

        if (!grouped[month]) {
          grouped[month] = [];
        }
        grouped[month].push(schedule);
      });

      setGroupedSchedules(grouped);
    } catch (err) {
      console.error("학사일정 조회 실패:", err);
      setError("학사일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getMonthFromDate = (dateString) => {
    if (!dateString) return 1;
    // MM-DD 형식
    if (dateString.match(/^\d{2}-\d{2}/)) {
      return parseInt(dateString.substring(0, 2));
    }
    // YYYY-MM-DD 형식
    if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      return parseInt(dateString.substring(5, 7));
    }
    return 1;
  };

  const handleScheduleClick = (id) => {
    navigate(`/schedule/${id}`);
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
          <Link to="/schedule" className="sch-menu-item active">
            학사일정
          </Link>
          {user?.userRole === "staff" && (
            <Link to="/schedule/manage" className="sch-menu-item">
              학사일정 등록
            </Link>
          )}
        </nav>
      </aside>

      <main className="sch-main">
        <h1>학사일정</h1>
        <div className="sch-divider"></div>

        {error && <div className="sch-error-message">{error}</div>}

        {Object.keys(groupedSchedules).length > 0 ? (
          <div className="sch-table-container">
            <table className="sch-table">
              <tbody>
                {Object.keys(groupedSchedules)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((month) => (
                    <React.Fragment key={month}>
                      <tr className="sch-month-row">
                        <td
                          className="sch-month-cell"
                          rowSpan={groupedSchedules[month].length}
                        >
                          {month}월
                        </td>
                        <td className="sch-date-cell">
                          {groupedSchedules[month][0].startDay}~
                          {groupedSchedules[month][0].endDay}
                        </td>
                        <td
                          className="sch-info-cell clickable"
                          onClick={() =>
                            handleScheduleClick(groupedSchedules[month][0].id)
                          }
                        >
                          {groupedSchedules[month][0].information}
                        </td>
                      </tr>
                      {groupedSchedules[month].slice(1).map((schedule) => (
                        <tr key={schedule.id}>
                          <td className="sch-date-cell">
                            {schedule.startDay}~{schedule.endDay}
                          </td>
                          <td
                            className="sch-info-cell clickable"
                            onClick={() => handleScheduleClick(schedule.id)}
                          >
                            {schedule.information}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sch-no-data">등록된 학사일정이 없습니다.</div>
        )}
      </main>
    </div>
  );
}
