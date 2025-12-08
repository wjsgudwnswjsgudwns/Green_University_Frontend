import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/syllabus.css";

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
      window.close();
    }
  }, [user]);

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
      window.close();
    } catch (error) {
      console.error("수정 실패:", error);
      alert(error.response?.data?.message || "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="syllabus-page">
        <p style={{ textAlign: "center", padding: "40px" }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="syllabus-page">
      <header>
        <div className="header--top"></div>
      </header>

      <section>
        <h2>강의 계획서 수정</h2>
        <br />

        <form onSubmit={handleSubmit}>
          <label>강의 개요</label>
          <br />
          <textarea
            rows="5"
            cols="50"
            name="overview"
            value={formData.overview}
            onChange={handleChange}
            required
          />
          <br />

          <label>수업 목표</label>
          <br />
          <textarea
            rows="5"
            cols="50"
            name="objective"
            value={formData.objective}
            onChange={handleChange}
            required
          />
          <br />

          <label>교재</label>
          <br />
          <input
            type="text"
            name="textbook"
            value={formData.textbook}
            onChange={handleChange}
            required
          />
          <br />

          <label>주별 계획</label>
          <br />
          <textarea
            rows="10"
            cols="50"
            name="program"
            value={formData.program}
            onChange={handleChange}
            required
          />
          <br />

          <button
            type="submit"
            className="submit--button"
            disabled={submitting}
          >
            {submitting ? "제출 중..." : "제출"}
          </button>
        </form>
      </section>
    </div>
  );
}
