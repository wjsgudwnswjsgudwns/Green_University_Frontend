import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/header.css";

export default function Header() {
  const { user, logout } = useAuth();

  let menuItems = [];
  if (user) {
    switch (user.userRole) {
      case "student":
        menuItems = [
          { label: "홈", path: "/" },
          { label: "MY", path: "/student/info" },
          { label: "수업", path: "/subject/list/1" },
          { label: "수강신청", path: "/sugang/subjectlist" },
          { label: "성적", path: "/grade/thisSemester" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
      case "professor":
        menuItems = [
          { label: "홈", path: "/" },
          { label: "MY", path: "/professor/info" },
          { label: "수업", path: "/subject/list/:page" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
      case "staff":
      default:
        menuItems = [
          { label: "홈", path: "/" },
          { label: "MY", path: "/staff/info" },
          { label: "학사관리", path: "/staff/student-list/" },
          { label: "등록", path: "/staff/admin/college" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
    }
  }

  return (
    <header className="header">
      <nav className="main-menu">
        <Link to="/" className="logo-link">
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
