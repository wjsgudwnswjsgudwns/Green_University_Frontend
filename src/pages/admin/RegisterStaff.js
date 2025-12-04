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
      // 직원 목록 페이지가 없으므로 학생 목록으로 이동
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
          <Link to="/staff/register-staff" className="menu-item active">
            직원 등록
          </Link>
          <Link to="/staff/tuition-bill" className="menu-item">
            등록금 고지서 발송
          </Link>
          <Link to="/staff/break/list" className="menu-item">
            휴학 처리
          </Link>
          <Link to="/staff/course-period" className="menu-item">
            수강 신청 기간 설정
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        <h1>직원 등록</h1>
        <div className="divider"></div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="register-form">
          <table className="form-table">
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
                    className="input-field"
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
                    className="input-field"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label>성별</label>
                </th>
                <td className="radio-group">
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
                    className="input-field"
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
                    className="input-field"
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
                    className="input-field"
                    placeholder="example@email.com"
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="button-container">
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
