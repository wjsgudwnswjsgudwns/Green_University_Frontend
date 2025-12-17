import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/adminManagement.css";

export default function CollegeManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collegeList, setCollegeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [crud, setCrud] = useState(searchParams.get("crud") || "select");
  const [formData, setFormData] = useState({ name: "" });

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchCollegeList();
  }, [user, navigate]);

  useEffect(() => {
    const crudParam = searchParams.get("crud") || "select";
    setCrud(crudParam);
  }, [searchParams]);

  const fetchCollegeList = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/college?crud=${crud}`);
      setCollegeList(response.data.collegeList || []);
    } catch (err) {
      console.error("단과대학 목록 조회 실패:", err);
      setError("단과대학 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCrudChange = (newCrud) => {
    setSearchParams({ crud: newCrud });
    setCrud(newCrud);
    setError("");
    setFormData({ name: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("단과대학 이름을 입력해주세요.");
      return;
    }

    try {
      await api.post("/api/admin/college", formData);
      alert("단과대학이 등록되었습니다.");
      setFormData({ name: "" });
      fetchCollegeList();
    } catch (err) {
      console.error("단과대학 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("단과대학 등록에 실패했습니다.");
      }
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" 단과대학을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await api.get(`/api/admin/collegeDelete?id=${id}`);
      alert("단과대학이 삭제되었습니다.");
      fetchCollegeList();
    } catch (err) {
      console.error("단과대학 삭제 실패:", err);
      alert("단과대학 삭제에 실패했습니다.");
    }
  };

  const handleChange = (e) => {
    setFormData({ name: e.target.value });
  };

  if (loading) {
    return (
      <div className="admin-page-wrapper">
        <div className="admin-loading-container">
          <div className="admin-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <aside className="admin-side-menu">
        <div className="admin-side-menu-header">
          <h2>등록</h2>
        </div>
        <nav className="admin-side-menu-nav">
          <Link to="/staff/admin/college" className="admin-menu-item active">
            단과대학
          </Link>
          <Link to="/staff/admin/department" className="admin-menu-item">
            학과
          </Link>
          <Link to="/staff/admin/room" className="admin-menu-item">
            강의실
          </Link>
          <Link to="/staff/admin/subject" className="admin-menu-item">
            강의
          </Link>
          <Link to="/staff/admin/tuition" className="admin-menu-item">
            단대별 등록금
          </Link>
        </nav>
      </aside>

      <main className="admin-main-content">
        <h1>단과대학</h1>
        <div className="admin-divider"></div>

        {/* CRUD 버튼 */}
        <div className="admin-crud-buttons">
          <button
            onClick={() => handleCrudChange("insert")}
            className={`admin-crud-button ${crud === "insert" ? "active" : ""}`}
          >
            등록
          </button>
          <button
            onClick={() => handleCrudChange("delete")}
            className={`admin-crud-button ${crud === "delete" ? "active" : ""}`}
          >
            삭제
          </button>
        </div>

        {error && <div className="admin-error-message">{error}</div>}

        {/* 등록 폼 */}
        {crud === "insert" && (
          <>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-form-header">
                <span className="material-symbols-outlined">school</span>
                <span className="admin-form-title">등록하기</span>
              </div>
              <div className="admin-form-content">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="단과대학을 입력해주세요"
                  className="admin-input"
                />
                <button type="submit" className="admin-button">
                  입력
                </button>
              </div>
            </form>
          </>
        )}

        {/* 삭제 안내 */}
        {crud === "delete" && (
          <p className="admin-delete-notice">
            삭제할 단과대학 이름을 클릭해주세요
          </p>
        )}

        {/* 단과대학 목록 */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
              </tr>
            </thead>
            <tbody>
              {collegeList.length > 0 ? (
                collegeList.map((college) => (
                  <tr key={college.id}>
                    <td>{college.id}</td>
                    <td>
                      {crud === "delete" ? (
                        <button
                          onClick={() => handleDelete(college.id, college.name)}
                          className="admin-delete-link"
                        >
                          {college.name}
                        </button>
                      ) : (
                        college.name
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="admin-no-data">
                    등록된 단과대학이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
