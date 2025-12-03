import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function BreakListStaff() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [breakAppList, setBreakAppList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchBreakList();
  }, [user, navigate]);

  const fetchBreakList = async () => {
    try {
      const response = await api.get("/api/break/list/staff");
      setBreakAppList(response.data);
    } catch (err) {
      console.error("휴학 내역 조회 실패:", err);
      setError("정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-container">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-page-container">
      <aside className="side-menu">
        <div className="side-menu-header">
          <h2>학사관리</h2>
        </div>
        <nav className="side-menu-nav">
          <Link to="/staff/student-list" className="menu-item">
            학생 명단 조회
          </Link>
          <Link to="/staff/professor-list" className="menu-item">
            교수 명단 조회
          </Link>
          <Link to="/staff/register-student" className="menu-item">
            학생 등록
          </Link>
          <Link to="/staff/register-professor" className="menu-item">
            교수 등록
          </Link>
          <Link to="/staff/register-staff" className="menu-item">
            직원 등록
          </Link>
          <Link to="/staff/tuition-bill" className="menu-item">
            등록금 고지서 발송
          </Link>
          <Link to="/staff/break/list" className="menu-item active">
            휴학 처리
          </Link>
          <Link to="/staff/course-period" className="menu-item">
            수강 신청 기간 설정
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        <h1>휴학 처리</h1>
        <div className="divider"></div>

        {breakAppList.length > 0 ? (
          <table className="list-table" border="1">
            <thead>
              <tr>
                <th>신청일자</th>
                <th>신청자 학번</th>
                <th>구분</th>
                <th>시작학기</th>
                <th>종료학기</th>
                <th>신청서 확인</th>
              </tr>
            </thead>
            <tbody>
              {breakAppList.map((breakApp) => (
                <tr key={breakApp.id}>
                  <td>{breakApp.appDate}</td>
                  <td>{breakApp.studentId}</td>
                  <td>{breakApp.type}휴학</td>
                  <td>
                    {breakApp.fromYear}년도 {breakApp.fromSemester}학기
                  </td>
                  <td>
                    {breakApp.toYear}년도 {breakApp.toSemester}학기
                  </td>
                  <td>
                    <Link to={`/staff/break/detail/${breakApp.id}`}>Click</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-list-p">대기 중인 신청 내역이 없습니다.</p>
        )}
      </main>
    </div>
  );
}
