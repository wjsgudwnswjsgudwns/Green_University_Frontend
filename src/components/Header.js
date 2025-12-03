import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/header.css";

/**
 * Header component renders the top navigation bar and user information.
 * It adapts the visible navigation items based on the current user's role.
 */
export default function Header() {
  const { user, logout } = useAuth();

  // Determine menu items based on user role.
  // Each entry contains a display label and the target route.
  let menuItems = [];
  if (user) {
    switch (user.role) {
      case "student":
        menuItems = [
          { label: "홈", path: "/" },
          { label: "MY", path: "/student/info" },
          { label: "수업", path: "/student/subjects" },
          { label: "수강신청", path: "/student/registration" },
          { label: "성적", path: "/student/grades" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
      case "professor":
        menuItems = [
          { label: "홈", path: "/" },
          { label: "MY", path: "/professor/info" },
          { label: "수업", path: "/professor/subjects" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
      case "staff":
      default:
        menuItems = [
          { label: "홈", path: "/" },
          { label: "MY", path: "/staff/info" },
          { label: "학사관리", path: "/staff/student-list/" },
          { label: "등록", path: "/admin/register" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
    }
  }

  return (
    <header className="header">
      <div className="header-top">
        {user ? (
          <ul className="user-info">
            <li className="icon material-symbols-outlined">account_circle</li>
            <li>
              {user.name}님 ({user.id})
            </li>
            <li className="divider">|</li>
            <li
              className="icon material-symbols-outlined"
              style={{ color: "#9BD2EC" }}
            >
              logout
            </li>
            <li>
              {/* Logout triggers context logout and navigates to login */}
              <button className="link-button" onClick={logout}>
                로그아웃
              </button>
            </li>
          </ul>
        ) : (
          // <ul className="user-info">
          //   <li>
          //     <Link to="/login">로그인</Link>
          //   </li>
          // </ul>
          <div></div>
        )}
      </div>
      <nav className="main-menu">
        <Link to="/" className="logo-link">
          {/* Placeholder logo; replace with your own logo asset */}
          <span className="logo-text">GREEN LMS</span>
        </Link>
        {user && (
          <ul className="nav-items">
            {menuItems.map((item) => (
              <li key={item.path} className="nav-item">
                <Link to={item.path}>{item.label}</Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </header>
  );
}
