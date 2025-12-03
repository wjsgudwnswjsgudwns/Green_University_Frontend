import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/login.css";
import logo from "../images/GU1.png";
import background from "../images/Green_University_TopView.png";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberId, setRememberId] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 이미 로그인된 상태면 홈으로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  // 저장된 ID 불러오기
  useEffect(() => {
    const remembered = localStorage.getItem("rememberedId");
    if (remembered) {
      setId(remembered);
      setRememberId(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (!id || !password) {
      setError("아이디와 비밀번호를 모두 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      // 로그인 시도
      const result = await login({
        id: parseInt(id),
        password,
      });

      if (result.success) {
        // ID 저장 처리
        if (rememberId) {
          localStorage.setItem("rememberedId", id);
        } else {
          localStorage.removeItem("rememberedId");
        }

        // 역할에 따라 다른 페이지로 이동
        const userRole = result.user.userRole;

        console.log("로그인 성공, 역할:", userRole);

        if (userRole === "student") {
          navigate("/student/dashboard");
        } else if (userRole === "professor") {
          navigate("/professor/dashboard");
        } else if (userRole === "staff") {
          navigate("/staff/dashboard");
        } else {
          navigate("/");
        }
      } else {
        setError(result.message || "로그인에 실패했습니다.");
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page page-container">
      <img src={background} alt="뒷배경"></img>
      <div className="login-container">
        <div className="login-logo">
          <img src={logo} alt="로고"></img>
        </div>

        {error && (
          <div
            style={{
              padding: "12px",
              marginBottom: "16px",
              backgroundColor: "#fee",
              border: "1px solid #fcc",
              borderRadius: "4px",
              color: "#c33",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="id">
              <span className="material-symbols-outlined">person</span>
            </label>
            <input
              type="number"
              id="id"
              placeholder="아이디를 입력하세요"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={isLoading}
              required
              max={2147483647}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="material-symbols-outlined">lock</span>
            </label>
            <input
              type="password"
              id="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="remember-id">
            <input
              type="checkbox"
              id="rememberId"
              checked={rememberId}
              onChange={(e) => setRememberId(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="rememberId">ID 저장</label>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <ul className="login-links">
          <li>
            <a href="/find-id">ID 찾기</a>
          </li>
          <li>
            <a href="/find-password">비밀번호 찾기</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
