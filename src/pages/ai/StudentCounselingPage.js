import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/studentCounseling.css";
import api from "../../api/axiosConfig";

export default function StudentCounselingPage() {
  const { user } = useAuth();
  const [counselings, setCounselings] = useState([]);
  const [upcomingCounselings, setUpcomingCounselings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming"); // upcoming, all

  useEffect(() => {
    if (user && user.id) {
      fetchCounselings();
    }
  }, [user]);

  const fetchCounselings = async () => {
    try {
      setLoading(true);
      setError("");

      // 예정된 상담 일정 조회
      const upcomingResponse = await api.get(
        `/api/ai-counseling/student/${user.id}/upcoming`
      );

      // 전체 상담 일정 조회
      const allResponse = await api.get(
        `/api/ai-counseling/student/${user.id}`
      );

      if (upcomingResponse.data.code === 1) {
        setUpcomingCounselings(upcomingResponse.data.data || []);
      }

      if (allResponse.data.code === 1) {
        setCounselings(allResponse.data.data || []);
      }
    } catch (err) {
      console.error("상담 일정 조회 실패:", err);
      setError("상담 일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return "-";
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  const getStatusBadge = (counseling) => {
    if (counseling.isCompleted) {
      return <span className="sc-status-badge sc-status-completed">완료</span>;
    } else {
      const scheduledDate = new Date(counseling.scheduledAt);
      const now = new Date();
      if (scheduledDate < now) {
        return (
          <span className="sc-status-badge sc-status-overdue">미완료</span>
        );
      } else {
        return <span className="sc-status-badge sc-status-upcoming">예정</span>;
      }
    }
  };

  if (loading) {
    return (
      <div className="sc-page-container">
        <div className="sc-loading">
          <div className="sc-loading-spinner"></div>
          <p>상담 일정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const displayCounselings =
    activeTab === "upcoming" ? upcomingCounselings : counselings;

  return (
    <div className="sc-page-container">
      <div className="sc-header">
        <h1 className="sc-title">내 상담 일정</h1>
        <p className="sc-subtitle">
          교수님과의 상담 일정을 확인할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="sc-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* 탭 메뉴 */}
      <div className="sc-tabs">
        <button
          className={`sc-tab ${
            activeTab === "upcoming" ? "sc-tab-active" : ""
          }`}
          onClick={() => setActiveTab("upcoming")}
        >
          예정된 상담
          {upcomingCounselings.length > 0 && (
            <span className="sc-tab-count">{upcomingCounselings.length}</span>
          )}
        </button>
        <button
          className={`sc-tab ${activeTab === "all" ? "sc-tab-active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          전체 상담 내역
          {counselings.length > 0 && (
            <span className="sc-tab-count">{counselings.length}</span>
          )}
        </button>
      </div>

      {/* 상담 일정 리스트 */}
      <div className="sc-counseling-list">
        {displayCounselings.length === 0 ? (
          <div className="sc-empty-state">
            <span className="material-symbols-outlined">event_busy</span>
            <p>
              {activeTab === "upcoming"
                ? "예정된 상담 일정이 없습니다."
                : "상담 내역이 없습니다."}
            </p>
          </div>
        ) : (
          displayCounselings.map((counseling) => (
            <div key={counseling.id} className="sc-counseling-card">
              <div className="sc-card-header">
                <div className="sc-card-subject">
                  <span className="material-symbols-outlined">school</span>
                  <span>{counseling.subject?.name || "과목명 없음"}</span>
                </div>
                {getStatusBadge(counseling)}
              </div>

              <div className="sc-card-body">
                <div className="sc-card-info">
                  <span className="material-symbols-outlined">person</span>
                  <div>
                    <label>담당 교수</label>
                    <span>{counseling.professor?.name || "-"}</span>
                  </div>
                </div>

                <div className="sc-card-info">
                  <span className="material-symbols-outlined">schedule</span>
                  <div>
                    <label>상담 예정 일시</label>
                    <span>{formatDateTime(counseling.scheduledAt)}</span>
                  </div>
                </div>

                {counseling.isCompleted && counseling.completedAt && (
                  <div className="sc-card-info">
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                    <div>
                      <label>상담 완료 일시</label>
                      <span>{formatDateTime(counseling.completedAt)}</span>
                    </div>
                  </div>
                )}

                {counseling.isCompleted && counseling.counselingContent && (
                  <div className="sc-card-content">
                    <label>상담 내용</label>
                    <p>{counseling.counselingContent}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
