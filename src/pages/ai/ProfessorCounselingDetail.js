import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function ProfessorCounselingDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [counseling, setCounseling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "professor") {
      navigate("/");
      return;
    }
    fetchCounselingDetail();
  }, [user, navigate, id]);

  const fetchCounselingDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/counseling/${id}`);

      // 본인이 작성한 상담 기록인지 확인
      if (
        response.data.counselorId !== user.id ||
        response.data.counselorType !== "PROFESSOR"
      ) {
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

  const getRiskLevelInfo = (analysis) => {
    if (!analysis) return null;

    const level = analysis.riskLevel;
    const score = analysis.riskScore;

    let className = "counseling-risk-level-card";
    let icon = "";
    let label = "";
    let description = "";

    if (level === "HIGH" || score >= 70) {
      className += " counseling-risk-level-high";
      icon = "warning";
      label = "고위험";
      description = "즉각적인 개입이 필요합니다";
    } else if (level === "MEDIUM" || score >= 40) {
      className += " counseling-risk-level-medium";
      icon = "priority_high";
      label = "중위험";
      description = "지속적인 모니터링이 필요합니다";
    } else {
      className += " counseling-risk-level-low";
      icon = "check_circle";
      label = "저위험";
      description = "안정적인 상태입니다";
    }

    return { className, icon, label, description, score };
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
          <span className="counseling-error-icon material-symbols-outlined">
            error
          </span>
          <p>{error || "상담 내역을 찾을 수 없습니다."}</p>
          <button
            onClick={() => navigate("/professor/counseling/list")}
            className="counseling-back-button"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const riskInfo = counseling.analysis
    ? getRiskLevelInfo(counseling.analysis)
    : null;

  return (
    <div className="counseling-page-container">
      <aside className="counseling-side-menu">
        <div className="counseling-side-menu-header">
          <h2>상담 관리</h2>
        </div>
        <nav className="counseling-side-menu-nav">
          <Link
            to="/professor/counseling/list"
            className="counseling-menu-item active"
          >
            상담 내역
          </Link>
          <Link
            to="/professor/counseling/form"
            className="counseling-menu-item"
          >
            상담 기록 작성
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <div className="counseling-header-actions">
          <h1>상담 상세 및 AI 분석</h1>
          <button
            onClick={() => navigate("/professor/counseling/list")}
            className="counseling-list-button"
          >
            <span className="material-symbols-outlined">list</span>
            목록
          </button>
        </div>
        <div className="counseling-divider"></div>

        <div className="counseling-detail-container">
          {/* AI 위험도 분석 결과 */}
          {riskInfo && (
            <div className={riskInfo.className}>
              <div className="counseling-risk-header">
                <div className="counseling-risk-icon-wrapper">
                  <span className="material-symbols-outlined">
                    {riskInfo.icon}
                  </span>
                </div>
                <div className="counseling-risk-info">
                  <h2>중도이탈 위험도: {riskInfo.label}</h2>
                  <p>{riskInfo.description}</p>
                </div>
                <div className="counseling-risk-score">
                  <span className="counseling-risk-score-value">
                    {riskInfo.score}
                  </span>
                  <span className="counseling-risk-score-label">점</span>
                </div>
              </div>
            </div>
          )}

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
                <span className="counseling-info-label">
                  <span className="material-symbols-outlined">person</span>
                  학생
                </span>
                <span className="counseling-info-value">
                  {counseling.studentName}
                </span>
              </div>

              <div className="counseling-info-row">
                <span className="counseling-info-label">
                  <span className="material-symbols-outlined">
                    calendar_today
                  </span>
                  상담 일자
                </span>
                <span className="counseling-info-value">
                  {formatDate(counseling.counselingDate)}
                </span>
              </div>

              <div className="counseling-info-row">
                <span className="counseling-info-label">
                  <span className="material-symbols-outlined">schedule</span>
                  등록 일시
                </span>
                <span className="counseling-info-value">
                  {formatDateTime(counseling.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* 상담 내용 */}
          <div className="counseling-detail-card">
            <div className="counseling-detail-section-header">
              <span className="material-symbols-outlined">description</span>
              <h3>상담 내용</h3>
            </div>
            <div className="counseling-content-box">{counseling.content}</div>
          </div>

          {/* AI 분석 결과 상세 */}
          {counseling.analysis && (
            <>
              <div className="counseling-detail-card counseling-ai-card">
                <div className="counseling-detail-section-header">
                  <span className="material-symbols-outlined">psychology</span>
                  <h3>AI 분석 - 주요 위험 요인</h3>
                </div>
                <div className="counseling-ai-factors">
                  {counseling.analysis.mainFactors?.map((factor, index) => (
                    <div key={index} className="counseling-ai-factor-item">
                      <span className="counseling-ai-factor-number">
                        {index + 1}
                      </span>
                      <span className="counseling-ai-factor-text">
                        {factor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="counseling-detail-card counseling-ai-card">
                <div className="counseling-detail-section-header">
                  <span className="material-symbols-outlined">lightbulb</span>
                  <h3>AI 권장 조치사항</h3>
                </div>
                <div className="counseling-ai-actions">
                  {counseling.analysis.recommendedActions?.map(
                    (action, index) => (
                      <div key={index} className="counseling-ai-action-item">
                        <span className="material-symbols-outlined">
                          check_circle
                        </span>
                        <span>{action}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="counseling-info-box counseling-ai-info">
                <span className="counseling-info-icon material-symbols-outlined">
                  info
                </span>
                <p>
                  AI 분석 결과는 교수/직원만 확인할 수 있으며, 학생에게는
                  공개되지 않습니다. 분석 일시:{" "}
                  {formatDateTime(counseling.analysis.analysisDate)}
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
