import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/update-syllabus.css";

export default function UpdateSyllabusPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    subjectId: parseInt(subjectId),
    overview: "",
    objective: "",
    textbook: "",
    program: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 교수가 아니면 접근 불가
  useEffect(() => {
    if (user?.userRole !== "professor") {
      alert("접근 권한이 없습니다.");
      navigate(-1);
    }
  }, [user, navigate]);

  // 기존 강의계획서 조회
  useEffect(() => {
    const fetchSyllabus = async () => {
      try {
        const response = await api.get(
          `/api/professor/syllabus/update/${subjectId}`
        );
        const syllabus = response.data.syllabus;

        setFormData({
          subjectId: parseInt(subjectId),
          overview: syllabus.overview || "",
          objective: syllabus.objective || "",
          textbook: syllabus.textbook || "",
          program: syllabus.program || "",
        });
      } catch (error) {
        console.error("강의계획서 조회 실패:", error);
        alert("강의계획서를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchSyllabus();
  }, [subjectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.overview.trim()) {
      alert("강의 개요를 입력하세요.");
      return;
    }
    if (!formData.objective.trim()) {
      alert("수업 목표를 입력하세요.");
      return;
    }
    if (!formData.textbook.trim()) {
      alert("교재를 입력하세요.");
      return;
    }
    if (!formData.program.trim()) {
      alert("주별 계획을 입력하세요.");
      return;
    }

    setSubmitting(true);

    try {
      await api.put(`/api/professor/syllabus/update/${subjectId}`, formData);
      alert("강의 계획서가 수정되었습니다.");
      navigate(-1);
    } catch (error) {
      console.error("수정 실패:", error);
      alert(error.response?.data?.message || "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="update-syllabus-container">
        <div className="update-syllabus-loading">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="update-syllabus-container">
      <div className="update-syllabus-content">
        <h1 className="update-syllabus-title">강의 계획서 수정</h1>

        <form onSubmit={handleSubmit} className="update-syllabus-form">
          <div className="update-syllabus-form-group">
            <label className="update-syllabus-label">강의 개요</label>
            <textarea
              name="overview"
              value={formData.overview}
              onChange={handleChange}
              required
              className="update-syllabus-textarea"
              rows="5"
              placeholder="강의의 전반적인 내용을 입력하세요"
            />
          </div>

          <div className="update-syllabus-form-group">
            <label className="update-syllabus-label">수업 목표</label>
            <textarea
              name="objective"
              value={formData.objective}
              onChange={handleChange}
              required
              className="update-syllabus-textarea"
              rows="5"
              placeholder="수업을 통해 달성할 목표를 입력하세요"
            />
          </div>

          <div className="update-syllabus-form-group">
            <label className="update-syllabus-label">교재</label>
            <input
              type="text"
              name="textbook"
              value={formData.textbook}
              onChange={handleChange}
              required
              className="update-syllabus-input"
              placeholder="사용할 교재를 입력하세요 (예: 없음, 또는 교재명)"
            />
          </div>

          <div className="update-syllabus-form-group">
            <label className="update-syllabus-label">주별 계획</label>
            <textarea
              name="program"
              value={formData.program}
              onChange={handleChange}
              required
              className="update-syllabus-textarea"
              rows="12"
              placeholder="주차별 강의 내용을 입력하세요"
            />
          </div>

          <div className="update-syllabus-button-group">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="update-syllabus-cancel-btn"
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="update-syllabus-submit-btn"
              disabled={submitting}
            >
              {submitting ? "제출 중..." : "수정 완료"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
