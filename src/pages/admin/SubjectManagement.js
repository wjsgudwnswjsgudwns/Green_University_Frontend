import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/adminManagement.css";

export default function SubjectManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subjectList, setSubjectList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [crud, setCrud] = useState(searchParams.get("crud") || "select");

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    professorId: "",
    roomId: "",
    deptId: "",
    type: "전공",
    subYear: "",
    semester: "",
    subDay: "월",
    startTime: "",
    endTime: "",
    grades: "",
    capacity: "",
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
      const response = await api.get(`/api/admin/subject?crud=${crud}`);
      setSubjectList(response.data.subjectList || []);

      // 수정 모드일 때 첫 번째 강의를 기본값으로 설정
      if (crud === "update" && response.data.subjectList?.length > 0) {
        setFormData((prev) => ({
          ...prev,
          id: response.data.subjectList[0].id,
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
    setFormData({
      id: "",
      name: "",
      professorId: "",
      roomId: "",
      deptId: "",
      type: "전공",
      subYear: "",
      semester: "",
      subDay: "월",
      startTime: "",
      endTime: "",
      grades: "",
      capacity: "",
    });
    fetchData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (!formData.name.trim()) {
      setError("강의명을 입력해주세요.");
      return;
    }

    try {
      const requestData = {
        name: formData.name,
        professorId: parseInt(formData.professorId),
        roomId: formData.roomId,
        deptId: parseInt(formData.deptId),
        type: formData.type,
        subYear: parseInt(formData.subYear),
        semester: parseInt(formData.semester),
        subDay: formData.subDay,
        startTime: parseInt(formData.startTime),
        endTime: parseInt(formData.endTime),
        grades: parseInt(formData.grades),
        capacity: parseInt(formData.capacity),
        numOfStudent: 0,
      };

      await api.post("/api/admin/subject", requestData);
      alert("강의가 등록되었습니다.");
      setFormData({
        id: "",
        name: "",
        professorId: "",
        roomId: "",
        deptId: "",
        type: "전공",
        subYear: "",
        semester: "",
        subDay: "월",
        startTime: "",
        endTime: "",
        grades: "",
        capacity: "",
      });
      fetchData();
    } catch (err) {
      console.error("강의 등록 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("강의 등록에 실패했습니다.");
      }
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.id) {
      setError("수정할 강의를 선택해주세요.");
      return;
    }

    try {
      const requestData = {
        id: parseInt(formData.id),
        name: formData.name,
        professorId: parseInt(formData.professorId),
        roomId: formData.roomId,
        deptId: parseInt(formData.deptId),
        subDay: formData.subDay,
        startTime: parseInt(formData.startTime),
        endTime: parseInt(formData.endTime),
        capacity: parseInt(formData.capacity),
      };

      await api.put("/api/admin/subject", requestData);
      alert("강의가 수정되었습니다.");
      fetchData();
    } catch (err) {
      console.error("강의 수정 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("강의 수정에 실패했습니다.");
      }
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" 강의를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await api.get(`/api/admin/subjectDelete?id=${id}`);
      alert("강의가 삭제되었습니다.");
      fetchData();
    } catch (err) {
      console.error("강의 삭제 실패:", err);
      alert("강의 삭제에 실패했습니다.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const formatTime = (subject) => {
    const start =
      subject.startTime < 10 ? `0${subject.startTime}` : subject.startTime;
    return `${subject.subDay} ${start}:00-${subject.endTime}:00`;
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
          <Link to="/staff/admin/department" className="menu-item">
            학과
          </Link>
          <Link to="/staff/admin/room" className="menu-item">
            강의실
          </Link>
          <Link to="/staff/admin/subject" className="menu-item active">
            강의
          </Link>
          <Link to="/staff/admin/tuition" className="menu-item">
            단대별 등록금
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        <h1>강의</h1>
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
          <form
            onSubmit={handleSubmit}
            className="admin-form admin-form-vertical"
          >
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
                placeholder="강의명을 입력하세요"
                className="admin-input"
                required
              />
              <input
                type="number"
                name="professorId"
                value={formData.professorId}
                onChange={handleChange}
                placeholder="교수ID를 입력하세요"
                className="admin-input"
                required
              />
              <input
                type="text"
                name="roomId"
                value={formData.roomId}
                onChange={handleChange}
                placeholder="강의실을 입력하세요"
                className="admin-input"
                required
              />
              <input
                type="number"
                name="deptId"
                value={formData.deptId}
                onChange={handleChange}
                placeholder="학과ID를 입력하세요"
                className="admin-input"
                required
              />
              <div className="radio-group-inline">
                <label>
                  <input
                    type="radio"
                    name="type"
                    value="전공"
                    checked={formData.type === "전공"}
                    onChange={handleChange}
                  />
                  전공
                </label>
                <label>
                  <input
                    type="radio"
                    name="type"
                    value="교양"
                    checked={formData.type === "교양"}
                    onChange={handleChange}
                  />
                  교양
                </label>
              </div>
              <input
                type="number"
                name="subYear"
                value={formData.subYear}
                onChange={handleChange}
                placeholder="연도를 입력하세요"
                className="admin-input"
                required
              />
              <input
                type="number"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                placeholder="학기를 입력하세요 (1 or 2)"
                className="admin-input"
                min="1"
                max="2"
                required
              />
              <select
                name="subDay"
                value={formData.subDay}
                onChange={handleChange}
                className="admin-select"
              >
                <option value="월">월</option>
                <option value="화">화</option>
                <option value="수">수</option>
                <option value="목">목</option>
                <option value="금">금</option>
              </select>
              <input
                type="number"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                placeholder="시작시간을 입력하세요 (9-16)"
                className="admin-input"
                min="9"
                max="16"
                required
              />
              <input
                type="number"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                placeholder="종료시간을 입력하세요 (11-18)"
                className="admin-input"
                min="11"
                max="18"
                required
              />
              <input
                type="number"
                name="grades"
                value={formData.grades}
                onChange={handleChange}
                placeholder="학점을 입력하세요"
                className="admin-input"
                required
              />
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="정원을 입력하세요"
                className="admin-input"
                required
              />
              <button type="submit" className="admin-button">
                입력
              </button>
            </div>
          </form>
        )}

        {/* 수정 폼 */}
        {crud === "update" && (
          <form
            onSubmit={handleUpdate}
            className="admin-form admin-form-vertical"
          >
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
                <option value="">수정할 강의 선택</option>
                {subjectList.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.id} - {subject.name}
                  </option>
                ))}
              </select>
              <select
                name="subDay"
                value={formData.subDay}
                onChange={handleChange}
                className="admin-select"
              >
                <option value="월">월</option>
                <option value="화">화</option>
                <option value="수">수</option>
                <option value="목">목</option>
                <option value="금">금</option>
              </select>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="강의명을 입력하세요"
                className="admin-input"
              />
              <input
                type="text"
                name="roomId"
                value={formData.roomId}
                onChange={handleChange}
                placeholder="강의실을 입력하세요"
                className="admin-input"
              />
              <div className="form-row">
                <label>변경 시작시간</label>
                <select
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="admin-select"
                >
                  <option value="">선택</option>
                  {Array.from({ length: 8 }, (_, i) => i + 9).map((time) => (
                    <option key={time} value={time}>
                      {time}시
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>변경 종료시간</label>
                <select
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="admin-select"
                >
                  <option value="">선택</option>
                  {Array.from({ length: 8 }, (_, i) => i + 11).map((time) => (
                    <option key={time} value={time}>
                      {time}시
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="정원을 입력하세요"
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
          <p className="delete-notice">삭제할 강의명을 클릭해주세요</p>
        )}

        {/* 강의 목록 */}
        <div className="admin-table-container">
          <table className="admin-table subject-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>강의명</th>
                <th>교수</th>
                <th>강의실</th>
                <th>학과ID</th>
                <th>구분</th>
                <th>연도</th>
                <th>학기</th>
                <th>시간</th>
                <th>이수학점</th>
                <th>정원</th>
                <th>신청인원</th>
              </tr>
            </thead>
            <tbody>
              {subjectList.length > 0 ? (
                subjectList.map((subject) => (
                  <tr key={subject.id}>
                    <td>{subject.id}</td>
                    <td>
                      {crud === "delete" ? (
                        <button
                          onClick={() => handleDelete(subject.id, subject.name)}
                          className="delete-link"
                        >
                          {subject.name}
                        </button>
                      ) : (
                        subject.name
                      )}
                    </td>
                    <td>{subject.professor?.id || subject.professorId}</td>
                    <td>{subject.room?.id || subject.roomId}</td>
                    <td>{subject.department?.id || subject.deptId}</td>
                    <td>{subject.type}</td>
                    <td>{subject.subYear}</td>
                    <td>{subject.semester}</td>
                    <td>{formatTime(subject)}</td>
                    <td>{subject.grades}</td>
                    <td>{subject.capacity}</td>
                    <td>{subject.numOfStudent || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12" className="no-data">
                    등록된 강의가 없습니다.
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
