import React from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import "../styles/mainPage.css";

export default function MainPage() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="main-page page-container">
      <div className="main-content">
        <div className="main-column"></div>
        <div className="side-column">
          {user && (
            <div className="profile-card">
              <ul className="profile-header">
                <li className="welcome">{user.name}님, 환영합니다.</li>
              </ul>
              <hr />
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
