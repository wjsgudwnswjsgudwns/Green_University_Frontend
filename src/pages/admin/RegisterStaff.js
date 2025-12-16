import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/registerForm.css";

export default function RegisterStaff() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    birthDate: "",
    gender: "남성",
    address: "",
    tel: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/user/staff", formData);
      alert("직원이 등록되었습니다.");
      navigate("/staff/student-list");
    } catch (err) {
      console.error("직원 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("직원 등록에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-container">
      <aside className="admin-side-menu">
        <div className="admin-side-menu-header">
          <h2>학사관리</h2>
        </div>
        <nav className="admin-side-menu-nav">
          <Link to="/staff/student-list" className="admin-menu-item">
            학생 명단 조회
          </Link>
          <Link to="/staff/professor-list" className="admin-menu-item">
            교수 명단 조회
          </Link>
          <Link to="/staff/register-student" className="admin-menu-item">
            학생 등록
          </Link>
          <Link to="/staff/register-professor" className="admin-menu-item">
            교수 등록
          </Link>
          <Link to="/staff/register-staff" className="admin-menu-item active">
            직원 등록
          </Link>
          <Link to="/staff/tuition/bill" className="admin-menu-item">
            등록금 고지서 발송
          </Link>
          <Link to="/staff/break/list" className="admin-menu-item">
            휴학 처리
          </Link>
          <Link to="/staff/course-period" className="admin-menu-item">
            수강 신청 기간 설정
          </Link>
        </nav>
      </aside>

      <main className="admin-main-content">
        <h1>직원 등록</h1>
        <div className="admin-divider"></div>

        {error && <div className="register-error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="register-form">
          <table className="register-form-table">
            <tbody>
              <tr>
                <th>
                  <label htmlFor="name">이름</label>
                </th>
                <td>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="register-input-field"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="birthDate">생년월일</label>
                </th>
                <td>
                  <input
                    type="date"
                    id="birthDate"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleChange}
                    className="register-input-field"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label>성별</label>
                </th>
                <td className="register-radio-group">
                  <label>
                    <input
                      type="radio"
                      name="gender"
                      value="남성"
                      checked={formData.gender === "남성"}
                      onChange={handleChange}
                    />
                    남성
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gender"
                      value="여성"
                      checked={formData.gender === "여성"}
                      onChange={handleChange}
                    />
                    여성
                  </label>
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="address">주소</label>
                </th>
                <td>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="register-input-field"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="tel">전화번호</label>
                </th>
                <td>
                  <input
                    type="text"
                    id="tel"
                    name="tel"
                    value={formData.tel}
                    onChange={handleChange}
                    className="register-input-field"
                    placeholder="010-1234-5678"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="email">이메일</label>
                </th>
                <td>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="register-input-field"
                    placeholder="example@email.com"
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="register-button-container">
            <button
              type="submit"
              className="register-submit-button"
              disabled={loading}
            >
              {loading ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
