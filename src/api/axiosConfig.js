import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8881/";
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    // 항상 최신 토큰 가져오기
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("요청 토큰:", token.substring(0, 20) + "...");

      // 토큰이 있을 때만 디코딩 (디버깅용)
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("토큰 만료 시간:", new Date(payload.exp * 1000));
        console.log("현재 시간:", new Date());

        // 토큰이 만료되었는지 확인
        if (payload.exp * 1000 < Date.now()) {
          console.warn("토큰이 만료되었습니다!");
          localStorage.removeItem("token");
          delete config.headers.Authorization;
        }
      } catch (e) {
        console.error("토큰 디코딩 실패:", e);
      }
    } else {
      console.log("토큰 없음");
      delete config.headers.Authorization;
    }

    console.log("요청:", config.method.toUpperCase(), config.url);

    return config;
  },
  (error) => {
    console.error("요청 인터셉터 에러:", error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    console.log("응답 성공:", response.config.url, response.status);
    return response;
  },
  (error) => {
    console.log("응답 실패:", error.config?.url, error.response?.status);

    // if (error.response?.status === 401) {
    //     console.warn("401 에러 - 인증 실패");

    //     // 공개 API는 토큰 삭제하지 않음
    //     const isPublicUrl =
    //         error.config?.url?.includes("/api/auth/login") ||
    //         error.config?.url?.includes("/api/auth/find") ||
    //         error.config?.url?.includes("/api/public");

    //     if (!isPublicUrl) {
    //         console.log("토큰 삭제 및 로그인 페이지로 이동");
    //         localStorage.removeItem("token");

    //         // 로그인 페이지가 아닐 때만 리다이렉트
    //         if (
    //             window.location.pathname !== "/login" &&
    //             window.location.pathname !== "/" &&
    //             !window.location.pathname.startsWith("/find-")
    //         ) {
    //             window.location.href = "/login";
    //         }
    //     }
    // }

    return Promise.reject(error);
  }
);

export default api;
