// src/pages/MeetingListPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles/meetingList.css";

function formatDateTime(dt) {
  if (!dt) return { date: "-", time: "-" };
  const date = new Date(dt);
  return {
    date: date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function MeetingListPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/meetings");
      setMeetings(res.data || []);
    } catch (err) {
      console.error(err);
      setError("회의 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleRowClick = (meetingId) => {
    navigate(`/meetings/${meetingId}`);
  };

  const getMeetingTypeClass = (type) => {
    return type === "INSTANT" ? "mlp-type-instant" : "mlp-type-scheduled";
  };

  const getMeetingTypeText = (type) => {
    return type === "INSTANT" ? "즉시 회의" : "예약 회의";
  };

  const getStatusClass = (status) => {
    const statusMap = {
      ACTIVE: "mlp-status-active",
      SCHEDULED: "mlp-status-scheduled",
      ENDED: "mlp-status-ended",
    };
    return statusMap[status] || "mlp-status-ended";
  };

  const getStatusText = (status) => {
    const statusMap = {
      ACTIVE: "진행중",
      SCHEDULED: "예정",
      ENDED: "종료",
    };
    return statusMap[status] || status;
  };

  return (
    <div className="mlp-page-container">
      {/* 헤더 */}
      <div className="mlp-header">
        <h2 className="mlp-title">나의 회의 목록</h2>
        <button
          className="mlp-create-btn"
          onClick={() => navigate("/meetings/create")}
        >
          새 회의 만들기
        </button>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="mlp-loading">
          <div className="mlp-loading-spinner"></div>
          <p>회의 목록을 불러오는 중...</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mlp-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && !error && meetings.length === 0 && (
        <div className="mlp-empty-state">
          <span className="material-symbols-outlined">
            video_camera_front_off
          </span>
          <p>생성하거나 예약한 회의가 없습니다.</p>
        </div>
      )}

      {/* 회의 테이블 */}
      {!loading && !error && meetings.length > 0 && (
        <div className="mlp-table-container">
          <table className="mlp-table">
            <thead>
              <tr>
                <th></th>
                <th>제목</th>
                <th>유형</th>
                <th>시작시간</th>
                <th>종료시간</th>
                <th>상태</th>
                <th>방 번호</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const startDT = formatDateTime(m.startAt);
                const endDT = formatDateTime(m.endAt);

                return (
                  <tr
                    key={m.meetingId}
                    onClick={() => handleRowClick(m.meetingId)}
                  >
                    <td>
                      <strong>{m.title || "회의"}</strong>
                    </td>
                    <td>
                      <span
                        className={`mlp-type-badge ${getMeetingTypeClass(
                          m.type
                        )}`}
                      >
                        {getMeetingTypeText(m.type)}
                      </span>
                    </td>
                    <td>
                      <div className="mlp-datetime">
                        <span className="mlp-date">{startDT.date}</span>
                        <span className="mlp-time">{startDT.time}</span>
                      </div>
                    </td>
                    <td>
                      <div className="mlp-datetime">
                        <span className="mlp-date">{endDT.date}</span>
                        <span className="mlp-time">{endDT.time}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`mlp-status-badge ${getStatusClass(
                          m.status
                        )}`}
                      >
                        {getStatusText(m.status)}
                      </span>
                    </td>
                    <td>
                      <strong>{m.roomNumber || "-"}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MeetingListPage;
