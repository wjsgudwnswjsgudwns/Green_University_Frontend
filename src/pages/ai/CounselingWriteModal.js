import React, { useState } from "react";
// import "../../styles/CounselingWriteModal.css";

export default function CounselingWriteModal({
  onClose,
  onSubmit,
  studentName,
  subjectName,
}) {
  const [formData, setFormData] = useState({
    scheduledAt: "",
    counselingContent: "",
    isCompleted: false,
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // 입력 시 해당 필드의 에러 제거
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = "상담 일정을 선택해주세요.";
    } else {
      const selectedDate = new Date(formData.scheduledAt);
      const now = new Date();
      if (selectedDate < now && !formData.isCompleted) {
        newErrors.scheduledAt =
          "과거 날짜는 선택할 수 없습니다. (완료된 상담인 경우 체크해주세요)";
      }
    }

    if (formData.isCompleted && !formData.counselingContent.trim()) {
      newErrors.counselingContent = "완료된 상담은 내용을 입력해야 합니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const handleOverlayClick = (e) => {
    if (e.target.className === "cwm-modal-overlay") {
      onClose();
    }
  };

  // 현재 시간을 YYYY-MM-DDTHH:MM 형식으로 변환
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="cwm-modal-overlay" onClick={handleOverlayClick}>
      <div className="cwm-modal-container">
        {/* Modal Header */}
        <div className="cwm-modal-header">
          <h2>
            <span className="material-symbols-outlined">edit_note</span>
            상담 일정 등록
          </h2>
          <button className="cwm-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="cwm-modal-body">
          <form onSubmit={handleSubmit}>
            {/* 학생 정보 */}
            <div className="cwm-info-section">
              <div className="cwm-info-item">
                <span className="material-symbols-outlined">person</span>
                <div>
                  <label>학생</label>
                  <span>{studentName}</span>
                </div>
              </div>
              <div className="cwm-info-item">
                <span className="material-symbols-outlined">school</span>
                <div>
                  <label>과목</label>
                  <span>{subjectName}</span>
                </div>
              </div>
            </div>

            {/* 상담 일정 */}
            <div className="cwm-form-group">
              <label htmlFor="scheduledAt" className="cwm-label">
                <span className="material-symbols-outlined">schedule</span>
                상담 예정 일시
                <span className="cwm-required">*</span>
              </label>
              <input
                type="datetime-local"
                id="scheduledAt"
                name="scheduledAt"
                value={formData.scheduledAt}
                onChange={handleChange}
                min={getCurrentDateTime()}
                className={`cwm-input ${
                  errors.scheduledAt ? "cwm-input-error" : ""
                }`}
              />
              {errors.scheduledAt && (
                <span className="cwm-error-message">{errors.scheduledAt}</span>
              )}
            </div>

            {/* 완료 여부 체크박스 */}
            <div className="cwm-form-group cwm-checkbox-group">
              <label className="cwm-checkbox-label">
                <input
                  type="checkbox"
                  name="isCompleted"
                  checked={formData.isCompleted}
                  onChange={handleChange}
                  className="cwm-checkbox"
                />
                <span className="cwm-checkbox-text">
                  이미 완료된 상담입니다
                </span>
              </label>
              <p className="cwm-help-text">
                과거에 진행된 상담을 기록하는 경우 체크해주세요.
              </p>
            </div>

            {/* 상담 내용 */}
            <div className="cwm-form-group">
              <label htmlFor="counselingContent" className="cwm-label">
                <span className="material-symbols-outlined">description</span>
                상담 내용
                {formData.isCompleted && (
                  <span className="cwm-required">*</span>
                )}
              </label>
              <textarea
                id="counselingContent"
                name="counselingContent"
                value={formData.counselingContent}
                onChange={handleChange}
                placeholder={
                  formData.isCompleted
                    ? "상담 내용을 입력해주세요."
                    : "상담 내용을 입력해주세요. (선택사항)"
                }
                rows="8"
                className={`cwm-textarea ${
                  errors.counselingContent ? "cwm-input-error" : ""
                }`}
              />
              {errors.counselingContent && (
                <span className="cwm-error-message">
                  {errors.counselingContent}
                </span>
              )}
              <p className="cwm-help-text">
                {formData.isCompleted
                  ? "완료된 상담의 경우 내용을 반드시 입력해주세요."
                  : "예정된 상담의 경우 나중에 작성할 수 있습니다."}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="cwm-modal-footer">
              <button
                type="button"
                className="cwm-btn cwm-btn-cancel"
                onClick={onClose}
              >
                취소
              </button>
              <button type="submit" className="cwm-btn cwm-btn-submit">
                <span className="material-symbols-outlined">check</span>
                등록하기
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
