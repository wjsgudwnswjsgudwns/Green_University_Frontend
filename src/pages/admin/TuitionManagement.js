import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/adminManagement.css";

export default function TuitionManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [collTuitList, setCollTuitList] = useState([]);
  const [collegeList, setCollegeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [crud, setCrud] = useState(searchParams.get("crud") || "select");
  const [formData, setFormData] = useState({
    collegeId: "",
    amount: "",
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
      const response = await api.get(`/api/admin/tuition?crud=${crud}`);
      setCollTuitList(response.data.collTuitList || []);
      setCollegeList(response.data.collegeList || []);
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
    setFormData({ collegeId: "", amount: "" });
    fetchData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.collegeId) {
      setError("단과대학을 선택해주세요.");
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      setError("등록금을 입력해주세요.");
      return;
    }

    try {
      await api.post("/api/admin/tuition", {
        collegeId: parseInt(formData.collegeId),
        amount: parseInt(formData.amount),
      });
      alert("등록금이 등록되었습니다.");
      setFormData({ collegeId: "", amount: "" });
      fetchData();
    } catch (err) {
      console.error("등록금 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("등록금 등록에 실패했습니다.");
      }
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.collegeId) {
      setError("단과대학을 선택해주세요.");
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      setError("등록금을 입력해주세요.");
      return;
    }

    try {
      await api.put("/api/admin/tuitionUpdate", {
        collegeId: parseInt(formData.collegeId),
        amount: parseInt(formData.amount),
      });
      alert("등록금이 수정되었습니다.");
      setFormData({ collegeId: "", amount: "" });
      fetchData();
    } catch (err) {
      console.error("등록금 수정 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("등록금 수정에 실패했습니다.");
      }
    }
  };

  const handleDelete = async (collegeId, name) => {
    if (!window.confirm(`"${name}" 단과대학의 등록금을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await api.get(`/api/admin/tuitionDelete?collegeId=${collegeId}`);
      alert("등록금이 삭제되었습니다.");
      fetchData();
    } catch (err) {
      console.error("등록금 삭제 실패:", err);
      alert("등록금 삭제에 실패했습니다.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
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
          <Link to="/staff/admin/college" className="admin-menu-item">
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
          <Link to="/staff/admin/tuition" className="admin-menu-item active">
            단대별 등록금
          </Link>
        </nav>
      </aside>

      <main className="admin-main-content">
        <h1>단대별 등록금</h1>
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
            onClick={() => handleCrudChange("update")}
            className={`admin-crud-button ${crud === "update" ? "active" : ""}`}
          >
            수정
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
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="admin-form-header">
              <span className="admin-form-title">등록하기</span>
            </div>
            <div className="admin-form-content">
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
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="등록금을 입력해주세요"
                className="admin-input"
                min="0"
              />
              <button type="submit" className="admin-button">
                입력
              </button>
            </div>
          </form>
        )}

        {/* 수정 폼 */}
        {crud === "update" && (
          <form onSubmit={handleUpdate} className="admin-form">
            <div className="admin-form-header">
              <span className="admin-form-title">수정하기</span>
            </div>
            <div className="admin-form-content">
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
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="등록금을 입력하세요"
                className="admin-input"
                min="0"
              />
              <button type="submit" className="admin-button">
                수정
              </button>
            </div>
          </form>
        )}

        {/* 삭제 안내 */}
        {crud === "delete" && (
          <p className="admin-delete-notice">
            등록금을 삭제할 단과대학을 클릭해주세요
          </p>
        )}

        {/* 등록금 목록 */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>단과대</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              {collTuitList.length > 0 ? (
                collTuitList.map((tuit) => (
                  <tr key={tuit.collegeId}>
                    <td>{tuit.collegeId}</td>
                    <td>
                      {crud === "delete" ? (
                        <button
                          onClick={() =>
                            handleDelete(tuit.collegeId, tuit.name)
                          }
                          className="admin-delete-link"
                        >
                          {tuit.name}
                        </button>
                      ) : (
                        tuit.name
                      )}
                    </td>
                    <td>{formatAmount(tuit.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="admin-no-data">
                    등록된 등록금이 없습니다.
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
