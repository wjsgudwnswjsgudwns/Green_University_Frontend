import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/adminManagement.css";

export default function DepartmentManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [departmentList, setDepartmentList] = useState([]);
  const [collegeList, setCollegeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [crud, setCrud] = useState(searchParams.get("crud") || "select");
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    collegeId: "",
  });

  useEffect(() => {
    if (user?.userRole !== "staff") {
      navigate("/");
      return;
    }
    fetchData();
  }, [user, navigate]);

  useEffect(() => {
    const crudParam = searchParams.get("crud") || "select";
    setCrud(crudParam);
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/department?crud=${crud}`);
      setDepartmentList(response.data.departmentList || []);
      setCollegeList(response.data.collegeList || []);

      // 수정 모드일 때 첫 번째 학과를 기본값으로 설정
      if (crud === "update" && response.data.departmentList?.length > 0) {
        setFormData((prev) => ({
          ...prev,
          id: response.data.departmentList[0].id,
        }));
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCrudChange = (newCrud) => {
    setSearchParams({ crud: newCrud });
    setCrud(newCrud);
    setError("");
    setFormData({ id: "", name: "", collegeId: "" });
    fetchData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("학과 이름을 입력해주세요.");
      return;
    }

    if (!formData.collegeId) {
      setError("단과대학을 선택해주세요.");
      return;
    }

    try {
      await api.post("/api/admin/department", {
        name: formData.name,
        collegeId: parseInt(formData.collegeId),
      });
      alert("학과가 등록되었습니다.");
      setFormData({ id: "", name: "", collegeId: "" });
      fetchData();
    } catch (err) {
      console.error("학과 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("학과 등록에 실패했습니다.");
      }
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.id) {
      setError("수정할 학과를 선택해주세요.");
      return;
    }

    if (!formData.name.trim()) {
      setError("변경할 학과명을 입력해주세요.");
      return;
    }

    try {
      await api.put("/api/admin/department", {
        id: parseInt(formData.id),
        name: formData.name,
      });
      alert("학과가 수정되었습니다.");
      setFormData({ id: "", name: "", collegeId: "" });
      fetchData();
    } catch (err) {
      console.error("학과 수정 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("학과 수정에 실패했습니다.");
      }
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" 학과를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await api.get(`/api/admin/departmentDelete?id=${id}`);
      alert("학과가 삭제되었습니다.");
      fetchData();
    } catch (err) {
      console.error("학과 삭제 실패:", err);
      alert("학과 삭제에 실패했습니다.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-page-container">
      <aside className="side-menu">
        <div className="side-menu-header">
          <h2>등록</h2>
        </div>
        <nav className="side-menu-nav">
          <Link to="/staff/admin/college" className="menu-item">
            단과대학
          </Link>
          <Link to="/staff/admin/department" className="menu-item active">
            학과
          </Link>
          <Link to="/staff/admin/room" className="menu-item">
            강의실
          </Link>
          <Link to="/staff/admin/subject" className="menu-item">
            강의
          </Link>
          <Link to="/staff/admin/tuition" className="menu-item">
            단대별 등록금
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        <h1>학과</h1>
        <div className="divider"></div>

        {/* CRUD 버튼 */}
        <div className="crud-buttons">
          <button
            onClick={() => handleCrudChange("insert")}
            className={`crud-button ${crud === "insert" ? "active" : ""}`}
          >
            등록
          </button>
          <button
            onClick={() => handleCrudChange("update")}
            className={`crud-button ${crud === "update" ? "active" : ""}`}
          >
            수정
          </button>
          <button
            onClick={() => handleCrudChange("delete")}
            className={`crud-button ${crud === "delete" ? "active" : ""}`}
          >
            삭제
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* 등록 폼 */}
        {crud === "insert" && (
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-header">
              <span className="material-symbols-outlined">school</span>
              <span className="form-title">등록하기</span>
            </div>
            <div className="form-content">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="학과를 입력해주세요"
                className="admin-input"
              />
              <select
                name="collegeId"
                value={formData.collegeId}
                onChange={handleChange}
                className="admin-select"
                required
              >
                <option value="">단과대학 선택</option>
                {collegeList.map((college) => (
                  <option key={college.id} value={college.id}>
                    {college.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="admin-button">
                입력
              </button>
            </div>
          </form>
        )}

        {/* 수정 폼 */}
        {crud === "update" && (
          <form onSubmit={handleUpdate} className="admin-form">
            <div className="form-header">
              <span className="material-symbols-outlined">school</span>
              <span className="form-title">수정하기</span>
            </div>
            <div className="form-content">
              <select
                name="id"
                value={formData.id}
                onChange={handleChange}
                className="admin-select"
                required
              >
                <option value="">수정할 학과 선택</option>
                {departmentList.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="변경할 학과명을 입력하세요"
                className="admin-input"
              />
              <button type="submit" className="admin-button">
                수정
              </button>
            </div>
          </form>
        )}

        {/* 삭제 안내 */}
        {crud === "delete" && (
          <p className="delete-notice">삭제할 학과 이름을 클릭해주세요</p>
        )}

        {/* 학과 목록 */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>학과명</th>
                <th>단과대ID</th>
              </tr>
            </thead>
            <tbody>
              {departmentList.length > 0 ? (
                departmentList.map((dept) => (
                  <tr key={dept.id}>
                    <td>{dept.id}</td>
                    <td>
                      {crud === "delete" ? (
                        <button
                          onClick={() => handleDelete(dept.id, dept.name)}
                          className="delete-link"
                        >
                          {dept.name}
                        </button>
                      ) : (
                        dept.name
                      )}
                    </td>
                    <td>{dept.college?.id || dept.collegeId}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="no-data">
                    등록된 학과가 없습니다.
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
