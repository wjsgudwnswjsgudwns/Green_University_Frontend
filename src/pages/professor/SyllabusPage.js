import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/syllabus.css";

export default function SyllabusPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [syllabus, setSyllabus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    fetchSyllabus();
  }, [subjectId]);

  const fetchSyllabus = async () => {
    try {
      const response = await api.get(`/api/subject/syllabus/${subjectId}`);
      setSyllabus(response.data.syllabus);

      // 교수이고, 본인의 강의인지 확인
      if (
        user?.userRole === "professor" &&
        response.data.syllabus.professorId === user.id
      ) {
        setCanEdit(true);
      }
    } catch (err) {
      console.error("강의계획서 조회 실패:", err);
      setError("강의계획서를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/professor/syllabus/edit/${subjectId}`);
  };

  if (loading) {
    return (
      <div className="syllabus-page">
        <div className="syllabus-loading-container">
          <div className="syllabus-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !syllabus) {
    return (
      <div className="syllabus-page">
        <div className="syllabus-error-container">
          <p>{error || "강의계획서를 찾을 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="syllabus-page">
      <div className="syllabus-header">
        <h1>강의계획서</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          {canEdit && (
            <button onClick={handleEdit} className="syllabus-edit-button">
              수정하기
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="syllabus-print-button"
          >
            인쇄
          </button>
        </div>
      </div>

      <div className="syllabus-content">
        <table className="syllabus-table">
          <tbody>
            <tr>
              <td rowSpan="4" className="syllabus-category">
                교과목 정보
              </td>
              <td className="syllabus-label">수업 번호</td>
              <td className="syllabus-value">{syllabus.subjectId}</td>
              <td className="syllabus-label">교과목 명</td>
              <td className="syllabus-value">{syllabus.subjectName}</td>
            </tr>

            <tr>
              <td className="syllabus-label">수업 연도</td>
              <td className="syllabus-value">{syllabus.subYear}</td>
              <td className="syllabus-label">수업 학기</td>
              <td className="syllabus-value">{syllabus.semester}</td>
            </tr>

            <tr>
              <td className="syllabus-label">학점</td>
              <td className="syllabus-value">{syllabus.grades}</td>
              <td className="syllabus-label">이수 구분</td>
              <td className="syllabus-value">{syllabus.type}</td>
            </tr>

            <tr>
              <td className="syllabus-label">강의 시간</td>
              <td className="syllabus-value">{syllabus.classTime || "-"}</td>
              <td className="syllabus-label">강의실</td>
              <td className="syllabus-value">
                {syllabus.roomId} ({syllabus.collegeName})
              </td>
            </tr>
          </tbody>
        </table>

        <table className="syllabus-table">
          <tbody>
            <tr>
              <td rowSpan="2" className="syllabus-category">
                교강사 정보
              </td>
              <td className="syllabus-label">소속</td>
              <td className="syllabus-value">{syllabus.deptName}</td>
              <td className="syllabus-label">성명</td>
              <td className="syllabus-value">{syllabus.professorName}</td>
            </tr>

            <tr>
              <td className="syllabus-label">연락처</td>
              <td className="syllabus-value">{syllabus.tel}</td>
              <td className="syllabus-label">email</td>
              <td className="syllabus-value">{syllabus.email}</td>
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
