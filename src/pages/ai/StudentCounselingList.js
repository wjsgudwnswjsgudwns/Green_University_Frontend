import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function StudentCounselingList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [counselings, setCounselings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "student") {
      navigate("/");
      return;
    }
    fetchCounselings();
  }, [user, navigate]);

  const fetchCounselings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/counseling/student/${user.id}`);
      setCounselings(response.data || []);
    } catch (err) {
      console.error("상담 내역 조회 실패:", err);
      setError("상담 내역을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getCounselingTypeLabel = (type) => {
    const types = {
      학업: "학업",
      정서: "정서",
      가정: "가정",
      경력: "진로/경력",
      기타: "기타",
    };
    return types[type] || type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="counseling-page-container">
        <div className="counseling-loading-container">
          <div className="counseling-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="counseling-page-container">
      <aside className="counseling-side-menu">
        <div className="counseling-side-menu-header">
          <h2>상담</h2>
        </div>
        <nav className="counseling-side-menu-nav">
          <Link
            to="/student/counseling/list"
            className="counseling-menu-item active"
          >
            상담 내역
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <h1>내 상담 내역</h1>
        <div className="counseling-divider"></div>

        {error && <div className="counseling-error-message">{error}</div>}

        <div className="counseling-info-box">
          <p>
            상담 내역은 교수님 또는 직원과의 상담 기록입니다. 궁금한 사항이
            있으시면 담당 교수님께 문의해주세요.
          </p>
        </div>

        {counselings.length === 0 ? (
          <div className="counseling-empty-state">
            <p>아직 상담 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="counseling-table-container">
            <table className="counseling-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>상담 제목</th>
                  <th>상담 유형</th>
                  <th>상담자</th>
                  <th>상담 일자</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {counselings.map((counseling, index) => (
                  <tr
                    key={counseling.id}
                    onClick={() =>
                      navigate(`/student/counseling/${counseling.id}`)
                    }
                    className="counseling-table-row-clickable"
                  >
                    <td>{counselings.length - index}</td>
                    <td className="counseling-title-cell">
                      {counseling.title}
                    </td>
                    <td>
                      <span className="counseling-type-badge">
                        {getCounselingTypeLabel(counseling.counselingType)}
                      </span>
                    </td>
                    <td>{counseling.counselorName}</td>
                    <td>{formatDate(counseling.counselingDate)}</td>
                    <td>{formatDate(counseling.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="counseling-stats">
          <div className="counseling-stat-card">
            <div className="counseling-stat-content">
              <span className="counseling-stat-label">총 상담 횟수</span>
              <span className="counseling-stat-value">
                {counselings.length}회
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
