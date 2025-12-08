import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/common.css";

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
        : "수강 신청 기간을 종료하시겠습니까?";

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

  const getButtonConfig = () => {
    switch (sugangPeriod) {
      case 0:
        return {
          text: "수강 신청 기간 시작",
          action: "start",
          show: true,
        };
      case 1:
        return {
          text: "수강 신청 기간 종료",
          action: "end",
          show: true,
        };
      default:
        return { show: false };
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <div className="sub--menu">
          <div className="sub--menu--top">
            <h2>학사관리</h2>
          </div>
          <div className="sub--menu--mid">
            <table className="sub--menu--table">
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
                    <a href="/staff/course-period" className="selected--menu">
                      수강 신청 기간 설정
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <main>
          <h1>수강 신청 기간 설정</h1>
          <div className="split--div"></div>
          <p className="no--list--p">로딩 중...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <div className="sub--menu">
          <div className="sub--menu--top">
            <h2>학사관리</h2>
          </div>
          <div className="sub--menu--mid">
            <table className="sub--menu--table">
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
                    <a href="/staff/course-period" className="selected--menu">
                      수강 신청 기간 설정
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <main>
          <h1>수강 신청 기간 설정</h1>
          <div className="split--div"></div>
          <p className="no--list--p" style={{ color: "red" }}>
            {error}
          </p>
        </main>
      </div>
    );
  }

  const buttonConfig = getButtonConfig();

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 세부 메뉴 div */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>학사관리</h2>
        </div>
        {/* 메뉴 */}
        <div className="sub--menu--mid">
          <table className="sub--menu--table">
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
                  <a href="/staff/course-period" className="selected--menu">
                    수강 신청 기간 설정
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 div */}
      <main>
        <h1>수강 신청 기간 설정</h1>
        <div className="split--div"></div>

        <p className="no--list--p">{getPeriodText()}</p>

        {buttonConfig.show && (
          <>
            <br />
            <button
              type="button"
              className="btn btn-primary create--tui"
              onClick={() => handleUpdatePeriod(buttonConfig.action)}
              disabled={loading}
            >
              {buttonConfig.text}
            </button>
          </>
        )}
      </main>
    </div>
  );
};

export default UpdatePeriodPage;
