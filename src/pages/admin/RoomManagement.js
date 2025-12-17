import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/adminManagement.css";

export default function RoomManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [roomList, setRoomList] = useState([]);
  const [collegeList, setCollegeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [crud, setCrud] = useState(searchParams.get("crud") || "select");
  const [formData, setFormData] = useState({
    id: "",
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
      const response = await api.get(`/api/admin/room?crud=${crud}`);
      setRoomList(response.data.roomList || []);
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
    setFormData({ id: "", collegeId: "" });
    fetchData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.id.trim()) {
      setError("강의실 번호를 입력해주세요.");
      return;
    }

    if (!formData.collegeId) {
      setError("단과대 번호를 입력해주세요.");
      return;
    }

    try {
      await api.post("/api/admin/room", formData);
      alert("강의실이 등록되었습니다.");
      setFormData({ id: "", collegeId: "" });
      fetchData();
    } catch (err) {
      console.error("강의실 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("강의실 등록에 실패했습니다.");
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`"${id}" 강의실을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await api.get(`/api/admin/roomDelete?id=${id}`);
      alert("강의실이 삭제되었습니다.");
      fetchData();
    } catch (err) {
      console.error("강의실 삭제 실패:", err);
      alert("강의실 삭제에 실패했습니다.");
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
          <Link to="/staff/admin/room" className="admin-menu-item active">
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
        <h1>강의실</h1>
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
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="admin-form-header">
              <span className="material-symbols-outlined">school</span>
              <span className="admin-form-title">등록하기</span>
            </div>
            <div className="admin-form-content">
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleChange}
                placeholder="등록할 강의실을 입력하세요"
                className="admin-input"
              />
              <input
                type="text"
                name="collegeId"
                value={formData.collegeId}
                onChange={handleChange}
                placeholder="단과대 번호를 입력하세요"
                className="admin-input"
              />
              <button type="submit" className="admin-button">
                입력
              </button>
            </div>
          </form>
        )}

        {/* 삭제 안내 */}
        {crud === "delete" && (
          <p className="admin-delete-notice">삭제할 강의실을 클릭해주세요</p>
        )}

        {/* 강의실 목록 */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>강의실</th>
                <th>단과대ID</th>
              </tr>
            </thead>
            <tbody>
              {roomList.length > 0 ? (
                roomList.map((room) => (
                  <tr key={room.id}>
                    <td>
                      {crud === "delete" ? (
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="admin-delete-link"
                        >
                          {room.id}
                        </button>
                      ) : (
                        room.id
                      )}
                    </td>
                    <td>{room.college?.id || room.collegeId}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="admin-no-data">
                    등록된 강의실이 없습니다.
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
