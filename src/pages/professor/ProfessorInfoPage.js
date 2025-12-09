import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function ProfessorInfoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [professorInfo, setProfessorInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "professor") {
      navigate("/");
      return;
    }
    fetchProfessorInfo();
  }, [user, navigate]);

  const fetchProfessorInfo = async () => {
    try {
      const response = await api.get("/api/user/info/professor");
      setProfessorInfo(response.data.professor);
    } catch (err) {
      console.error("교수 정보 조회 실패:", err);
      setError("정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
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
          <Link to="/professor/info" className="mypage-menu-item active">
            내 정보 조회
          </Link>
          <Link to="/professor/password" className="mypage-menu-item">
            비밀번호 변경
          </Link>
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>내 정보 조회</h1>
        <div className="mypage-divider"></div>

        {professorInfo && (
          <>
            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>ID</th>
                  <td>{professorInfo.id}</td>
                  <th>소속</th>
                  <td>
                    {professorInfo.collegeName} {professorInfo.deptName}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>성명</th>
                  <td>{professorInfo.name}</td>
                  <th>생년월일</th>
                  <td>{professorInfo.birthDate}</td>
                </tr>
                <tr>
                  <th>성별</th>
                  <td>{professorInfo.gender}</td>
                  <th>주소</th>
                  <td>{professorInfo.address}</td>
                </tr>
                <tr>
                  <th>연락처</th>
                  <td>{professorInfo.tel}</td>
                  <th>이메일</th>
                  <td>{professorInfo.email}</td>
                </tr>
              </tbody>
            </table>

            <button
              className="mypage-update-button"
              onClick={() => navigate("/professor/update")}
            >
              수정하기
            </button>
          </>
        )}
      </main>
    </div>
  );
}
