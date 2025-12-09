import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom"; // useNavigate 추가
import { useAuth } from "../context/AuthContext";
import "../styles/header.css";
import logo from "../images/GU1-Headear.png";

export default function Header() {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // 드롭다운 상태 추가
  const navigate = useNavigate(); // navigate 훅 추가

  // 드롭다운 토글 함수
  const toggleDropdown = () => {
    setIsDropdownOpen((prevState) => !prevState);
  };

  // 로그아웃 처리 함수
  const handleLogout = () => {
    logout();
    navigate("/"); // 로그아웃 후 홈으로 이동
    setIsDropdownOpen(false); // 드롭다운 닫기
  };

  // MY 페이지 경로 설정
  let myPagePath = "/";
  if (user) {
    switch (user.userRole) {
      case "student":
        myPagePath = "/student/info";
        break;
      case "professor":
        myPagePath = "/professor/info";
        break;
      case "staff":
      default:
        myPagePath = "/staff/info";
        break;
    }
  }

  let menuItems = [];
  if (user) {
    switch (user.userRole) {
      case "student":
        menuItems = [
          // { label: "홈", path: "/" },
          // { label: "MY", path: "/student/info" }, // MY는 드롭다운으로 이동
          { label: "수업", path: "/subject/list/1" },
          { label: "수강신청", path: "/sugang/subjectlist" },
          { label: "성적", path: "/grade/thisSemester" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
      case "professor":
        menuItems = [
          // { label: "홈", path: "/" },
          // { label: "MY", path: "/professor/info" }, // MY는 드롭다운으로 이동
          { label: "수업", path: "/subject/list/:page" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
      case "staff":
      default:
        menuItems = [
          // { label: "홈", path: "/" },
          // { label: "MY", path: "/staff/info" }, // MY는 드롭다운으로 이동
          { label: "학사관리", path: "/staff/student-list/" },
          { label: "등록", path: "/staff/admin/college" },
          { label: "학사정보", path: "/board/notice" },
        ];
        break;
    }
  }

  // 로그인 시 'main-menu-logged-in' 클래스를 추가하여 간격 균일 분배
  const mainMenuClass = user ? "main-menu main-menu-logged-in" : "main-menu";

  return (
    <header className="header">
      <nav className={mainMenuClass}>
        <Link to="/" className="logo-link">
          <img src={logo} alt="로고"></img>
        </Link>
        {user && (
          <>
            <ul className="nav-items">
              {menuItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <Link to={item.path}>{item.label}</Link>
                </li>
              ))}
            </ul>

            {/* 사용자 이름 및 드롭다운 메뉴 */}
            <div className="user-menu-wrapper">
              <button
                className="user-name-button"
                onClick={toggleDropdown}
                aria-expanded={isDropdownOpen}
              >
                {/* 유저의 이름은 user 객체의 userName 속성으로 가정합니다. */}
                <span className="user-name-text">{user.name}님</span>
              </button>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  {/* 마이페이지 링크 */}
                  <Link
                    to={myPagePath}
                    className="dropdown-item"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    마이페이지
                  </Link>
                  {/* 로그아웃 버튼 */}
                  <button
                    onClick={handleLogout}
                    className="dropdown-item link-button"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
