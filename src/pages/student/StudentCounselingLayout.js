import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "../../styles/counselingLayout.css";

export default function StudentCounselingLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { path: "/student/counseling", label: "상담 신청" },
        { path: "/student/counseling/meetings", label: "상담" },
    ];

    const isActive = (path) => {
        if (path === "/student/counseling") return location.pathname === path;
        return location.pathname.startsWith(path);
    };

    return (
        <div className="counseling-layout">
            <aside className="counseling-sidebar">
                <div className="sidebar-header">
                    <h2>상담</h2>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            type="button"
                            className={`sidebar-menu-item ${
                                isActive(item.path) ? "active" : ""
                            }`}
                            onClick={() => navigate(item.path)}
                        >
                            <div className="menu-content">
                                <div className="menu-label">{item.label}</div>
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
