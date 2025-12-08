import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/subject.css";

export default function UpdateStudentGradePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subjectId, studentId } = useParams();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentId: parseInt(studentId),
    subjectId: parseInt(subjectId),
    absent: 0,
    lateness: 0,
    homework: 0,
    midExam: 0,
    finalExam: 0,
    convertedMark: 0,
    grade: "A+",
  });

  // 교수가 아니면 접근 불가
  useEffect(() => {
    if (user?.userRole !== "professor") {
      alert("접근 권한이 없습니다.");
      navigate("/");
    }
  }, [user, navigate]);

  // 학생 정보 조회
  useEffect(() => {
    const fetchStudentInfo = async () => {
      try {
        const response = await api.get(
          `/api/professor/subject/${subjectId}/${studentId}`
        );
        setStudent(response.data.student);
      } catch (error) {
        console.error("학생 정보 조회 실패:", error);
        alert("학생 정보를 불러오는데 실패했습니다.");
        navigate(`/professor/subject/${subjectId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentInfo();
  }, [subjectId, studentId, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "grade" ? value : Number(value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 결석 5회 이상 체크
    if (formData.absent >= 5) {
      if (
        !window.confirm(
          "결석이 5회 이상입니다. F학점으로 처리됩니다. 계속하시겠습니까?"
        )
      ) {
        return;
      }
      formData.grade = "F";
    }

    setSubmitting(true);

    try {
      await api.put(
        `/api/professor/subject/${subjectId}/${studentId}`,
        formData
      );
      alert("성적이 등록되었습니다.");
      navigate(`/professor/subject/${subjectId}`);
    } catch (error) {
      console.error("성적 등록 실패:", error);
      alert(error.response?.data?.message || "성적 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <main>
          <h1>학생 성적 기입</h1>
          <div className="split--div"></div>
          <p className="no--list--p">로딩 중...</p>
        </main>
      </div>
    );
  }

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 사이드 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>수업</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table" border="1">
            <tbody>
              <tr>
                <td>
                  <a href="/subject/list">전체 강의 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/professor/subject" className="selected--menu">
                    내 강의 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/professor/evaluation">내 강의 평가</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>학생 성적 기입</h1>
        <div className="split--div"></div>

        {/* 학생 정보 */}
        <table border="1" className="sub--list--table">
          <thead>
            <tr>
              <th>학생 번호</th>
              <th>이름</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{student?.id}</td>
              <td>{student?.name}</td>
            </tr>
          </tbody>
        </table>

        <br />

        {/* 성적 입력 폼 */}
        <form onSubmit={handleSubmit}>
          <table className="form--table">
            <tbody>
              <tr>
                <td>
                  <label>결석</label>
                </td>
                <td>
                  <input
                    type="number"
                    name="absent"
                    value={formData.absent}
                    onChange={handleChange}
                    min="0"
                  />
                </td>
                <td>
                  <span style={{ color: "#888" }}>
                    ※ 결석 5회 이상시 F학점입니다.
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <label>지각</label>
                </td>
                <td>
                  <input
                    type="number"
                    name="lateness"
                    value={formData.lateness}
                    onChange={handleChange}
                    min="0"
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <label>과제점수</label>
                </td>
                <td>
                  <input
                    type="number"
                    name="homework"
                    value={formData.homework}
                    onChange={handleChange}
                    min="0"
                    max="100"
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <label>중간시험</label>
                </td>
                <td>
                  <input
                    type="number"
                    name="midExam"
                    value={formData.midExam}
                    onChange={handleChange}
                    min="0"
                    max="100"
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <label>기말시험</label>
                </td>
                <td>
                  <input
                    type="number"
                    name="finalExam"
                    value={formData.finalExam}
                    onChange={handleChange}
                    min="0"
                    max="100"
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <label>환산점수</label>
                </td>
                <td>
                  <input
                    type="number"
                    name="convertedMark"
                    value={formData.convertedMark}
                    onChange={handleChange}
                    min="0"
                    max="100"
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <label>등급</label>
                </td>
                <td>
                  <select
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                  >
                    <option value="A+">A+</option>
                    <option value="A0">A0</option>
                    <option value="B+">B+</option>
                    <option value="B0">B0</option>
                    <option value="C+">C+</option>
                    <option value="C0">C0</option>
                    <option value="D+">D+</option>
                    <option value="D0">D0</option>
                    <option value="F">F</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td colSpan="2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/professor/subject/${subjectId}`)}
                    style={{ marginRight: "10px" }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn btn-dark update--button"
                    disabled={submitting}
                  >
                    {submitting ? "제출 중..." : "제출하기"}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </form>
      </main>
    </div>
  );
}
