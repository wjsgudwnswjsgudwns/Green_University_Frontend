import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/syllabus.css";

export default function ReadSyllabusPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [syllabus, setSyllabus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyllabus = async () => {
      try {
        const response = await api.get(`/api/subject/syllabus/${subjectId}`);
        setSyllabus(response.data.syllabus);
      } catch (error) {
        console.error("강의계획서 조회 실패:", error);
        alert("강의계획서를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchSyllabus();
  }, [subjectId]);

  if (loading) {
    return (
      <div className="syllabus-container">
        <p style={{ textAlign: "center", padding: "40px" }}>로딩 중...</p>
      </div>
    );
  }

  if (!syllabus) {
    return (
      <div className="syllabus-container">
        <p style={{ textAlign: "center", padding: "40px" }}>
          강의계획서를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="syllabus-page">
      <header>
        <div className="syllabus-header-top"></div>
      </header>

      <section>
        <div className="syllabus-section-header">
          <h2>강의 계획서 조회</h2>
          <br />
        </div>

        {/* 교과목 정보 */}
        <table border="1" className="syllabus-table">
          <colgroup>
            <col className="syllabus-col1" />
            <col className="syllabus-col2" />
            <col className="syllabus-col3" />
            <col className="syllabus-col4" />
            <col className="syllabus-col5" />
          </colgroup>
          <tbody>
            <tr>
              <td rowSpan="4">교과목 정보</td>
              <td>수업 번호</td>
              <td>{syllabus.subjectId}</td>
              <td>교과목 명</td>
              <td>{syllabus.name}</td>
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
              <td>
                {syllabus.subDay} {syllabus.startTime}:00 - {syllabus.endTime}
                :00
              </td>
              <td>강의실</td>
              <td>
                {syllabus.roomId}({syllabus.collegeName})
              </td>
            </tr>
          </tbody>
        </table>

        <br />

        {/* 교강사 정보 */}
        <table border="1" className="syllabus-table">
          <colgroup>
            <col className="syllabus-col1" />
            <col className="syllabus-col2" />
            <col className="syllabus-col3" />
            <col className="syllabus-col4" />
            <col className="syllabus-col5" />
          </colgroup>
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

        <br />

        {/* 강의 상세 정보 */}
        <table border="1" className="syllabus-table">
          <colgroup>
            <col style={{ width: "14%" }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <td>강의 개요</td>
              <td className="syllabus-align-left">{syllabus.overview}</td>
            </tr>
            <tr>
              <td>강의 목표</td>
              <td className="syllabus-align-left">{syllabus.objective}</td>
            </tr>
            <tr>
              <td>교재 정보</td>
              <td className="syllabus-align-left">{syllabus.textbook}</td>
            </tr>
            <tr>
              <td>주간 계획</td>
              <td className="syllabus-align-left">{syllabus.program}</td>
            </tr>
          </tbody>
        </table>

        {/* 교수만 수정 버튼 표시 */}
        {user?.userRole === "professor" && (
          <table style={{ marginTop: "20px" }}>
            <tbody>
              <tr>
                <td>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/professor/syllabus/edit/${subjectId}`);
                    }}
                  >
                    수정하기
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
