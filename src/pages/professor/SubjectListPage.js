import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/subject.css";

export default function SubjectListPage() {
  const { user } = useAuth();
  const { page } = useParams();
  const navigate = useNavigate();
  const currentPage = parseInt(page) || 1;

  const [subjects, setSubjects] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [subNameList, setSubNameList] = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 검색 필터
  const [filters, setFilters] = useState({
    subYear: new Date().getFullYear(),
    semester: 1,
    deptId: -1,
    name: "",
  });

  useEffect(() => {
    fetchSubjects();
  }, [currentPage]);

  const fetchSubjects = async () => {
    try {
      const response = await api.get(`/api/subject/list/${currentPage}`);
      setSubjects(response.data.subjectList);
      setDeptList(response.data.deptList);
      setSubNameList(response.data.subNameList);
      setSubjectCount(response.data.subjectCount);
      setPageCount(response.data.pageCount);
    } catch (err) {
      console.error("강의 목록 조회 실패:", err);
      setError("강의 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filters.subYear) params.append("subYear", filters.subYear);
      if (filters.semester) params.append("semester", filters.semester);
      if (filters.deptId && filters.deptId !== -1)
        params.append("deptId", filters.deptId);
      if (filters.name) params.append("name", filters.name);

      const response = await api.get(
        `/api/subject/list/search?${params.toString()}`
      );
      setSubjects(response.data.subjectList);
      setSubjectCount(response.data.subjectCount);
      setPageCount(0); // 검색 결과는 페이징 없음
    } catch (err) {
      console.error("강의 검색 실패:", err);
      setError("강의 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyllabusClick = (subjectId) => {
    window.open(
      `/subject/syllabus/${subjectId}`,
      "_blank",
      "width=1000,height=1000"
    );
  };

  if (loading) {
    return (
      <div className="subject-page-container">
        <div className="subject-loading-container">
          <div className="subject-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subject-container">
      <aside className="subject-side-menu">
        <div className="subject-side-menu-header">
          <h2>수업</h2>
        </div>
        <nav className="subject-side-menu-nav">
          <Link to="/subject/list/1" className="subject-menu-item active">
            전체 강의 조회
          </Link>
          {user?.userRole === "professor" && (
            <>
              <Link to="/professor/subject" className="subject-menu-item">
                내 강의 조회
              </Link>
              <Link to="/evaluation/read" className="subject-menu-item">
                내 강의 평가
              </Link>
            </>
          )}
        </nav>
      </aside>

      <main className="subject-main">
        <h1>전체 강의 조회</h1>
        <div className="subject-divider"></div>

        {error && <div className="subject-error-message">{error}</div>}

        {/* 검색 필터 */}
        <form onSubmit={handleSearch} className="subject-filter">
          <div className="subject-filter-group">
            <label htmlFor="subYear">연도</label>
            <input
              type="number"
              id="subYear"
              name="subYear"
              value={filters.subYear}
              onChange={handleFilterChange}
              min="2005"
              max="2030"
            />
          </div>

          <div className="subject-filter-group">
            <label htmlFor="semester">학기</label>
            <select
              id="semester"
              name="semester"
              value={filters.semester}
              onChange={handleFilterChange}
            >
              <option value="1">1학기</option>
              <option value="2">2학기</option>
            </select>
          </div>

          <div className="subject-filter-group">
            <label htmlFor="deptId">개설학과</label>
            <select
              id="deptId"
              name="deptId"
              value={filters.deptId}
              onChange={handleFilterChange}
            >
              <option value="-1">전체</option>
              {deptList.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="subject-filter-group">
            <label htmlFor="name">강의명</label>
            <input
              type="text"
              id="name"
              name="name"
              list="subNameList"
              value={filters.name}
              onChange={handleFilterChange}
              placeholder="강의명 검색"
            />
            <datalist id="subNameList">
              {subNameList.map((name, index) => (
                <option key={index} value={name} />
              ))}
            </datalist>
          </div>

          <button type="submit" className="subject-search-button">
            조회
          </button>
        </form>

        {/* 강의 목록 */}
        {subjects.length > 0 ? (
          <>
            <h4 className="subject-list-title">
              <span>강의 목록</span>
              <span className="subject-count">[이 {subjectCount}건]</span>
            </h4>

            <div className="subject-table-container">
              <table className="subject-table">
                <thead>
                  <tr>
                    <th>연도/학기</th>
                    <th>단과대학</th>
                    <th>개설학과</th>
                    <th>학수번호</th>
                    <th>강의구분</th>
                    <th className="subject-name-cell">강의명</th>
                    <th>담당교수</th>
                    <th>학점</th>
                    <th>수강인원</th>
                    <th>정원</th>
                    <th>강의계획서</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td>
                        {subject.subYear}-{subject.semester}학기
                      </td>
                      <td>{subject.collName}</td>
                      <td>{subject.deptName}</td>
                      <td>{subject.id}</td>
                      <td>{subject.type}</td>
                      <td className="subject-name-cell">{subject.name}</td>
                      <td>{subject.professorName}</td>
                      <td>{subject.grades}</td>
                      <td>{subject.numOfStudent}</td>
                      <td>{subject.capacity}</td>
                      <td>
                        <button
                          className="subject-syllabus-button"
                          onClick={() => handleSyllabusClick(subject.id)}
                        >
                          조회
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이징 */}
            {pageCount > 0 && (
              <div className="subject-pagination">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <Link
                      key={pageNum}
                      to={`/subject/list/${pageNum}`}
                      className={pageNum === currentPage ? "active" : ""}
                    >
                      {pageNum}
                    </Link>
                  )
                )}
              </div>
            )}
          </>
        ) : (
          <div className="subject-no-data">검색 결과가 없습니다.</div>
        )}
      </main>
    </div>
  );
}
