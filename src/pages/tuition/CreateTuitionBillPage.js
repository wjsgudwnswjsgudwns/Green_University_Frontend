import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/CreateTuitionBill.css";

export default function CreateTuitionBillPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleCreateBill = async () => {
    if (!window.confirm("등록금 고지서를 발송하시겠습니까?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.get("/api/tuition/create");
      const insertCount = response.data.insertCount;
      alert(`${insertCount}개의 등록금 고지서가 생성되었습니다.`);
      navigate("/staff/tuition/bill");
    } catch (err) {
      alert("등록금 고지서 생성에 실패했습니다.");
      console.error("Error creating tuition bill:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 세부 메뉴 */}
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
                  <a href="/staff/tuition/bill" className="selected--menu">
                    등록금 고지서 발송
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/break/list">휴학 처리</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/staff/course-period">수강 신청 기간 설정</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 */}
      <main>
        <h1>등록금 고지서 발송</h1>
        <div className="split--div"></div>

        <button
          type="button"
          className="btn btn-primary create--tui"
          onClick={handleCreateBill}
          disabled={loading}
        >
          {loading ? "발송 중..." : "등록금 고지서 발송"}
        </button>
      </main>
    </div>
  );
}
