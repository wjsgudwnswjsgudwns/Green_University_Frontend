import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "../../styles/PersonalizedLearning.css";
import api from "../../api/axiosConfig";

function PersonalizedLearningPage() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchPersonalizedLearning();
  }, [studentId]);

  const fetchPersonalizedLearning = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/personalized-learning/${studentId}`);
      setData(response.data);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm("분석을 새로 생성하시겠습니까?")) return;

    try {
      setLoading(true);
      const response = await api.post(
        `/api/personalized-learning/${studentId}/regenerate`
      );
      setData(response.data);
      alert("분석이 완료되었습니다!");
    } catch (error) {
      console.error("재분석 실패:", error);
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="pl-loading-container">
        <div className="pl-spinner"></div>
        <p>AI가 학습 데이터를 분석하는 중...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="pl-error">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="pl-personalized-learning-page">
      {/* 헤더 */}
      <div className="pl-page-header">
        <div className="pl-header-info">
          <h1>AI 맞춤형 학습 지원</h1>
          <p className="pl-student-info">
            {data.studentName} ({data.departmentName} {data.currentGrade}학년)
          </p>
          <p className="pl-analysis-date">
            마지막 분석: {new Date(data.analysisDate).toLocaleString("ko-KR")}
          </p>
          <p className="pl-auto-analysis-info">
            매달 1일 자동으로 분석이 업데이트됩니다
          </p>
        </div>
        <button className="pl-regenerate-btn" onClick={handleRegenerate}>
          재분석
        </button>
      </div>

      {/* AI 종합 코멘트 */}
      <div className="pl-ai-comment-box">
        <h3>종합 분석</h3>
        <p>{data.aiAnalysisComment}</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="pl-tab-menu">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          학습 현황
        </button>
        <button
          className={activeTab === "recommendations" ? "active" : ""}
          onClick={() => setActiveTab("recommendations")}
        >
          추천 과목
        </button>
        <button
          className={activeTab === "direction" ? "active" : ""}
          onClick={() => setActiveTab("direction")}
        >
          학습 방향
        </button>
        <button
          className={activeTab === "graduation" ? "active" : ""}
          onClick={() => setActiveTab("graduation")}
        >
          졸업 요건
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="pl-tab-content">
        {activeTab === "overview" && (
          <LearningHistoryTab data={data.learningHistory} />
        )}
        {activeTab === "recommendations" && (
          <RecommendationsTab
            majors={data.recommendedMajors}
            electives={data.recommendedElectives}
          />
        )}
        {activeTab === "direction" && (
          <LearningDirectionTab data={data.learningDirection} />
        )}
        {activeTab === "graduation" && (
          <GraduationTab data={data.graduationRequirement} />
        )}
      </div>
    </div>
  );
}

// 학습 현황 탭
function LearningHistoryTab({ data }) {
  return (
    <div className="pl-learning-history-tab">
      <div className="pl-stats-grid">
        <StatCard
          title="전체 평점"
          value={`${data.overallGPA} / 4.5`}
          color="#4CAF50"
        />
        <StatCard
          title="전공 평점"
          value={`${data.majorGPA} / 4.5`}
          color="#2196F3"
        />
        <StatCard
          title="교양 평점"
          value={`${data.electiveGPA} / 4.5`}
          color="#FF9800"
        />
      </div>

      <div className="pl-progress-section">
        <h3>학점 이수 현황</h3>
        <ProgressBar
          label="총 이수 학점"
          current={data.totalCredits}
          max={130}
        />
        <ProgressBar label="전공 학점" current={data.majorCredits} max={65} />
        <ProgressBar
          label="교양 학점"
          current={data.electiveCredits}
          max={35}
        />
      </div>

      <div className="pl-areas-section">
        <div className="pl-strong-areas">
          <h3>강점 분야</h3>
          {data.strongAreas.map((area, idx) => (
            <span key={idx} className="pl-badge pl-badge-success">
              {area}
            </span>
          ))}
        </div>
        <div className="pl-weak-areas">
          <h3>보완 필요 분야</h3>
          {data.weakAreas.map((area, idx) => (
            <span key={idx} className="pl-badge pl-badge-warning">
              {area}
            </span>
          ))}
        </div>
      </div>

      <div className="pl-trend-section">
        <h3>성적 추이</h3>
        <div className={`pl-trend-indicator pl-trend-${data.gradeTrend}`}>
          {data.gradeTrend === "상승추세" && "상승 중"}
          {data.gradeTrend === "유지" && "유지 중"}
          {data.gradeTrend === "하락추세" && "하락 중"}
        </div>
      </div>
    </div>
  );
}

// 추천 과목 탭
function RecommendationsTab({ majors, electives }) {
  return (
    <div className="pl-recommendations-tab">
      <section className="pl-recommendation-section">
        <h3>추천 교양 과목</h3>
        <div className="pl-subject-grid">
          {electives.map((subject) => (
            <SubjectCard key={subject.subjectId} subject={subject} />
          ))}
        </div>
      </section>
    </div>
  );
}

// 과목 카드
function SubjectCard({ subject }) {
  const scoreColor =
    subject.recommendScore >= 80
      ? "#4CAF50"
      : subject.recommendScore >= 60
      ? "#FF9800"
      : "#757575";

  return (
    <div className="pl-subject-card">
      <div className="pl-subject-header">
        <h4>{subject.subjectName}</h4>
        <div
          className="pl-recommend-score"
          style={{ backgroundColor: scoreColor }}
        >
          {subject.recommendScore}점
        </div>
      </div>
      <div className="pl-subject-body">
        <p className="pl-professor">{subject.professorName}</p>
        <p className="pl-credits">{subject.credits}학점</p>
        <p className="pl-capacity">
          {subject.currentStudents}/{subject.capacity}명
        </p>
        <div className="pl-reason-box">
          <strong>추천 이유:</strong>
          <p>{subject.recommendReason}</p>
        </div>
      </div>
    </div>
  );
}

// 학습 방향 탭
function LearningDirectionTab({ data }) {
  return (
    <div className="pl-learning-direction-tab">
      <section className="pl-direction-section">
        <h3>나의 강점</h3>
        <p className="pl-description">{data.strengths}</p>
      </section>

      <section className="pl-direction-section">
        <h3>보완할 점</h3>
        <p className="pl-description">{data.weaknesses}</p>
      </section>

      <section className="pl-direction-section">
        <h3>개선 방향 제안</h3>
        <ul className="pl-suggestion-list">
          {data.improvementSuggestions.map((suggestion, idx) => (
            <li key={idx}>{suggestion}</li>
          ))}
        </ul>
      </section>

      <section className="pl-direction-section">
        <h3>학습 전략</h3>
        <ul className="pl-strategy-list">
          {data.learningStrategies.map((strategy, idx) => (
            <li key={idx}>{strategy}</li>
          ))}
        </ul>
      </section>

      {data.cautions.length > 0 && (
        <section className="pl-direction-section pl-caution">
          <h3>주의 사항</h3>
          <ul className="pl-caution-list">
            {data.cautions.map((caution, idx) => (
              <li key={idx}>{caution}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="pl-direction-section pl-highlight">
        <h3>추천 학습 패턴</h3>
        <p className="pl-pattern">{data.recommendedPattern}</p>
      </section>
    </div>
  );
}

// 졸업 요건 탭
function GraduationTab({ data }) {
  const graduationProgress =
    (data.currentCredits / data.totalRequiredCredits) * 100;

  return (
    <div className="pl-graduation-tab">
      <div className="pl-graduation-status">
        {data.canGraduate ? (
          <div className="pl-graduation-possible">
            <h2>졸업 요건 충족!</h2>
            <p>축하합니다! 졸업에 필요한 모든 학점을 이수하셨습니다.</p>
          </div>
        ) : (
          <div className="pl-graduation-in-progress">
            <h2>졸업까지 {data.semestersToGraduation}학기 남음</h2>
            <p>
              학기당 약 {data.recommendedCreditsPerSemester}학점씩 이수하시면
              됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="pl-graduation-progress">
        <h3>전체 진행률</h3>
        <div className="pl-progress-circle">
          <CircularProgress value={graduationProgress} />
          <span className="pl-progress-text">
            {Math.round(graduationProgress)}%
          </span>
        </div>
      </div>

      <div className="pl-credits-detail">
        <CreditDetailCard
          title="총 학점"
          required={data.totalRequiredCredits}
          completed={data.currentCredits}
          remaining={data.remainingCredits}
        />
        <CreditDetailCard
          title="전공 학점"
          required={data.majorRequiredCredits}
          completed={data.majorCompletedCredits}
          remaining={data.majorRemainingCredits}
        />
        <CreditDetailCard
          title="교양 학점"
          required={data.electiveRequiredCredits}
          completed={data.electiveCompletedCredits}
          remaining={data.electiveRemainingCredits}
        />
      </div>
    </div>
  );
}

// 헬퍼 컴포넌트들
function StatCard({ title, value, icon, color }) {
  return (
    <div className="pl-stat-card" style={{ borderColor: color }}>
      <div className="pl-stat-icon">{icon}</div>
      <div className="pl-stat-content">
        <p className="pl-stat-title">{title}</p>
        <p className="pl-stat-value" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ label, current, max }) {
  const percentage = (current / max) * 100;
  return (
    <div className="pl-progress-bar-container">
      <div className="pl-progress-label">
        <span>{label}</span>
        <span>
          {current} / {max}
        </span>
      </div>
      <div className="pl-progress-bar">
        <div
          className="pl-progress-fill"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

function CreditDetailCard({ title, required, completed, remaining }) {
  const percentage = (completed / required) * 100;
  return (
    <div className="pl-credit-detail-card">
      <h4>{title}</h4>
      <div className="pl-credit-numbers">
        <div>
          <span className="pl-label">필요</span>
          <span className="pl-value">{required}학점</span>
        </div>
        <div>
          <span className="pl-label">이수</span>
          <span className="pl-value">{completed}학점</span>
        </div>
        <div>
          <span className="pl-label">남음</span>
          <span className="pl-value pl-remaining">{remaining}학점</span>
        </div>
      </div>
      <ProgressBar label="" current={completed} max={required} />
    </div>
  );
}

function CircularProgress({ value }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width="140" height="140">
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="#e0e0e0"
        strokeWidth="10"
      />
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="#4CAF50"
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
      />
    </svg>
  );
}

export default PersonalizedLearningPage;
