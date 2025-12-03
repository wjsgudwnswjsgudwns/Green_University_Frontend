import React from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import "../styles/mainPage.css";

/**
 * Main page component displayed after login. Shows a welcome message,
 * recent notices, upcoming schedules and basic user profile information.
 * Data is mocked for the sake of this prototype. In a real system this
 * information would be fetched from the server.
 */
export default function MainPage() {
  const { user, logout } = useAuth();

  // Mocked notice and schedule data
  const noticeList = [
    {
      id: 1,
      category: "[학사]",
      title: "2025-1학기 수강신청 안내",
      date: "2024-12-10",
    },
    {
      id: 2,
      category: "[일반]",
      title: "도서관 리모델링 공사 안내",
      date: "2024-12-05",
    },
    {
      id: 3,
      category: "[학사]",
      title: "겨울학기 등록 일정 안내",
      date: "2024-12-01",
    },
  ];
  const scheduleList = [
    {
      id: 1,
      start: "02/01",
      end: "02/15",
      information: "2025-1학기 등록 기간",
    },
    { id: 2, start: "03/01", end: "03/05", information: "수강신청 변경 기간" },
    { id: 3, start: "06/20", end: "06/26", information: "기말고사" },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="main-page page-container">
      <div className="main-content">
        <div className="main-column">
          <div className="notice-section">
            <h3>
              <Link to="/board/notice">공지사항</Link>
            </h3>
            <div className="split" />
            <table className="list-table">
              <tbody>
                {noticeList.map((notice) => (
                  <tr key={notice.id}>
                    <td className="ellipsis">
                      <Link to={`/board/notice/${notice.id}`}>
                        {notice.category}&nbsp;{notice.title}
                      </Link>
                    </td>
                    <td className="date-cell">{notice.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="schedule-section">
            <h3>
              <Link to="/schedule">학사일정</Link>
            </h3>
            <div className="split" />
            <table className="list-table">
              <tbody>
                {scheduleList.map((sch) => (
                  <tr key={sch.id}>
                    <td className="date-range">
                      {sch.start}&nbsp;-&nbsp;{sch.end}
                    </td>
                    <td className="ellipsis">{sch.information}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="side-column">
          {user && (
            <div className="profile-card">
              <ul className="profile-header">
                <li className="icon material-symbols-rounded">person</li>
                <li className="welcome">{user.name}님, 환영합니다.</li>
              </ul>
              <hr />
              {/* Display different information depending on user role */}
              {user.userRole === "student" && (
                <table className="profile-table">
                  <tbody>
                    <tr>
                      <td>이메일</td>
                      <td>{user.email}</td>
                    </tr>
                    <tr>
                      <td>소속</td>
                      <td>컴퓨터공학과</td>
                    </tr>
                    <tr>
                      <td>학기</td>
                      <td>3학년&nbsp;2학기</td>
                    </tr>
                    <tr>
                      <td>학적상태</td>
                      <td>재학</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {user.userRole === "professor" && (
                <table className="profile-table">
                  <tbody>
                    <tr>
                      <td>이메일</td>
                      <td>{user.email}</td>
                    </tr>
                    <tr>
                      <td>소속</td>
                      <td>컴퓨터공학과 교수</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {user.userRole === "staff" && (
                <table className="profile-table">
                  <tbody>
                    <tr>
                      <td>이메일</td>
                      <td>{user.email}</td>
                    </tr>
                    <tr>
                      <td>소속</td>
                      <td>교직원</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <div className="profile-buttons">
                <Link to={`/${user.userRole}/info`}>
                  <button>마이페이지</button>
                </Link>
                <button onClick={handleLogout}>로그아웃</button>
              </div>
            </div>
          )}
          {/* Notification area: show sample alerts */}
          <div className="notification-card">
            <ul className="notification-header">
              <li className="icon material-symbols-rounded">notifications</li>
              <li className="title">업무 알림</li>
            </ul>
            <p>처리해야 할 업무가 없습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
