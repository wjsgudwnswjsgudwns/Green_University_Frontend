import api from "./api";

/**
 * 인증 관련 API
 */
export const authService = {
  // 로그인
  login: async (credentials) => {
    const response = await api.post("/api/auth/login", credentials);
    return response.data;
  },

  // 로그아웃
  logout: async () => {
    const response = await api.post("/api/auth/logout");
    return response.data;
  },

  // 현재 사용자 정보
  getCurrentUser: async () => {
    const response = await api.get("/api/user/me");
    return response.data;
  },

  // ID 찾기
  findId: async (data) => {
    const response = await api.post("/api/auth/find/id", data);
    return response.data;
  },

  // 비밀번호 찾기
  findPassword: async (data) => {
    const response = await api.post("/api/auth/find/password", data);
    return response.data;
  },
};

/**
 * 사용자 관련 API
 */
export const userService = {
  // 사용자 정보 수정
  updateProfile: async (data, password) => {
    const response = await api.put(
      `/api/user/update?password=${encodeURIComponent(password)}`,
      data
    );
    return response.data;
  },

  // 비밀번호 변경
  changePassword: async (data) => {
    const response = await api.put("/api/user/password", data);
    return response.data;
  },

  // 학생 정보 조회
  getStudentInfo: async () => {
    const response = await api.get("/api/user/info/student");
    return response.data;
  },

  // 교수 정보 조회
  getProfessorInfo: async () => {
    const response = await api.get("/api/user/info/professor");
    return response.data;
  },

  // 직원 정보 조회
  getStaffInfo: async () => {
    const response = await api.get("/api/user/info/staff");
    return response.data;
  },
};
