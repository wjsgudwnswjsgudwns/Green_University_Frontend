import React, { useState, useEffect } from "react";
import api from "../../api/axiosConfig";
import "../../styles/counselingFormModal.css";

export default function CounselingFormModal({
  isOpen,
  onClose,
  onSubmit,
  studentName,
  subjectName,
  studentId,
  subjectId,
  professorId,
}) {
  const [formData, setFormData] = useState({
    scheduledAt: "",
    counselingContent: "",
    selectedReservationId: "",
  });
  const [errors, setErrors] = useState({});
  const [completedCounselings, setCompletedCounselings] = useState([]);
  const [loadingCounselings, setLoadingCounselings] = useState(false);

  // 완료된 상담 내역 불러오기
  useEffect(() => {
    if (isOpen && professorId && studentId) {
      fetchCompletedCounselings();
    }
  }, [isOpen, professorId, studentId]);

  // 모달이 닫힐 때 폼 초기화
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        scheduledAt: "",
        counselingContent: "",
        selectedReservationId: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  const fetchCompletedCounselings = async () => {
    try {
      setLoadingCounselings(true);
      const response = await api.get(
        `/api/counseling/professor/${professorId}/student/${studentId}/completed`
      );
      setCompletedCounselings(response.data || []);
    } catch (error) {
      console.error("완료된 상담 내역 조회 실패:", error);
      setCompletedCounselings([]);
    } finally {
      setLoadingCounselings(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 입력 시 해당 필드의 에러 제거
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleReservationSelect = (e) => {
    const reservationId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      selectedReservationId: reservationId,
    }));

    // 기존 상담을 선택하면 해당 날짜로 자동 설정
    if (reservationId) {
      const selected = completedCounselings.find(
        (c) => c.reservationId.toString() === reservationId
      );
      if (selected && selected.slotStartAt) {
        // ISO 형식으로 변환 (YYYY-MM-DDTHH:MM)
        const dateStr = new Date(selected.slotStartAt)
          .toISOString()
          .slice(0, 16);
        setFormData((prev) => ({
          ...prev,
          scheduledAt: dateStr,
        }));
      }
    } else {
      // "직접 입력" 선택 시 날짜 초기화
      setFormData((prev) => ({
        ...prev,
        scheduledAt: "",
      }));
    }

    // 에러 제거
    if (errors.selectedReservationId || errors.scheduledAt) {
      setErrors((prev) => ({
        ...prev,
        selectedReservationId: "",
        scheduledAt: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = "상담 일시를 선택해주세요.";
    }

    if (!formData.counselingContent.trim()) {
      newErrors.counselingContent = "상담 내용을 입력해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 디버깅: 전송할 데이터 확인
    console.log("전송할 데이터:", {
      studentId,
      professorId,
      subjectId,
      scheduledAt: formData.scheduledAt,
      counselingContent: formData.counselingContent,
    });

    // 필수 값 검증
    if (!studentId || !professorId || !subjectId) {
      alert("필수 정보가 누락되었습니다. (학생ID, 교수ID, 과목ID)");
      return;
    }

    try {
      // API 호출
      await api.post("/api/ai-counseling/analyze", {
        studentId: parseInt(studentId),
        professorId: parseInt(professorId),
        subjectId: parseInt(subjectId),
        scheduledAt: formData.scheduledAt,
        counselingContent: formData.counselingContent,
      });

      alert("상담 기록이 저장되고 AI 분석이 완료되었습니다.");

      // 폼 초기화 및 모달 닫기
      setFormData({
        scheduledAt: "",
        counselingContent: "",
        selectedReservationId: "",
      });
      setErrors({});

      onSubmit(); // 부모 컴포넌트에 완료 알림 (새로고침 등)
      onClose();
    } catch (error) {
      console.error("상담 기록 실패:", error);
      console.error("에러 상세:", error.response?.data);
      alert("상담 기록 저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.className === "cfm-modal-overlay") {
      onClose();
    }
  };

  // 날짜 포맷팅
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "";
    const date = new Date(dateTimeStr);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="cfm-modal-overlay" onClick={handleOverlayClick}>
      <div className="cfm-modal-container">
        {/* Modal Header */}
        <div className="cfm-modal-header">
          <h2>완료된 상담 기록</h2>
          <button className="cfm-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">X</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="cfm-modal-body">
          <form onSubmit={handleSubmit}>
            {/* 학생 정보 */}
            <div className="cfm-info-section">
              <div className="cfm-info-item">
                <div>
                  <label>학생</label>
                  <span>{studentName}</span>
                </div>
              </div>
              <div className="cfm-info-item">
                <div>
                  <label>과목</label>
                  <span>{subjectName}</span>
                </div>
              </div>
            </div>

            {/* 직접 입력 시 날짜/시간 선택 */}
            {formData.selectedReservationId === "" && (
              <div className="cfm-form-group">
                <label htmlFor="scheduledAt" className="cfm-label">
                  상담 일시 (직접 입력)
                  <span className="cfm-required">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="scheduledAt"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className={`cfm-input ${
                    errors.scheduledAt ? "cfm-input-error" : ""
                  }`}
                />
                {errors.scheduledAt && (
                  <span className="cfm-error-message">
                    {errors.scheduledAt}
                  </span>
                )}
              </div>
            )}

            {/* 상담 내용 */}
            <div className="cfm-form-group">
              <label htmlFor="counselingContent" className="cfm-label">
                상담 내용
                <span className="cfm-required">*</span>
              </label>
              <textarea
                id="counselingContent"
                name="counselingContent"
                value={formData.counselingContent}
                onChange={handleChange}
                placeholder="상담 내용을 입력해주세요."
                rows="8"
                className={`cfm-textarea ${
                  errors.counselingContent ? "cfm-input-error" : ""
                }`}
              />
              {errors.counselingContent && (
                <span className="cfm-error-message">
                  {errors.counselingContent}
                </span>
              )}
            </div>

            {/* Modal Footer */}
            <div className="cfm-modal-footer">
              <button
                type="button"
                className="cfm-btn cfm-btn-cancel"
                onClick={onClose}
              >
                취소
              </button>
              <button type="submit" className="cfm-btn cfm-btn-submit">
                등록하기
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
