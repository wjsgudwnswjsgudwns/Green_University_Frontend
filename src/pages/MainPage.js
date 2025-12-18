import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles/mainPage.css";
import banner1 from "../images/Green_University_FrontView.png";
import banner2 from "../images/Meeting_3_people.png";
import banner3 from "../images/Principal.png";
import banner4 from "../images/Meeting_5_people.png";
import QuickLinks from "../components/QuickLinks";

export default function MainPage() {
  const { user, logout } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [notices, setNotices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // 공지사항 및 학사일정 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 공지사항 최근 4개 가져오기
        const noticeResponse = await api.get("/api/notice", {
          params: { page: 0 },
        });
        const noticeList = noticeResponse.data.content || [];
        setNotices(noticeList.slice(0, 4)); // 최대 4개만

        // 학사일정 전체 가져오기
        const scheduleResponse = await api.get("/api/schedule");
        const scheduleList = scheduleResponse.data || [];

        // ID 기준 내림차순 정렬 (최신순) 후 최대 3개만
        const sortedSchedules = [...scheduleList]
          .sort((a, b) => (b.id || 0) - (a.id || 0))
          .slice(0, 3);
        setSchedules(sortedSchedules);
      } catch (error) {
        console.error("데이터 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  // 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
  const formatDate = (dateString) => {
    if (!dateString) return "";
    if (dateString.includes("T")) {
      return dateString.split("T")[0].replace(/-/g, ".");
    }
    return dateString.replace(/-/g, ".");
  };

  // 학사일정 날짜에서 월/일 추출
  const getMonthDay = (dateString) => {
    if (!dateString) return { month: "01", day: "01" };
    let month, day;

    if (dateString.match(/^\d{2}-\d{2}/)) {
      // MM-DD 형식
      month = dateString.substring(0, 2);
      day = dateString.substring(3, 5);
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      // YYYY-MM-DD 형식
      month = dateString.substring(5, 7);
      day = dateString.substring(8, 10);
    } else {
      month = "01";
      day = "01";
    }

    return { month, day };
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
        {/* 프로필 카드 - 왼쪽 상단 */}
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
        </div>

        {/* 빠른 메뉴 - 오른쪽 상단 */}
        <div className="quick-links-column">
          <QuickLinks />
        </div>

        {/* 공지사항 & 학사일정 - 하단 전체 */}
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
              {loading ? (
                <div className="loading-text">로딩 중...</div>
              ) : notices.length === 0 ? (
                <div className="empty-text">공지사항이 없습니다.</div>
              ) : (
                notices.map((notice) => (
                  <Link
                    key={notice.id}
                    to={`/board/notice/${notice.id}`}
                    className="notice-item"
                  >
                    <span className="notice-title">{notice.title}</span>
                    <span className="notice-date">
                      {formatDate(notice.createdTime)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* 학사일정 섹션 */}
          <div ref={scheduleRef} className="content-section fade-in-section">
            <div className="section-header">
              <h2>학사일정</h2>
              <Link to="/schedule" className="more-link">
                더보기 +
              </Link>
            </div>
            <div className="schedule-list">
              {loading ? (
                <div className="loading-text">로딩 중...</div>
              ) : schedules.length === 0 ? (
                <div className="empty-text">학사일정이 없습니다.</div>
              ) : (
                schedules.map((schedule) => {
                  const { month, day } = getMonthDay(schedule.startDay);
                  return (
                    <Link
                      key={schedule.id}
                      to={`/schedule/${schedule.id}`}
                      className="schedule-item"
                    >
                      <div className="schedule-date">
                        <span className="month">{month}</span>
                        <span className="day">{day}</span>
                      </div>
                      <div className="schedule-content">
                        <h3>{schedule.information}</h3>
                        <p>
                          {schedule.startDay && schedule.endDay
                            ? `${schedule.startDay} ~ ${schedule.endDay}`
                            : schedule.startDay || ""}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
