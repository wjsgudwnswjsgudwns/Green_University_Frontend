import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/SemesterGrade.css";

const SemesterGrade = () => {
  const navigate = useNavigate();
  const [gradeList, setGradeList] = useState([]);
  const [yearList, setYearList] = useState([]);
  const [semesterList, setSemesterList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedType, setSelectedType] = useState("전체");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/grade/semester");
      const data = response.data;

      setYearList(data.yearList || []);
      setSemesterList(data.semesterList || []);
      setGradeList(data.gradeList || []);
    } catch (error) {
      console.error("학기별 성적 조회 실패:", error);
      alert("학기별 성적을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedYear || !selectedSemester) {
      alert("연도와 학기를 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/grade/read", null, {
        params: {
          type: selectedType,
          subYear: selectedYear,
          semester: selectedSemester,
        },
      });
      const data = response.data;
      setGradeList(data.gradeList || []);
    } catch (error) {
      console.error("학기별 성적 조회 실패:", error);
      alert("학기별 성적을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="semester-grade-container">
      {/* 사이드 메뉴 */}
      <div className="sg-sub-menu">
        <div className="sg-sub-menu-top">
          <h2>성적</h2>
        </div>
        <div className="sg-sub-menu-mid">
          <table className="sg-sub-menu-table">
            <tbody>
              <tr>
                <td>
                  <a href="/grade/thisSemester">금학기 성적 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/grade/semester" className="sg-selected-menu">
                    학기별 성적 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/grade/total">누계 성적</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="sg-main">
        <h1>학기별 성적 조회</h1>
        <div className="sg-split-div"></div>

        {/* 검색 필터 */}
        <div className="sg-filter">
          <div className="sg-filter-content">
            <select
              className="sg-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">연도 선택</option>
              {yearList.map((year, index) => (
                <option key={index} value={year}>
                  {year}년
                </option>
              ))}
            </select>

            <select
              className="sg-select"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="">학기 선택</option>
              {semesterList.map((semester, index) => (
                <option key={index} value={semester}>
                  {semester}학기
                </option>
              ))}
            </select>

            <select
              className="sg-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="전체">전체</option>
              <option value="전공">전공</option>
              <option value="교양">교양</option>
            </select>

            <button
              className="sg-search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              <ul className="sg-btn-content">
                <li className="sg-btn-text">조회</li>
              </ul>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="sg-no-list-p">로딩 중...</p>
        ) : gradeList.length > 0 ? (
          <>
            <h4 className="sg-section-title">과목별 성적</h4>
            <table border="1" className="sg-list-table">
              <thead>
                <tr>
                  <th>연도</th>
                  <th>학기</th>
                  <th>과목번호</th>
                  <th>과목명</th>
                  <th>강의구분</th>
                  <th>이수학점</th>
                  <th>성적</th>
                </tr>
              </thead>
              <tbody>
                {gradeList.map((grade, index) => (
                  <tr key={index}>
                    <td>{grade.subYear}년</td>
                    <td>{grade.semester}학기</td>
                    <td>{grade.subjectId}</td>
                    <td className="sg-list-name">{grade.name}</td>
                    <td>{grade.type}</td>
                    <td>{grade.grades}</td>
                    <td>{grade.grade || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="sg-no-list-p">연도와 학기를 선택하여 조회하세요.</p>
        )}
      </main>
    </div>
  );
};

export default SemesterGrade;
