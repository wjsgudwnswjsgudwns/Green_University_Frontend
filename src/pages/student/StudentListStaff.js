import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/staffList.css";

export default function StudentListStaff() {
  const { user } = useAuth();
  const { page: urlPage } = useParams();
  const navigate = useNavigate();

  const [studentList, setStudentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(parseInt(urlPage) || 1);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState({
    deptId: "",
    studentId: "",
  });

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchStudentList(currentPage);
  }, [user, navigate, currentPage]);

  const fetchStudentList = async (page = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (filters.deptId) params.append("deptId", filters.deptId);
      if (filters.studentId) params.append("studentId", filters.studentId);

      const url =
        page === 1
          ? `/api/user/studentList?${params.toString()}`
          : `/api/user/studentList/${page}?${params.toString()}`;

      const response = await api.get(url);

      setStudentList(response.data.studentList || []);
      setTotalPages(response.data.totalPages || 1);
      setCurrentPage(response.data.currentPage || page);
    } catch (err) {
      console.error("학생 목록 조회 실패:", err);
      setError("학생 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchStudentList(1);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePageChange = (page) => {
    navigate(
      `/staff/student-list/${page}${
        filters.deptId ? `?deptId=${filters.deptId}` : ""
      }`
    );
    setCurrentPage(page);
    fetchStudentList(page);
  };

  const handleNewSemester = async () => {
    if (
      !window.confirm(
        "새학기를 적용하시겠습니까? 모든 학생의 학년과 학기가 업데이트됩니다."
      )
    ) {
      return;
    }

    try {
      await api.get("/api/user/student/update");
      alert("새학기가 적용되었습니다.");
      fetchStudentList(currentPage);
    } catch (err) {
      console.error("새학기 적용 실패:", err);
      alert("새학기 적용에 실패했습니다.");
    }
  };

  if (loading && studentList.length === 0) {
    return (
      <div className="mypage-container">
        <div className="mypage-loading-container">
          <div className="mypage-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage-container">
      <aside className="mypage-side-menu">
        <div className="mypage-side-menu-header">
          <h2>학사관리</h2>
        </div>
        <nav className="mypage-side-menu-nav">
          <Link to="/staff/student-list" className="mypage-menu-item active">
            학생 명단 조회
          </Link>
          <Link to="/staff/professor-list" className="mypage-menu-item">
            교수 명단 조회
          </Link>
          <Link to="/staff/register-student" className="mypage-menu-item">
            학생 등록
          </Link>
          <Link to="/staff/register-professor" className="mypage-menu-item">
            교수 등록
          </Link>
          <Link to="/staff/register-staff" className="mypage-menu-item">
            직원 등록
          </Link>
          <Link to="/staff/tuition/bill" className="mypage-menu-item">
            등록금 고지서 발송
          </Link>
          <Link to="/staff/break/list" className="mypage-menu-item">
            휴학 처리
          </Link>
          <Link to="/staff/course-period" className="mypage-menu-item">
            수강 신청 기간 설정
          </Link>
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>학생 명단 조회</h1>
        <div className="mypage-divider"></div>

        <div className="stafflist-filter-container">
          <form onSubmit={handleSearch} className="stafflist-filter-form">
            <div className="stafflist-filter-group">
              <label htmlFor="deptId">학과 번호</label>
              <input
                type="text"
                id="deptId"
                name="deptId"
                value={filters.deptId}
                onChange={handleFilterChange}
                placeholder="학과 번호"
              />

              <label htmlFor="studentId">학번</label>
              <input
                type="text"
                id="studentId"
                name="studentId"
                value={filters.studentId}
                onChange={handleFilterChange}
                placeholder="학번"
              />

              <button type="submit" className="stafflist-search-button">
                <span>조회</span>
                <span className="material-symbols-outlined">search</span>
              </button>

              <button
                type="button"
                onClick={handleNewSemester}
                className="stafflist-semester-button"
              >
                새학기 적용
              </button>
            </div>
          </form>
        </div>

        {error && <div className="mypage-error-message">{error}</div>}

        {studentList.length > 0 ? (
          <>
            <h4 className="stafflist-list-title">학생 목록</h4>
            <div className="stafflist-table-container">
              <table className="stafflist-data-table">
                <thead>
                  <tr>
                    <th>학번</th>
                    <th>이름</th>
                    <th>생년월일</th>
                    <th>성별</th>
                    <th>주소</th>
                    <th>전화번호</th>
                    <th>이메일</th>
                    <th>학과번호</th>
                    <th>학년</th>
                    <th>입학일</th>
                    <th>
                      졸업일
                      <br />
                      (졸업예정일)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studentList.map((student) => (
                    <tr key={student.id}>
                      <td>{student.id}</td>
                      <td>{student.name}</td>
                      <td>{student.birthDate}</td>
                      <td>{student.gender}</td>
                      <td className="text-left">{student.address}</td>
                      <td>{student.tel}</td>
                      <td>{student.email}</td>
                      <td>{student.deptId}</td>
                      <td>{student.grade}</td>
                      <td>{student.entranceDate}</td>
                      <td>{student.graduationDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="stafflist-pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`stafflist-page-button ${
                        page === currentPage ? "active" : ""
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>
            )}
          </>
        ) : (
          !loading && <p className="mypage-no-list-p">검색 결과가 없습니다.</p>
        )}
      </main>
    </div>
  );
}
