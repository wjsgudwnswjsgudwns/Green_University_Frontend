import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/staffInfo.css"; // 변경

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
      <div className="staff-info-container">
        <div className="staff-info-loading-container">
          <div className="staff-info-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="staff-info-container">
        <div className="staff-info-error-container">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-info-container">
      <aside className="staff-info-side-menu">
        <div className="staff-info-side-menu-header">
          <h2>MY</h2>
        </div>
        <nav className="staff-info-side-menu-nav">
          <Link to="/staff/info" className="staff-info-menu-item active">
            내 정보 조회
          </Link>
          <Link to="/staff/password" className="staff-info-menu-item">
            비밀번호 변경
          </Link>
        </nav>
      </aside>

      <main className="staff-info-main-content">
        <h1>내 정보 조회</h1>
        <div className="staff-info-divider"></div>

        {staffInfo && (
          <>
            <table className="staff-info-table">
              <tbody>
                <tr>
                  <th>ID</th>
                  <td>{staffInfo.id}</td>
                  <th>입사 날짜</th>
                  <td>{staffInfo.hireDate}</td>
                </tr>
              </tbody>
            </table>

            <table className="staff-info-table">
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
              className="staff-info-update-button"
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
