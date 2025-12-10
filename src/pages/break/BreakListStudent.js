import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function BreakListStudent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [breakAppList, setBreakAppList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "student") {
      navigate("/");
      return;
    }
    fetchBreakList();
  }, [user, navigate]);

  const fetchBreakList = async () => {
    try {
      const response = await api.get("/api/break/list");
      setBreakAppList(response.data);
    } catch (err) {
      console.error("휴학 내역 조회 실패:", err);
      setError("정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "처리중":
        return { color: "#767676", fontWeight: 600 };
      case "승인":
        return { color: "blue", fontWeight: 600 };
      case "반려":
        return { color: "red", fontWeight: 600 };
      default:
        return {};
    }
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

  return (
    <div className="mypage-container">
      <aside className="mypage-side-menu">
        <div className="mypage-side-menu-header">
          <h2>MY</h2>
        </div>
        <nav className="mypage-side-menu-nav">
          <Link to="/student/info" className="mypage-menu-item">
            내 정보 조회
          </Link>
          <Link to="/student/password" className="mypage-menu-item">
            비밀번호 변경
          </Link>
          <Link to="/student/break/application" className="mypage-menu-item">
            휴학 신청
          </Link>
          <Link to="/student/break/list" className="mypage-menu-item active">
            휴학 내역 조회
          </Link>
          <Link to="/student/tuition/list" className="mypage-menu-item">
            등록금 내역 조회
          </Link>
          <Link to="/student/tuition/payment" className="mypage-menu-item">
            등록금 납부 고지서
          </Link>
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>휴학 내역 조회</h1>
        <div className="mypage-divider"></div>

        {breakAppList.length > 0 ? (
          <table className="mypage-list-table" border="1">
            <thead>
              <tr>
                <th>신청일자</th>
                <th>구분</th>
                <th>시작학기</th>
                <th>종료학기</th>
                <th>신청서 확인</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {breakAppList.map((breakApp) => (
                <tr key={breakApp.id}>
                  <td>{breakApp.appDate}</td>
                  <td>{breakApp.type}휴학</td>
                  <td>
                    {breakApp.fromYear}년도 {breakApp.fromSemester}학기
                  </td>
                  <td>
                    {breakApp.toYear}년도 {breakApp.toSemester}학기
                  </td>
                  <td>
                    <Link to={`/student/break/detail/${breakApp.id}`}>
                      Click
                    </Link>
                  </td>
                  <td>
                    <span style={getStatusStyle(breakApp.status)}>
                      {breakApp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mypage-no-list-p">휴학 신청 내역이 없습니다.</p>
        )}
      </main>
    </div>
  );
}
