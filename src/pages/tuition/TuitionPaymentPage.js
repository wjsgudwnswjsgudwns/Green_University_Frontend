import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/TuitionPayment.css";

export default function TuitionPaymentPage() {
  const navigate = useNavigate();
  const [tuition, setTuition] = useState(null);
  const [student, setStudent] = useState(null);
  const [deptName, setDeptName] = useState("");
  const [collName, setCollName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPaymentInfo();
  }, []);

  const fetchPaymentInfo = async () => {
    try {
      const response = await api.get("/api/tuition/payment");
      setTuition(response.data.tuition);
      setStudent(response.data.student);
      setDeptName(response.data.deptName);
      setCollName(response.data.collName);
    } catch (err) {
      setError(
        err.response?.data?.message || "등록금 정보를 불러오는데 실패했습니다."
      );
      console.error("Error fetching payment info:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!window.confirm("등록금을 납부하시겠습니까?")) {
      return;
    }

    try {
      await api.post("/api/tuition/payment");
      alert("등록금이 납부되었습니다.");
      fetchPaymentInfo();
    } catch (err) {
      alert("등록금 납부에 실패했습니다.");
      console.error("Error processing payment:", err);
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <main>
          <p>로딩 중...</p>
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
        <main>
          <h1>등록금 납부 고지서</h1>
          <div className="split--div"></div>
          <p className="no--list--p">{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 세부 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>MY</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table">
            <tbody>
              <tr>
                <td>
                  <a href="/student/info">내 정보 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/password">비밀번호 변경</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/break/application">휴학 신청</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/break/list">휴학 내역 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/tuition/list">등록금 내역 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/tuition/payment" className="selected--menu">
                    등록금 납부 고지서
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 */}
      <main>
        <h1>등록금 납부 고지서</h1>
        <div className="split--div"></div>

        <div
          className="d-flex flex-column align-items-center"
          style={{ width: "100%" }}
        >
          <div className="document--layout">
            <h3>등록금 고지서</h3>
            <p>
              {tuition?.id?.tuiYear}년도 {tuition?.id?.semester}학기
            </p>

            <table className="tuition--payment--table" border="1">
              <thead>
                <tr>
                  <th>단 과 대</th>
                  <td>{collName}</td>
                  <th>학 과</th>
                  <td>{deptName}</td>
                </tr>
                <tr>
                  <th>학 번</th>
                  <td>{tuition?.id?.studentId}</td>
                  <th>성 명</th>
                  <td>{student?.name}</td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th colSpan="2">장 학 유 형</th>
                  <td colSpan="2">
                    {tuition?.schType ? `${tuition.schType}유형` : "해당 없음"}
                  </td>
                </tr>
                <tr>
                  <th colSpan="2">등 록 금</th>
                  <td colSpan="2">{tuition?.tuiAmount?.toLocaleString()}원</td>
                </tr>
                <tr>
                  <th colSpan="2">장 학 금</th>
                  <td colSpan="2">
                    {tuition?.schAmount
                      ? `${tuition.schAmount.toLocaleString()}원`
                      : "0원"}
                  </td>
                </tr>
                <tr>
                  <th colSpan="2">납 부 금</th>
                  <td colSpan="2">
                    {(
                      tuition?.tuiAmount - (tuition?.schAmount || 0)
                    ).toLocaleString()}
                    원
                  </td>
                </tr>
                <tr>
                  <th colSpan="2">납 부 계 좌</th>
                  <td colSpan="2">그린은행 483-531345-536</td>
                </tr>
                <tr>
                  <th colSpan="2">납 부 기 간</th>
                  <td colSpan="2">~ 2026.04.02</td>
                </tr>
              </tbody>
            </table>
          </div>

          {tuition?.status ? (
            <p className="no--list--p">
              이번 학기 등록금 납부가 완료되었습니다.
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-dark"
              onClick={handlePayment}
            >
              납부하기
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
