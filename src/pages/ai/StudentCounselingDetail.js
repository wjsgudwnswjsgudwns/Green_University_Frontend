import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function StudentCounselingDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [counseling, setCounseling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "student") {
      navigate("/");
      return;
    }
    fetchCounselingDetail();
  }, [user, navigate, id]);

  const fetchCounselingDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/counseling/${id}`);

      // 본인의 상담 기록인지 확인
      if (response.data.studentId !== user.id) {
        setError("접근 권한이 없습니다.");
        return;
      }

      setCounseling(response.data);
    } catch (err) {
      console.error("상담 상세 조회 실패:", err);
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
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
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

  if (error || !counseling) {
    return (
      <div className="counseling-page-container">
        <div className="counseling-error-container">
          <p>{error || "상담 내역을 찾을 수 없습니다."}</p>
          <button
            onClick={() => navigate("/student/counseling/list")}
            className="counseling-back-button"
          >
            목록으로 돌아가기
          </button>
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
        <div className="counseling-header-actions">
          <h1>상담 상세</h1>
          <button
            onClick={() => navigate("/student/counseling/list")}
            className="counseling-list-button"
          >
            목록
          </button>
        </div>
        <div className="counseling-divider"></div>

        <div className="counseling-detail-container">
          {/* 상담 기본 정보 */}
          <div className="counseling-detail-card">
            <div className="counseling-detail-header">
              <h2>{counseling.title}</h2>
              <span className="counseling-type-badge counseling-type-badge-large">
                {getCounselingTypeLabel(counseling.counselingType)}
              </span>
            </div>

            <div className="counseling-detail-info">
              <div className="counseling-info-row">
                <span className="counseling-info-label">상담자</span>
                <span className="counseling-info-value">
                  {counseling.counselorName}(
                  {counseling.counselorType === "PROFESSOR" ? "교수" : "직원"})
                </span>
              </div>

              <div className="counseling-info-row">
                <span className="counseling-info-label">상담 일자</span>
                <span className="counseling-info-value">
                  {formatDate(counseling.counselingDate)}
                </span>
              </div>

              <div className="counseling-info-row">
                <span className="counseling-info-label">등록 일시</span>
                <span className="counseling-info-value">
                  {formatDateTime(counseling.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* 상담 내용 */}
          <div className="counseling-detail-card">
            <div className="counseling-detail-section-header">
              <h3>상담 내용</h3>
            </div>
            <div className="counseling-content-box">{counseling.content}</div>
          </div>

          {/* 안내 메시지 */}
          <div className="counseling-info-box">
            <p>
              상담 내용과 관련하여 추가 문의사항이 있으시면
              <strong> {counseling.counselorName}</strong>님께 연락해주세요.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
