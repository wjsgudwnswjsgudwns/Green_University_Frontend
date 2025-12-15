import React, { useState, useEffect, useRef } from "react";
import {
  getUnreadNotifications,
  getAllNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteAllNotifications,
} from "../api/notificationApi";
import "../styles/notification.css";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const notificationRef = useRef(null);

  // 알림 목록 및 개수 조회
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [allNotifications, count] = await Promise.all([
        getAllNotifications(),
        getUnreadCount(),
      ]);
      setNotifications(allNotifications);
      setUnreadCount(count);
    } catch (error) {
      console.error("알림 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 및 주기적으로 알림 조회 (페이지 포커스 시에만)
  useEffect(() => {
    // 초기 로드 시 한 번 조회
    fetchNotifications();

    let interval = null;

    // 페이지 포커스 상태 확인 함수
    const isPageFocused = () => {
      return document.hasFocus() && !document.hidden;
    };

    // 폴링 시작/중지 함수
    const startPolling = () => {
      if (!interval && isPageFocused()) {
        interval = setInterval(() => {
          // 폴링 전에 다시 포커스 확인
          if (isPageFocused()) {
            fetchNotifications();
          } else {
            // 포커스가 없으면 interval 정리
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
          }
        }, 30000); // 30초마다 갱신
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // 페이지 포커스/블러 핸들러
    const handleFocus = () => {
      if (isPageFocused()) {
        fetchNotifications(); // 포커스 시 즉시 조회
        startPolling();
      }
    };

    const handleBlur = () => {
      stopPolling();
    };

    // 페이지 가시성 변경 핸들러
    const handleVisibilityChange = () => {
      if (isPageFocused()) {
        fetchNotifications();
        startPolling();
      } else {
        stopPolling();
      }
    };

    // 초기 상태 확인
    if (isPageFocused()) {
      startPolling();
    }

    // 이벤트 리스너 등록
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // cleanup
    return () => {
      stopPolling();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 외부 클릭 시 알림 목록 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // 알림 클릭 시 읽음 처리
  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("알림 읽음 처리 실패:", error);
      }
    }
  };

  // 모두 읽음 처리
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("모두 읽음 처리 실패:", error);
    }
  };

  // 모든 알림 삭제 (비우기)
  const handleDeleteAll = async () => {
    if (window.confirm("모든 알림을 삭제하시겠습니까?")) {
      try {
        await deleteAllNotifications();
        setNotifications([]);
        setUnreadCount(0);
      } catch (error) {
        console.error("알림 삭제 실패:", error);
        alert("알림 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR");
  };

  return (
    <div className="notification-wrapper" ref={notificationRef}>
      <button
        className="notification-bell-button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
          }
        }}
        aria-label="알림"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9C5 14.25 2 16 2 16H22C22 16 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 21C9 22.1 9.9 23 11 23H13C14.1 23 15 22.1 15 21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>알림</h3>
            <div className="notification-header-buttons">
              {unreadCount > 0 && (
                <button
                  className="mark-all-read-button"
                  onClick={handleMarkAllAsRead}
                >
                  모두 읽음
                </button>
              )}
              {notifications.length > 0 && (
                <button className="clear-all-button" onClick={handleDeleteAll}>
                  비우기
                </button>
              )}
            </div>
          </div>
          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">로딩 중...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">아무 소식이 없습니다</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${
                    !notification.isRead ? "unread" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <p className="notification-message">
                      {notification.message}
                    </p>
                    <span className="notification-time">
                      {formatDate(notification.createdAt)}
                    </span>
                  </div>
                  {!notification.isRead && (
                    <div className="notification-dot"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
