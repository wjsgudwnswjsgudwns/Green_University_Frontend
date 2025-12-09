import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/subject.css";
import "../../styles/ProfessorSubjectListPage.css";

export default function ProfessorSubjectListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [semesterList, setSemesterList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(true);

  // 교수가 아니면 접근 불가
  useEffect(() => {
    if (user?.userRole !== "professor") {
      alert("접근 권한이 없습니다.");
      navigate("/");
    }
  }, [user, navigate]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchSubjectList();
  }, []);

  const fetchSubjectList = async (period = null) => {
    try {
      let response;
      if (period) {
        // 특정 학기 조회
        response = await api.post("/api/professor/subject", null, {
          params: { period },
        });
      } else {
        // 현재 학기 조회
        response = await api.get("/api/professor/subject");
      }

      setSemesterList(response.data.semesterList || []);
      setSubjectList(response.data.subjectList || []);
    } catch (error) {
      console.error("강의 목록 조회 실패:", error);
      alert("강의 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (e) => {
    const period = e.target.value;
    setSelectedPeriod(period);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedPeriod) {
      fetchSubjectList(selectedPeriod);
    }
  };

  // 강의계획서 팝업
  const openSyllabus = (subjectId) => {
    window.open(
      `/subject/syllabus/${subjectId}`,
      "_blank",
      "width=1000,height=1000"
    );
  };

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
          <table className="sub--menu--table">
            <tbody>
              <tr>
                <td>
                  <a href="/subject/list/1">전체 강의 조회</a>
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
                  <a href="/evaluation/read">내 강의 평가</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>내 강의 조회</h1>
        <div className="split--div"></div>

        {/* 학기 선택 필터 */}
        <div className="sub--filter">
          <form onSubmit={handleSearch}>
            <div>
              <select
                name="period"
                value={selectedPeriod}
                onChange={handlePeriodChange}
              >
                {semesterList.map((semester) => (
                  <option
                    key={`${semester.subYear}-${semester.semester}`}
                    value={`${semester.subYear}year${semester.semester}`}
                  >
                    {semester.subYear}년도 {semester.semester}학기
                  </option>
                ))}
              </select>
              <button type="submit">
                <ul
                  className="d-flex justify-content-center"
                  style={{ margin: 0 }}
                >
                  <li style={{ height: "24px", marginRight: "2px" }}>조회</li>
                </ul>
              </button>
            </div>
          </form>
        </div>

        <h4>
          <span style={{ fontWeight: 600 }}>강의 목록</span>
        </h4>

        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : subjectList.length > 0 ? (
          <table border="1" className="sub--list--table">
            <thead>
              <tr>
                <th>학수번호</th>
                <th>강의명</th>
                <th>강의시간</th>
                <th>강의계획서</th>
                <th>학생 목록</th>
              </tr>
            </thead>
            <tbody>
              {subjectList.map((subject) => (
                <tr key={subject.id}>
                  <td>{subject.id}</td>
                  <td>{subject.name}</td>
                  <td>
                    {subject.subDay}{" "}
                    {subject.startTime < 10
                      ? `0${subject.startTime}`
                      : subject.startTime}
                    :00-
                    {subject.endTime}:00 ({subject.room.id})
                  </td>
                  <td>
                    <ul
                      className="d-flex justify-content-center sub--plan--view"
                      style={{ margin: 0 }}
                    >
                      <li style={{ height: "24px" }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openSyllabus(subject.id);
                          }}
                        >
                          조회
                        </a>
                      </li>
                    </ul>
                  </td>
                  <td>
                    <ul
                      className="d-flex justify-content-center sub--plan--view"
                      style={{ margin: 0 }}
                    >
                      <li style={{ height: "24px" }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/professor/subject/${subject.id}`);
                          }}
                        >
                          조회
                        </a>
                      </li>
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no--list--p">해당 학기에 강의가 없습니다.</p>
        )}
      </main>
    </div>
  );
}
