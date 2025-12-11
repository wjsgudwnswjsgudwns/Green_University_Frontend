import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function StaffInfoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [staffInfo, setStaffInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchStaffInfo();
  }, [user, navigate]);

  const fetchStaffInfo = async () => {
    try {
      const response = await api.get("/api/user/info/staff");
      setStaffInfo(response.data.staff);
    } catch (err) {
      console.error("직원 정보 조회 실패:", err);
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
          <Link to="/staff/info" className="mypage-menu-item active">
            내 정보 조회
          </Link>
          <Link to="/staff/password" className="mypage-menu-item">
            비밀번호 변경
          </Link>
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>내 정보 조회</h1>
        <div className="mypage-divider"></div>

        {staffInfo && (
          <>
            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>ID</th>
                  <td>{staffInfo.id}</td>
                  <th>입사 날짜</th>
                  <td>{staffInfo.hireDate}</td>
                </tr>
              </tbody>
            </table>

            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>성명</th>
                  <td>{staffInfo.name}</td>
                  <th>생년월일</th>
                  <td>{staffInfo.birthDate}</td>
                </tr>
                <tr>
                  <th>성별</th>
                  <td>{staffInfo.gender}</td>
                  <th>주소</th>
                  <td>{staffInfo.address}</td>
                </tr>
                <tr>
                  <th>연락처</th>
                  <td>{staffInfo.tel}</td>
                  <th>이메일</th>
                  <td>{staffInfo.email}</td>
                </tr>
              </tbody>
            </table>

            <button
              className="mypage-update-button"
              onClick={() => navigate("/staff/update")}
            >
              수정하기
            </button>
          </>
        )}
      </main>
    </div>
  );
}
