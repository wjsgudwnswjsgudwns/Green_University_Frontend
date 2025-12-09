import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import "../styles/mainPage.css";
import banner1 from "../images/Green_University_FrontView.png";
import banner2 from "../images/Meeting_3_people.png";
import banner3 from "../images/Principal.png";
import banner4 from "../images/Meeting_5_people.png";

export default function MainPage() {
  const { user, logout } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);

  // 애니메이션을 위한 ref
  const noticeRef = useRef(null);
  const scheduleRef = useRef(null);

  const banners = [banner1, banner2, banner3, banner4];

  // 자동 슬라이드
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  // 스크롤 애니메이션
  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: "0px 0px -100px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-in");
        } else {
          entry.target.classList.remove("animate-in");
        }
      });
    }, observerOptions);

    if (noticeRef.current) observer.observe(noticeRef.current);
    if (scheduleRef.current) observer.observe(scheduleRef.current);

    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="main-page page-container">
      {/* 이미지 슬라이더 */}
      <div className="banner-slider">
        <div
          className="slider-track"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {banners.map((banner, index) => (
            <div key={index} className="slide">
              <img src={banner} alt={`배너${index + 1}`} />
            </div>
          ))}
        </div>

        {/* 슬라이드 인디케이터 */}
        <div className="slider-indicators">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`indicator ${currentSlide === index ? "active" : ""}`}
              onClick={() => goToSlide(index)}
              aria-label={`슬라이드 ${index + 1}로 이동`}
            />
          ))}
        </div>
      </div>

      <div className="main-content">
        <div className="main-column">
          {/* 공지사항 섹션 */}
          <div ref={noticeRef} className="content-section fade-in-section">
            <div className="section-header">
              <h2>공지사항</h2>
              <Link to="/board/notice" className="more-link">
                더보기 +
              </Link>
            </div>
            <div className="notice-list">
              <div className="notice-item">
                <span className="notice-title">
                  2024학년도 2학기 기말고사 일정 안내
                </span>
                <span className="notice-date">2024.12.01</span>
              </div>
              <div className="notice-item">
                <span className="notice-title">
                  2025학년도 1학기 수강신청 안내
                </span>
                <span className="notice-date">2024.11.28</span>
              </div>
              <div className="notice-item">
                <span className="notice-title">학생 포털 시스템 점검 안내</span>
                <span className="notice-date">2024.11.25</span>
              </div>
              <div className="notice-item">
                <span className="notice-title">동계방학 도서관 운영 안내</span>
                <span className="notice-date">2024.11.20</span>
              </div>
            </div>
          </div>

          {/* 학사일정 섹션 */}
          <div ref={scheduleRef} className="content-section fade-in-section">
            <div className="section-header">
              <h2>학사일정</h2>
              <Link to="/board/notice" className="more-link">
                더보기 +
              </Link>
            </div>
            <div className="schedule-list">
              <div className="schedule-item">
                <div className="schedule-date">
                  <span className="month">12</span>
                  <span className="day">16</span>
                </div>
                <div className="schedule-content">
                  <h3>기말고사 시작</h3>
                  <p>2024학년도 2학기 기말고사 기간</p>
                </div>
              </div>
              <div className="schedule-item">
                <div className="schedule-date">
                  <span className="month">12</span>
                  <span className="day">23</span>
                </div>
                <div className="schedule-content">
                  <h3>성적 공개</h3>
                  <p>2024학년도 2학기 성적 확인 가능</p>
                </div>
              </div>
              <div className="schedule-item">
                <div className="schedule-date">
                  <span className="month">01</span>
                  <span className="day">03</span>
                </div>
                <div className="schedule-content">
                  <h3>수강신청</h3>
                  <p>2025학년도 1학기 수강신청 시작</p>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                  <button className="profile-btn mypage-btn">마이페이지</button>
                </Link>
                <button
                  className="profile-btn logout-btn"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            </div>
          )}

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
