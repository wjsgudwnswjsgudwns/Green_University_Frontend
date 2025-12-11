import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/UpdatePeriodPage.css";

const UpdatePeriodPage = () => {
  const navigate = useNavigate();
  const [sugangPeriod, setSugangPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSugangPeriod();
  }, []);

  const fetchSugangPeriod = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/sugang/period");
      setSugangPeriod(response.data.period);
      setError(null);
    } catch (err) {
      console.error("수강 신청 기간 조회 실패:", err);
      setError("수강 신청 기간 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePeriod = async (action) => {
    const confirmMessage =
      action === "start"
        ? "수강 신청 기간을 시작하시겠습니까?"
        : action === "end"
        ? "수강 신청 기간을 종료하시겠습니까?"
        : "수강 신청 기간을 초기화하시겠습니까?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/api/sugang/period/${action}`);
      alert(response.data.message);
      await fetchSugangPeriod();
    } catch (err) {
      console.error("수강 신청 기간 변경 실패:", err);
      alert(
        err.response?.data?.message || "수강 신청 기간 변경에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const getPeriodText = () => {
    switch (sugangPeriod) {
      case 0:
        return "현재 예비 수강 신청 기간입니다.";
      case 1:
        return "현재 수강 신청 기간입니다.";
      case 2:
        return "이번 학기 수강 신청 기간이 종료되었습니다.";
      default:
        return "수강 신청 기간 정보를 확인할 수 없습니다.";
    }
  };

  const getButtonsConfig = () => {
    switch (sugangPeriod) {
      case 0:
        return [
          {
            text: "수강 신청 기간 시작",
            action: "start",
            className: "period-btn-primary",
          },
        ];
      case 1:
        return [
          {
            text: "수강 신청 기간 종료",
            action: "end",
            className: "period-btn-danger",
          },
        ];
      case 2:
        return [
          {
            text: "수강 신청 기간 초기화",
            action: "reset",
            className: "period-btn-warning",
          },
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="period-container">
        <div className="period-sidebar">
          <div className="period-sidebar-header">
            <h2>학사관리</h2>
          </div>
          <div className="period-sidebar-menu">
            <table className="period-menu-table">
              <tbody>
                <tr>
                  <td>
                    <a href="/staff/student-list">학생 명단 조회</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/professor-list">교수 명단 조회</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/register-student">학생 등록</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/register-professor">교수 등록</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/register-staff">직원 등록</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/tuition/bill">등록금 고지서 발송</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/break/list">휴학 처리</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="/staff/course-period"
                      className="period-menu-active"
                    >
                      수강 신청 기간 설정
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <main className="period-main">
          <h1 className="period-title">수강 신청 기간 설정</h1>
          <div className="period-divider"></div>
          <p className="period-message">로딩 중...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="period-container">
        <div className="period-sidebar">
          <div className="period-sidebar-header">
            <h2>학사관리</h2>
          </div>
          <div className="period-sidebar-menu">
            <table className="period-menu-table">
              <tbody>
                <tr>
                  <td>
                    <a href="/staff/student-list">학생 명단 조회</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/professor-list">교수 명단 조회</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/register-student">학생 등록</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/register-professor">교수 등록</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/register-staff">직원 등록</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/tuition/bill">등록금 고지서 발송</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/staff/break/list">휴학 처리</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="/staff/course-period"
                      className="period-menu-active"
                    >
                      수강 신청 기간 설정
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <main className="period-main">
          <h1 className="period-title">수강 신청 기간 설정</h1>
          <div className="period-divider"></div>
          <p className="period-message period-error">{error}</p>
        </main>
      </div>
    );
  }

  const buttonsConfig = getButtonsConfig();

  return (
    <div className="period-container">
      <div className="period-sidebar">
        <div className="period-sidebar-header">
          <h2>학사관리</h2>
        </div>
        <div className="period-sidebar-menu">
          <table className="period-menu-table">
            <tbody>
              <tr>
                <td>
                  <a href="/staff/student-list">학생 명단 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/professor-list">교수 명단 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/register-student">학생 등록</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/register-professor">교수 등록</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/register-staff">직원 등록</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/tuition/bill">등록금 고지서 발송</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/break/list">휴학 처리</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/course-period" className="period-menu-active">
                    수강 신청 기간 설정
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <main className="period-main">
        <h1 className="period-title">수강 신청 기간 설정</h1>
        <div className="period-divider"></div>

        <div className="period-status-box">
          <p className="period-status-text">{getPeriodText()}</p>
        </div>

        {buttonsConfig.length > 0 && (
          <div className="period-button-container">
            {buttonsConfig.map((btn, index) => (
              <button
                key={index}
                type="button"
                className={`period-btn ${btn.className}`}
                onClick={() => handleUpdatePeriod(btn.action)}
                disabled={loading}
              >
                {btn.text}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default UpdatePeriodPage;
