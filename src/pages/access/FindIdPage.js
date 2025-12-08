import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/FindAccount.css";
import logo from "../../images/GU1.png";

export default function FindIdPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundId, setFoundId] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");

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

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(foundId.id);
      setCopyMessage("ID가 클립보드에 복사되었습니다!");
      setTimeout(() => setCopyMessage(""), 2000);
      alert(copyMessage);
    } catch (error) {
      setCopyMessage("복사 실패. 다시 시도해주세요.");
      setTimeout(() => setCopyMessage(""), 2000);
      alert(copyMessage);
    }
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const handleFindPassword = () => {
    navigate("/find-password");
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
          <h2 className="find-account-title">ID 찾기</h2>
          <p className="find-account-subtitle">
            가입 시 등록한 이름과 이메일을 입력해주세요
          </p>

          {!foundId ? (
            <>
              {error && <div className="error-message">{error}</div>}

              <form onSubmit={handleSubmit} className="find-account-form">
                <div className="form-group">
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
              <div className="result-message">
                <p className="result-name">{foundId.name}님의 ID는</p>
                <div className="result-foundid-div">
                  <p className="result-foundid">{foundId.id}</p>
                  <button onClick={handleCopyId} className="copy-button">
                    ID 복사하기
                  </button>
                </div>
                <p className="result-text">입니다</p>
              </div>
              <div className="result-buttons">
                <button onClick={handleGoToLogin} className="primary-button">
                  로그인하기
                </button>
                <button
                  onClick={handleFindPassword}
                  className="secondary-button"
                >
                  비밀번호 찾기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
