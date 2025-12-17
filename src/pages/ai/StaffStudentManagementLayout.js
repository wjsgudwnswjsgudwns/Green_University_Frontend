import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "../../styles/staffLayout.css";

export default function StaffStudentManagementLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      path: "/staff/students/all",
      label: "전체 학생 관리",
    },
    {
      path: "/staff/students/all/risk",
      label: "위험 학생 관리",
    },
  ];

  const isActive = (path) => {
    if (path === "/staff/students/all/risk") {
      return location.pathname === path;
    }
    if (path === "/staff/students/all") {
      // /risk로 끝나지 않는 /all 경로만 활성화
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="staff-layout">
      <aside className="staff-sidebar">
        <div className="sidebar-header">
          <h2>학생 관리</h2>
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
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="staff-main">
        <Outlet />
      </main>
    </div>
  );
}
