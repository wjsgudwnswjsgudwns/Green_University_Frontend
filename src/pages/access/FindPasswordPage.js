import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/FindAccount.css";
import logo from "../../images/GU1.png";

export default function FindPasswordPage() {
  const navigate = useNavigate();

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (!id || !name || !email || !userRole) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    // ID 숫자 검사
    if (!/^\d+$/.test(id)) {
      setError("ID는 숫자만 입력 가능합니다.");
      return;
    }

    const idNumber = parseInt(id);

    // ID 최소값 검사 (100000 이상)
    if (idNumber < 100000) {
      setError("ID는 100000 이상이어야 합니다.");
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
      // FindPasswordFormDto 구조에 맞춰 데이터 전송
      const requestData = {
        name: name.trim(),
        id: idNumber,
        email: email.trim(),
        userRole: userRole,
      };

      console.log("비밀번호 찾기 요청:", requestData);

      const response = await api.post("/api/auth/find/password", requestData);

      console.log("비밀번호 찾기 응답:", response.data);

      setTempPassword({
        name: response.data.name,
        password: response.data.password,
      });
    } catch (err) {
      console.error("Find Password error:", err);
      console.error("Error response:", err.response?.data);

      // 에러 메시지 처리
      if (err.response?.status === 400) {
        // Validation 에러
        if (err.response?.data?.message) {
          setError(err.response.data.message);
        } else {
          setError("입력하신 정보를 다시 확인해주세요.");
        }
      } else if (err.response?.status === 404 || err.response?.status === 500) {
        setError("입력하신 정보와 일치하는 사용자를 찾을 수 없습니다.");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("비밀번호 찾기 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const handleFindId = () => {
    navigate("/find-id");
  };

  const copyToClipboard = () => {
    if (tempPassword?.password) {
      navigator.clipboard
        .writeText(tempPassword.password)
        .then(() => {
          alert("임시 비밀번호가 클립보드에 복사되었습니다.");
        })
        .catch(() => {
          alert("복사에 실패했습니다. 비밀번호를 직접 복사해주세요.");
        });
    }
  };

  return (
    <div className="find-account-page-wrapper">
      {/* 좌측 영역 - 금색 배경 */}
      <div className="find-account-left">
        <div className="find-account-left-content">
          <div className="find-account-logo">
            <img src={logo} alt="Green University 로고" />
          </div>
          <div className="find-account-left-text">
            <p>
              <span className="passion">
                <span>P</span>
                <span>A</span>
                <span>S</span>
                <span>S</span>
                <span>I</span>
                <span>O</span>
                <span>N</span>
              </span>
              <span className="logotext">
                <span>L</span>
                <span>I</span>
                <span>B</span>
                <span>E</span>
                <span>R</span>
                <span>T</span>
                <span>Y</span>
              </span>
              <span className="logotext">
                <span>F</span>
                <span>R</span>
                <span>E</span>
                <span>E</span>
                <span>D</span>
                <span>O</span>
                <span>M</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 우측 영역 - 녹색 배경 */}
      <div className="find-account-right">
        <div className="find-account-container">
          <h2 className="find-account-title">비밀번호 찾기</h2>
          <p className="find-account-subtitle">
            가입 시 등록한 정보를 입력해주세요
          </p>

          {!tempPassword ? (
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
                  <label htmlFor="id">
                    <span className="material-symbols-outlined">tag</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id="id"
                    placeholder="ID를 입력하세요 (6자리 이상)"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    disabled={isLoading}
                    required
                  />
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
                  {isLoading ? "확인 중..." : "비밀번호 찾기"}
                </button>
              </form>

              <ul className="find-account-links">
                <li>
                  <button onClick={handleGoToLogin}>로그인</button>
                </li>
                <li>
                  <button onClick={handleFindId}>ID 찾기</button>
                </li>
              </ul>
            </>
          ) : (
            <div className="result-container">
              <div className="result-message">
                <p className="result-name">{tempPassword.name}님의</p>
                <p className="result-text">임시 비밀번호가 발급되었습니다</p>
                <div className="temp-password-box">
                  <span className="temp-password">{tempPassword.password}</span>
                  <button
                    className="copy-button"
                    onClick={copyToClipboard}
                    title="복사하기"
                  >
                    <span className="material-symbols-outlined">복사하기</span>
                  </button>
                </div>
                <p className="warning-text">
                  ⚠️ 로그인 후 반드시 비밀번호를 변경해주세요
                </p>
              </div>
              <div className="result-buttons">
                <button onClick={handleGoToLogin} className="primary-button">
                  로그인하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
