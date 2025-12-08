import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/subject.css";

export default function SyllabusPage() {
  const { subjectId } = useParams();
  const [syllabus, setSyllabus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSyllabus();
  }, [subjectId]);

  const fetchSyllabus = async () => {
    try {
      const response = await api.get(`/api/subject/syllabus/${subjectId}`);
      setSyllabus(response.data.syllabus);
    } catch (err) {
      console.error("강의계획서 조회 실패:", err);
      setError("강의계획서를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="syllabus-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !syllabus) {
    return (
      <div className="syllabus-page">
        <div className="error-container">
          <p>{error || "강의계획서를 찾을 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="syllabus-page">
      <div className="syllabus-header">
        <h1>강의계획서</h1>
        <button onClick={() => window.print()} className="print-button">
          <span className="material-symbols-outlined">print</span>
          인쇄
        </button>
      </div>

      <div className="syllabus-content">
        <table className="syllabus-table">
          <tbody>
            <tr>
              <td rowSpan="4">교과목 정보</td>
              <td>수업 번호</td>
              <td>{syllabus.subjectId}</td>
              <td>교과목 명</td>
              <td>{syllabus.subjectName}</td>
            </tr>

            <tr>
              <td>수업 연도</td>
              <td>{syllabus.subYear}</td>
              <td>수업 학기</td>
              <td>{syllabus.semester}</td>
            </tr>

            <tr>
              <td>학점</td>
              <td>{syllabus.grades}</td>
              <td>이수 구분</td>
              <td>{syllabus.type}</td>
            </tr>

            <tr>
              <td>강의 시간</td>
              <td>{syllabus.classTime || "-"}</td>
              <td>강의실</td>
              <td>
                {syllabus.roomId} ({syllabus.collegeName})
              </td>
            </tr>
          </tbody>
        </table>

        <table border="1" className="syllabus-table">
          <tbody>
            <tr>
              <td rowSpan="2">교강사 정보</td>
              <td>소속</td>
              <td>{syllabus.deptName}</td>
              <td>성명</td>
              <td>{syllabus.professorName}</td>
            </tr>

            <tr>
              <td>연락처</td>
              <td>{syllabus.tel}</td>
              <td>email</td>
              <td>{syllabus.email}</td>
            </tr>
          </tbody>
        </table>

        <div className="syllabus-section">
          <h3>강의 개요</h3>
          <div
            className="syllabus-text"
            dangerouslySetInnerHTML={{
              __html:
                syllabus.overview?.replace(/\n/g, "<br>") ||
                "등록된 내용이 없습니다.",
            }}
          />
        </div>

        <div className="syllabus-section">
          <h3>강의 목표</h3>
          <div
            className="syllabus-text"
            dangerouslySetInnerHTML={{
              __html:
                syllabus.objective?.replace(/\n/g, "<br>") ||
                "등록된 내용이 없습니다.",
            }}
          />
        </div>

        <div className="syllabus-section">
          <h3>강의 계획</h3>
          <div
            className="syllabus-text"
            dangerouslySetInnerHTML={{
              __html:
                syllabus.program?.replace(/\n/g, "<br>") ||
                "등록된 내용이 없습니다.",
            }}
          />
        </div>

        <div className="syllabus-section">
          <h3>교재</h3>
          <div className="syllabus-text">
            {syllabus.textbook || "별도 교재 없음"}
          </div>
        </div>
      </div>
    </div>
  );
}
