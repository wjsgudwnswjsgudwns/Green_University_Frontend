import React, { useState, useEffect } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/counseling.css";

export default function StaffCounselingStudentDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();

  const [riskDetail, setRiskDetail] = useState(null);
  const [counselings, setCounselings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const year = parseInt(searchParams.get("year")) || new Date().getFullYear();
  const semester =
    parseInt(searchParams.get("semester")) ||
    (new Date().getMonth() <= 6 ? 1 : 2);

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchStudentRiskDetail();
    fetchStudentCounselings();
  }, [user, navigate, studentId, year, semester]);

  const fetchStudentRiskDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/api/counseling/risk/student/${studentId}`,
        {
          params: { year, semester },
        }
      );
      setRiskDetail(response.data);
    } catch (err) {
      console.error("학생 위험도 조회 실패:", err);
      setError("학생 위험도 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentCounselings = async () => {
    try {
      const response = await api.get(`/api/counseling/student/${studentId}`);
      setCounselings(response.data || []);
    } catch (err) {
      console.error("상담 내역 조회 실패:", err);
    }
  };

  const getRiskLevelInfo = (level, score) => {
    if (score >= 80) {
      return {
        className: "counseling-risk-level-card counseling-risk-level-critical",
        icon: "error",
        label: "긴급",
        description: "즉각적인 개입이 필요합니다",
      };
    } else if (score >= 70) {
      return {
        className: "counseling-risk-level-card counseling-risk-level-high",
        icon: "warning",
        label: "고위험",
        description: "즉시 개입이 필요합니다",
      };
    } else if (score >= 60) {
      return {
        className: "counseling-risk-level-card counseling-risk-level-medium",
        icon: "priority_high",
        label: "중위험",
        description: "지속적인 모니터링이 필요합니다",
      };
    } else {
      return {
        className: "counseling-risk-level-card counseling-risk-level-low",
        icon: "",
        label: "저위험",
        description: "안정적인 상태입니다",
      };
    }
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

  if (error || !riskDetail) {
    return (
      <div className="counseling-page-container">
        <div className="counseling-error-container">
          <p>{error || "학생 정보를 찾을 수 없습니다."}</p>
          <button
            onClick={() => navigate("/staff/counseling/dashboard")}
            className="counseling-back-button"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const riskInfo = getRiskLevelInfo(
    riskDetail.riskLevel,
    riskDetail.totalRiskScore
  );

  return (
    <div className="counseling-page-container">
      <aside className="counseling-side-menu">
        <div className="counseling-side-menu-header">
          <h2>중도탈락 관리</h2>
        </div>
        <nav className="counseling-side-menu-nav">
          <Link
            to="/staff/counseling/dashboard"
            className="counseling-menu-item"
          >
            고위험 학생 현황
          </Link>
          <Link
            to="/staff/counseling/statistics"
            className="counseling-menu-item"
          >
            학과별 통계
          </Link>
        </nav>
      </aside>

      <main className="counseling-main-content">
        <div className="counseling-header-actions">
          <h1>학생 위험도 상세 분석</h1>
          <button
            onClick={() => navigate("/staff/counseling/dashboard")}
            className="counseling-list-button"
          >
            돌아가기
          </button>
        </div>
        <div className="counseling-divider"></div>

        <div className="counseling-detail-container">
          {/* 종합 위험도 카드 */}
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
                  {riskDetail.totalRiskScore}
                </span>
                <span className="counseling-risk-score-label">점</span>
              </div>
            </div>
          </div>

          {/* 학생 기본 정보 */}
          <div className="counseling-detail-card">
            <div className="counseling-detail-header">
              <h2>학생 정보</h2>
            </div>
            <div className="counseling-detail-info">
              <div className="counseling-info-row">
                <span className="counseling-info-label">이름</span>
                <span className="counseling-info-value">
                  {riskDetail.studentName}
                </span>
              </div>
              <div className="counseling-info-row">
                <span className="counseling-info-label">학번</span>
                <span className="counseling-info-value">
                  {riskDetail.studentId}
                </span>
              </div>
              <div className="counseling-info-row">
                <span className="counseling-info-label">학과</span>
                <span className="counseling-info-value">
                  {riskDetail.departmentName}
                </span>
              </div>
              <div className="counseling-info-row">
                <span className="counseling-info-label">분석 학기</span>
                <span className="counseling-info-value">
                  {riskDetail.year}년 {riskDetail.semester}학기
                </span>
              </div>
            </div>
          </div>

          {/* 위험도 상세 분석 */}
          <div className="counseling-detail-card">
            <div className="counseling-detail-section-header">
              <h3>위험도 상세 분석</h3>
            </div>

            <div className="counseling-risk-breakdown">
              <div className="counseling-risk-item">
                <div className="counseling-risk-item-header">
                  <h4>성적 기반 위험도</h4>
                </div>
                <div className="counseling-risk-item-score">
                  <span className="counseling-score-large">
                    {riskDetail.gradeRiskScore}
                  </span>
                  <span className="counseling-score-label">점</span>
                </div>
                <div className="counseling-risk-item-bar">
                  <div
                    className="counseling-risk-item-bar-fill counseling-risk-grade"
                    style={{ width: `${riskDetail.gradeRiskScore}%` }}
                  ></div>
                </div>
                <p className="counseling-risk-item-desc">
                  학업 성취도, 평균 학점, F학점 개수 등을 종합 평가
                </p>
              </div>

              <div className="counseling-risk-item">
                <div className="counseling-risk-item-header">
                  <h4>출석 기반 위험도</h4>
                </div>
                <div className="counseling-risk-item-score">
                  <span className="counseling-score-large">
                    {riskDetail.attendanceRiskScore}
                  </span>
                  <span className="counseling-score-label">점</span>
                </div>
                <div className="counseling-risk-item-bar">
                  <div
                    className="counseling-risk-item-bar-fill counseling-risk-attendance"
                    style={{ width: `${riskDetail.attendanceRiskScore}%` }}
                  ></div>
                </div>
                <p className="counseling-risk-item-desc">
                  결석 횟수, 지각 빈도 등 출석 패턴 분석
                </p>
              </div>

              <div className="counseling-risk-item">
                <div className="counseling-risk-item-header">
                  <h4>상담 기반 위험도 (AI 분석)</h4>
                </div>
                <div className="counseling-risk-item-score">
                  <span className="counseling-score-large">
                    {riskDetail.counselingRiskScore}
                  </span>
                  <span className="counseling-score-label">점</span>
                </div>
                <div className="counseling-risk-item-bar">
                  <div
                    className="counseling-risk-item-bar-fill counseling-risk-counseling"
                    style={{ width: `${riskDetail.counselingRiskScore}%` }}
                  ></div>
                </div>
                <p className="counseling-risk-item-desc">
                  상담 내용을 AI가 분석하여 심리적, 정서적 위험 요인 평가
                </p>
              </div>
            </div>
          </div>

          {/* 최근 상담 정보 */}
          {riskDetail.lastCounselingDate && (
            <div className="counseling-detail-card">
              <div className="counseling-detail-section-header">
                <h3>최근 상담 정보</h3>
              </div>
              <div className="counseling-detail-info">
                <div className="counseling-info-row">
                  <span className="counseling-info-label">최근 상담일</span>
                  <span className="counseling-info-value">
                    {formatDate(riskDetail.lastCounselingDate)}
                  </span>
                </div>
                <div className="counseling-info-row">
                  <span className="counseling-info-label">상담 유형</span>
                  <span className="counseling-info-value">
                    <span className="counseling-type-badge">
                      {getCounselingTypeLabel(riskDetail.lastCounselingType)}
                    </span>
                  </span>
                </div>
                <div className="counseling-info-row">
                  <span className="counseling-info-label">마지막 업데이트</span>
                  <span className="counseling-info-value">
                    {formatDateTime(riskDetail.lastUpdated)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 상담 이력 */}
          <div className="counseling-detail-card">
            <div className="counseling-detail-section-header">
              <h3>상담 이력 ({counselings.length}건)</h3>
            </div>

            {counselings.length > 0 ? (
              <div className="counseling-history-list">
                {counselings.slice(0, 5).map((counseling) => (
                  <div key={counseling.id} className="counseling-history-item">
                    <div className="counseling-history-date">
                      {formatDate(counseling.counselingDate)}
                    </div>
                    <div className="counseling-history-content">
                      <div className="counseling-history-title">
                        {counseling.title}
                      </div>
                      <div className="counseling-history-meta">
                        <span className="counseling-type-badge">
                          {getCounselingTypeLabel(counseling.counselingType)}
                        </span>
                        <span>상담자: {counseling.counselorName}</span>
                        {counseling.analysis && (
                          <span className="counseling-risk-badge counseling-risk-small">
                            위험도: {counseling.analysis.riskScore}점
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="counseling-empty-text">상담 이력이 없습니다.</p>
            )}
          </div>

          {/* 권장 조치사항 */}
          <div className="counseling-info-box counseling-recommendation-box">
            <div>
              <h4>권장 조치사항</h4>
              {riskDetail.totalRiskScore >= 80 ? (
                <ul>
                  <li>
                    즉시 학생과 면담을 실시하고 긴급 지원 방안을 모색하세요
                  </li>
                  <li>담당 교수 및 학과장에게 상황을 보고하세요</li>
                  <li>
                    학생상담센터, 장학 담당부서 등과 협력하여 종합적 지원을
                    제공하세요
                  </li>
                  <li>매주 모니터링을 실시하고 개선 여부를 확인하세요</li>
                </ul>
              ) : riskDetail.totalRiskScore >= 70 ? (
                <ul>
                  <li>학생과의 심층 상담을 통해 문제 원인을 파악하세요</li>
                  <li>필요한 지원 프로그램(멘토링, 튜터링 등)을 안내하세요</li>
                  <li>2주마다 정기적인 모니터링을 진행하세요</li>
                  <li>가족 또는 보호자 연락을 고려하세요</li>
                </ul>
              ) : riskDetail.totalRiskScore >= 60 ? (
                <ul>
                  <li>학생과 상담을 통해 어려움을 확인하세요</li>
                  <li>학업 관리 방법이나 시간 관리 교육을 제공하세요</li>
                  <li>월 1회 정기적인 상태 확인을 진행하세요</li>
                </ul>
              ) : (
                <ul>
                  <li>현재 안정적인 상태이나 정기적인 모니터링을 유지하세요</li>
                  <li>학기별로 상태를 점검하세요</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
