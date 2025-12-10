import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/breakApplication.css";

export default function BreakDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [breakApp, setBreakApp] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [deptName, setDeptName] = useState("");
  const [collName, setCollName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchBreakDetail();
  }, [id]);

  const fetchBreakDetail = async () => {
    try {
      const response = await api.get(`/api/break/detail/${id}`);
      setBreakApp(response.data.breakApp);
      setStudentInfo(response.data.student);
      setDeptName(response.data.deptName);
      setCollName(response.data.collName);
    } catch (err) {
      console.error("휴학 신청서 조회 실패:", err);
      setError("정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("신청을 취소하시겠습니까?")) {
      return;
    }

    try {
      await api.post(`/api/break/delete/${id}`);
      alert("신청이 취소되었습니다.");
      navigate("/student/break/list");
    } catch (err) {
      console.error("신청 취소 실패:", err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert("신청 취소에 실패했습니다.");
      }
    }
  };

  const handleUpdate = async (status) => {
    const message =
      status === "승인"
        ? "해당 신청을 승인하시겠습니까?"
        : "해당 신청을 반려하시겠습니까?";

    if (!window.confirm(message)) {
      return;
    }

    try {
      await api.post(`/api/break/update/${id}?status=${status}`);
      alert(`신청이 ${status}되었습니다.`);
      navigate("/staff/break/list");
    } catch (err) {
      console.error("신청 처리 실패:", err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert("신청 처리에 실패했습니다.");
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}월 ${String(date.getDate()).padStart(2, "0")}일`;
  };

  if (loading) {
    return (
      <div className="mypage-container">
        <div className="mypage-loading-container">
          <div className="mypage-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mypage-container">
        <div className="mypage-error-container">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const isStudent = user?.userRole === "student";
  const isStaff = user?.userRole === "staff";

  return (
    <div className="mypage-container">
      <aside className="mypage-side-menu">
        <div className="mypage-side-menu-header">
          <h2>{isStudent ? "MY" : "학사관리"}</h2>
        </div>
        <nav className="mypage-side-menu-nav">
          {isStudent ? (
            <>
              <Link to="/student/info" className="mypage-menu-item">
                내 정보 조회
              </Link>
              <Link to="/student/password" className="mypage-menu-item">
                비밀번호 변경
              </Link>
              <Link
                to="/student/break/application"
                className="mypage-menu-item"
              >
                휴학 신청
              </Link>
              <Link
                to="/student/break/list"
                className="mypage-menu-item active"
              >
                휴학 내역 조회
              </Link>
              <Link to="/student/tuition/list" className="mypage-menu-item">
                등록금 내역 조회
              </Link>
              <Link to="/student/tuition/payment" className="mypage-menu-item">
                등록금 납부 고지서
              </Link>
            </>
          ) : (
            <>
              <Link to="/staff/student-list" className="mypage-menu-item">
                학생 명단 조회
              </Link>
              <Link to="/staff/professor-list" className="mypage-menu-item">
                교수 명단 조회
              </Link>
              <Link to="/staff/register-student" className="mypage-menu-item">
                학생 등록
              </Link>
              <Link to="/staff/register-professor" className="mypage-menu-item">
                교수 등록
              </Link>
              <Link to="/staff/register-staff" className="mypage-menu-item">
                직원 등록
              </Link>
              <Link to="/staff/tuition-bill" className="mypage-menu-item">
                등록금 고지서 발송
              </Link>
              <Link to="/staff/break/list" className="mypage-menu-item active">
                휴학 처리
              </Link>
              <Link to="/staff/course-period" className="mypage-menu-item">
                수강 신청 기간 설정
              </Link>
            </>
          )}
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>휴학 내역 조회</h1>
        <div className="mypage-divider"></div>

        {breakApp && studentInfo && (
          <div className="break-document-container">
            <div className="break-document-layout">
              <h3>휴학 신청서</h3>
              <table className="break-document-table" border="1">
                <tbody>
                  <tr>
                    <th>단 과 대</th>
                    <td>{collName}</td>
                    <th>학 과</th>
                    <td>{deptName}</td>
                  </tr>
                  <tr>
                    <th>학 번</th>
                    <td>{studentInfo.id}</td>
                    <th>학 년</th>
                    <td>{breakApp.studentGrade}학년</td>
                  </tr>
                  <tr>
                    <th>전 화 번 호</th>
                    <td>{studentInfo.tel}</td>
                    <th>성 명</th>
                    <td>{studentInfo.name}</td>
                  </tr>
                  <tr>
                    <th>주 소</th>
                    <td colSpan="3">{studentInfo.address}</td>
                  </tr>
                  <tr>
                    <th>기 간</th>
                    <td colSpan="3">
                      {breakApp.fromYear}년도 {breakApp.fromSemester}학기부터{" "}
                      {breakApp.toYear}년도 {breakApp.toSemester}학기까지
                    </td>
                  </tr>
                  <tr>
                    <th>휴 학 구 분</th>
                    <td colSpan="3">{breakApp.type}휴학</td>
                  </tr>
                  <tr>
                    <td colSpan="4" style={{ padding: "18px 8px 2px" }}>
                      <p>
                        위와 같이 휴학하고자 하오니 허가하여 주시기 바랍니다.
                      </p>
                      <br />
                      <p>{formatDate(breakApp.appDate)}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {breakApp.status === "처리중" && (
              <div className="break-button-container">
                {isStudent && (
                  <button
                    onClick={handleCancel}
                    className="break-submit-button"
                  >
                    취소하기
                  </button>
                )}
                {isStaff && (
                  <div className="break-button-group">
                    <button
                      onClick={() => handleUpdate("승인")}
                      className="break-submit-button"
                    >
                      승인하기
                    </button>
                    <button
                      onClick={() => handleUpdate("반려")}
                      className="break-submit-button"
                      style={{ marginLeft: "10px" }}
                    >
                      반려하기
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
