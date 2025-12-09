import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 앱 시작 시 토큰 확인
  useEffect(() => {
    checkAuth();
  }, []);

  // 토큰으로 사용자 정보 확인
  const checkAuth = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/api/user/me");
      setUser(response.data.principal);
    } catch (error) {
      console.error("인증 확인 실패:", error);
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // 로그인
  const login = async (credentials) => {
    try {
      const response = await api.post("/api/auth/login", credentials);

      const { token, principal } = response.data;

      // 토큰 저장
      localStorage.setItem("token", token);

      // 사용자 정보 저장
      setUser(principal);

      console.log("로그인 성공:", principal);

      return { success: true, user: principal };
    } catch (error) {
      console.error("로그인 오류:", error);

      let message = "로그인에 실패했습니다.";

      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.response?.status === 401) {
        message = "아이디 또는 비밀번호가 잘못되었습니다.";
      } else if (error.response?.status === 500) {
        message = "서버 오류가 발생했습니다.";
      }

      return { success: false, message };
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      console.error("로그아웃 오류:", error);
    } finally {
      // 로컬 스토리지 및 상태 초기화
      localStorage.removeItem("token");
      localStorage.removeItem("chatbot_history"); // 챗봇 대화 내역 초기화
      setUser(null);
      navigate("/login");
    }
  };

  // 사용자 정보 새로고침
  const refreshUser = async () => {
    try {
      const response = await api.get("/api/user/me");
      setUser(response.data.principal);
      return response.data.principal;
    } catch (error) {
      console.error("사용자 정보 갱신 실패:", error);
      return null;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div className="spinner"></div>
        <div>로딩 중...</div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
