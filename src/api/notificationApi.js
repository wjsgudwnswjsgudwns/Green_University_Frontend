import api from "./axiosConfig";

/**
 * 읽지 않은 알림 목록 조회
 * GET /api/notifications/unread
 */
export const getUnreadNotifications = async () => {
  const res = await api.get("/api/notifications/unread");
  return res.data;
};

/**
 * 모든 알림 목록 조회
 * GET /api/notifications
 */
export const getAllNotifications = async () => {
  const res = await api.get("/api/notifications");
  return res.data;
};

/**
 * 읽지 않은 알림 개수 조회
 * GET /api/notifications/unread/count
 */
export const getUnreadCount = async () => {
  const res = await api.get("/api/notifications/unread/count");
  return res.data;
};

/**
 * 알림 읽음 처리
 * PUT /api/notifications/{id}/read
 */
export const markAsRead = async (notificationId) => {
  await api.put(`/api/notifications/${notificationId}/read`);
};

/**
 * 모든 알림 읽음 처리
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async () => {
  await api.put("/api/notifications/read-all");
};

/**
 * 모든 알림 삭제 (비우기)
 * DELETE /api/notifications
 */
export const deleteAllNotifications = async () => {
  await api.delete("/api/notifications");
};
