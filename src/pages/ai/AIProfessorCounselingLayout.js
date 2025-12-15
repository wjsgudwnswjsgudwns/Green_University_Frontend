import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "../../styles/counselingLayout.css";

export default function AIProfessorCounselingLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      path: "/aiprofessor/counseling",
      label: "전체 학생 관리",
    },
    {
      path: "/aiprofessor/counseling/risk",
      label: "위험 학생 관리",
    },
    {
      path: "/aiprofessor/counseling/schedule",
      label: "상담 일정",
    },
    {
      path: "/aiprofessor/counseling/meetings",
      label: "상담",
    },
  ];

  const isActive = (path) => {
    if (path === "/aiprofessor/counseling") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="counseling-layout">
      <aside className="counseling-sidebar">
        <div className="sidebar-header">
          <h2>상담 관리</h2>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`sidebar-menu-item ${
                isActive(item.path) ? "active" : ""
              }`}
              onClick={() => navigate(item.path)}
            >
              <span className="menu-icon">{item.icon}</span>
              <div className="menu-content">
                <div className="menu-label">{item.label}</div>
                <div className="menu-description">{item.description}</div>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      <main className="counseling-main">
        <Outlet />
      </main>
    </div>
  );
}
