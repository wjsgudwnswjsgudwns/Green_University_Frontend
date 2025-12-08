import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import "../../styles/adminRegister.css";

export default function AdminRegisterPage() {
  const location = useLocation();
  const basePath = "/admin/register";
  const menu = [
    { label: "단과대학", path: `${basePath}/college` },
    { label: "학과", path: `${basePath}/department` },
    { label: "강의실", path: `${basePath}/room` },
    { label: "강의", path: `${basePath}/subject` },
    { label: "등록금", path: `${basePath}/tuition` },
  ];

  return (
    <div className="admin-register page-container">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <h2>등록</h2>
          <nav>
            <ul>
              {menu.map((item) => (
                <li
                  key={item.path}
                  className={location.pathname === item.path ? "selected" : ""}
                >
                  <Link to={item.path}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
