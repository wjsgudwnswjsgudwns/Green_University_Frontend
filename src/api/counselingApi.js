import api from "./axiosConfig";

// 날짜 → "YYYY-MM-DD"로 변환 (LocalDate용)
const toDateParam = (d) => {
    if (!d) return null;
    if (typeof d === "string") return d; // 이미 "2025-12-08" 형식이면 그대로 사용
    // Date 객체면 YYYY-MM-DD만 잘라서 사용
    return d.toISOString().slice(0, 10);
};

// ================== 학생용 API ==================

/**
 * 내가 속한 학과의 교수 목록 조회
 * GET /api/counseling/professors/my
 */
export const getMyMajorProfessors = async () => {
    const res = await api.get("/api/counseling/professors/my");
    return res.data; // Professor[]
};

/**
 * 특정 교수의 OPEN 상담 슬롯 조회
 * GET /api/counseling/slots/open?professorId=1&from=2025-12-08&to=2025-12-31
 *
 * @param {number} professorId
 * @param {Date|string} from  - JS Date 또는 "YYYY-MM-DD"
 * @param {Date|string} to    - JS Date 또는 "YYYY-MM-DD"
 */
export const getOpenSlots = async (professorId, from, to) => {
    const params = {
        professorId,
        from: toDateParam(from),
        to: toDateParam(to),
    };
    const res = await api.get("/api/counseling/slots/open", { params });
    return res.data; // CounselingSlotResDto[]
};

/**
 * 상담 슬롯 예약
 * POST /api/counseling/slots/{slotId}/reserve
 *
 * @param {number} slotId
 * @param {string} memo
 */
export const reserveSlot = async (slotId, memo) => {
    const body = memo ? { memo } : {};
    const res = await api.post(`/api/counseling/slots/${slotId}/reserve`, body);
    return res.data; // CounselingReservationResDto
};

/**
 * 내 예약 취소
 * DELETE /api/counseling/reservations/{reservationId}
 */
export const cancelReservation = (reservationId, reason) =>
    api.post(`/api/counseling/reservations/${reservationId}/cancel`, null, {
        params: { reason: reason ?? "" },
    });
export async function getMyReservations(fromDate, toDate) {
    const res = await api.get("/api/counseling/my-reservations", {
        params: {
            from: fromDate,
            to: toDate,
        },
    });
    return res.data;
}
// ================== 교수용 API ==================

/**
 * 내 상담 슬롯 목록 조회
 * GET /api/counseling/my-slots?from=...&to=...
 */
export const getMySlots = async (from, to) => {
    const params = {
        from: toDateParam(from),
        to: toDateParam(to),
    };
    const res = await api.get("/api/counseling/my-slots", { params });
    return res.data; // CounselingSlotResDto[]
};

export const getProfessorReservations = async (fromDate, toDate) => {
    const res = await api.get("/api/counseling/professor-reservations", {
        params: { from: fromDate, to: toDate },
    });
    return res.data;
};

/**
 * 단일 상담 슬롯 생성 (1시간짜리)
 * POST /api/counseling/slots/single
 *
 * @param {{ startAt: string, endAt: string }} dto
 *   - startAt, endAt: ISO 문자열 ("2025-12-08T10:00")
 */
export const createSingleSlot = async (dto) => {
    const res = await api.post("/api/counseling/slots/single", dto);
    return res.data; // CounselingSlotResDto
};

/**
 * 주간 패턴으로 상담 슬롯 반복 생성
 * POST /api/counseling/slots/weekly
 *
 * @param {{
 *   weekStartDate: string, // "YYYY-MM-DD" (월요일)
 *   repeatEndDate: string, // "YYYY-MM-DD"
 *   items: Array<{
 *     dayOfWeek: string,   // "MONDAY" 같은 enum 문자열
 *     startTime: string,   // "10:00"
 *     endTime: string      // "11:00"
 *   }>
 * }} dto
 */
export const createWeeklyPattern = async (dto) => {
    const res = await api.post("/api/counseling/slots/weekly", dto);
    return res.data; // CounselingSlotResDto[]
};

/**
 * 특정 슬롯에 대한 예약 목록 조회
 * GET /api/counseling/slots/{slotId}/reservations
 */
export const getSlotReservations = async (slotId) => {
    const res = await api.get(`/api/counseling/slots/${slotId}/reservations`);
    return res.data; // CounselingReservationResDto[]
};

// 🔹 새로 추가: OPEN 슬롯 끄기(삭제/비활성화)
export const closeSlot = async (slotId) => {
    // 백엔드에서 DELETE or PATCH로 구현해두면 됨
    const res = await api.delete(`/api/counseling/slots/${slotId}`);
    return res.data;
};

export async function getStudentSlots(professorId, fromDate, toDate) {
    const res = await api.get("/api/counseling/student/slots", {
        params: { professorId, from: fromDate, to: toDate },
    });
    return res.data;
}

export function approveReservation(reservationId, { title, description }) {
    return api.post(
        `/api/counseling/professor/reservations/${reservationId}/approve`,
        {
            title,
            description,
        }
    );
}

export const cancelReservationByProfessor = (reservationId, reason) =>
    api.post(
        `/api/counseling/professor/reservations/${reservationId}/cancel`,
        null,
        {
            params: { reason: reason ?? "" },
        }
    );
