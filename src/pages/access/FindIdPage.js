import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/FindAccount.css";
import logo from "../../images/GU1.png";
import background from "../../images/Green_University_TopView.png";

export default function FindIdPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundId, setFoundId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (!name || !email || !userRole) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/api/auth/find/id", {
        name,
        email,
        userRole,
      });

      setFoundId({
        id: response.data.id,
        name: response.data.name,
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setError("일치하는 사용자 정보를 찾을 수 없습니다.");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("ID 찾기 중 오류가 발생했습니다.");
      }
      console.error("Find ID error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const handleFindPassword = () => {
    navigate("/find-password");
  };

  return (
    <div className="find-account-page page-container">
      <img src={background} alt="배경" />
      <div className="find-account-container">
        <div className="find-account-logo">
          <img src={logo} alt="로고" />
        </div>

        <h2 className="find-account-title">ID 찾기</h2>
        <p className="find-account-subtitle">
          가입 시 등록한 이름과 이메일을 입력해주세요
        </p>

        {!foundId ? (
          <>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="find-account-form">
              <div className="form-group">
                <label htmlFor="userRole">
                  <span className="material-symbols-outlined">badge</span>
                </label>
                <select
                  id="userRole"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  disabled={isLoading}
                  required
                >
                  <option value="student">학생</option>
                  <option value="professor">교수</option>
                  <option value="staff">직원</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="name">
                  <span className="material-symbols-outlined">person</span>
                </label>
                <input
                  type="text"
                  id="name"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  <span className="material-symbols-outlined">mail</span>
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? "확인 중..." : "ID 찾기"}
              </button>
            </form>

            <ul className="find-account-links">
              <li>
                <button onClick={handleGoToLogin}>로그인</button>
              </li>
              <li>
                <button onClick={handleFindPassword}>비밀번호 찾기</button>
              </li>
            </ul>
          </>
        ) : (
          <div className="result-container">
            <div className="success-icon">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div className="result-message">
              <p className="result-name">{foundId.name}님의 ID는</p>
              <p className="result-id">{foundId.id}</p>
              <p className="result-text">입니다</p>
            </div>
            <div className="result-buttons">
              <button onClick={handleGoToLogin} className="primary-button">
                로그인하기
              </button>
              <button onClick={handleFindPassword} className="secondary-button">
                비밀번호 찾기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
