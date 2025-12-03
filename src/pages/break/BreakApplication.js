import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";
import "../../styles/breakApplication.css";

export default function BreakApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studentInfo, setStudentInfo] = useState(null);
  const [deptName, setDeptName] = useState("");
  const [collName, setCollName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    toYear: new Date().getFullYear(),
    toSemester: 2,
    type: "일반",
  });

  const CURRENT_YEAR = new Date().getFullYear();
  const CURRENT_SEMESTER = Math.ceil((new Date().getMonth() + 1) / 6);

  useEffect(() => {
    if (user?.userRole !== "student") {
      navigate("/");
      return;
    }
    fetchApplicationData();
  }, [user, navigate]);

  const fetchApplicationData = async () => {
    try {
      const response = await api.get("/api/break/application");
      setStudentInfo(response.data.student);
      setDeptName(response.data.deptName);
      setCollName(response.data.collName);
    } catch (err) {
      console.error("휴학 신청 정보 조회 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("정보를 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!window.confirm("휴학을 신청하시겠습니까?")) {
      return;
    }

    try {
      // studentGrade 추가
      const requestData = {
        ...formData,
        studentGrade: studentInfo.grade, // 학생의 현재 학년 추가
      };

      await api.post("/api/break/application", requestData);
      alert("휴학 신청이 완료되었습니다.");
      navigate("/student/break/list");
    } catch (err) {
      console.error("휴학 신청 실패:", err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert("휴학 신청에 실패했습니다.");
      }
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

  if (error) {
    return (
      <div className="page-container">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => navigate("/student/break/list")}>
            휴학 내역으로 이동
          </button>
        </div>
      </div>
    );
  }

  const today = new Date();
  const formattedDate = `${today.getFullYear()}년 ${String(
    today.getMonth() + 1
  ).padStart(2, "0")}월 ${String(today.getDate()).padStart(2, "0")}일`;

  return (
    <div className="my-page-container">
      <aside className="side-menu">
        <div className="side-menu-header">
          <h2>MY</h2>
        </div>
        <nav className="side-menu-nav">
          <Link to="/student/info" className="menu-item">
            내 정보 조회
          </Link>
          <Link to="/student/password" className="menu-item">
            비밀번호 변경
          </Link>
          <Link to="/student/break/application" className="menu-item active">
            휴학 신청
          </Link>
          <Link to="/student/break/list" className="menu-item">
            휴학 내역 조회
          </Link>
          <Link to="/student/tuition/list" className="menu-item">
            등록금 내역 조회
          </Link>
          <Link to="/student/tuition/payment" className="menu-item">
            등록금 납부 고지서
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        <h1>휴학 신청</h1>
        <div className="divider"></div>

        {studentInfo && (
          <div className="document-container">
            <form onSubmit={handleSubmit}>
              <div className="document-layout">
                <h3>휴학 신청서</h3>
                <table className="document-table" border="1">
                  <tbody>
                    <tr>
                      <th>단 과 대</th>
                      <td>{collName}</td>
                      <th>학 과</th>
                      <td>{deptName}</td>
                    </tr>
                    <tr>
                      <th>학 번</th>
                      <td>{studentInfo.id}</td>
                      <th>학 년</th>
                      <td>{studentInfo.grade}학년</td>
                    </tr>
                    <tr>
                      <th>전 화 번 호</th>
                      <td>{studentInfo.tel}</td>
                      <th>성 명</th>
                      <td>{studentInfo.name}</td>
                    </tr>
                    <tr>
                      <th>주 소</th>
                      <td colSpan="3">{studentInfo.address}</td>
                    </tr>
                    <tr>
                      <th>기 간</th>
                      <td colSpan="3">
                        {CURRENT_YEAR}년도 {CURRENT_SEMESTER}학기부터 &nbsp;
                        <select
                          name="toYear"
                          value={formData.toYear}
                          onChange={handleChange}
                          required
                        >
                          <option value={CURRENT_YEAR}>{CURRENT_YEAR}</option>
                          <option value={CURRENT_YEAR + 1}>
                            {CURRENT_YEAR + 1}
                          </option>
                          <option value={CURRENT_YEAR + 2}>
                            {CURRENT_YEAR + 2}
                          </option>
                        </select>
                        년도
                        <select
                          name="toSemester"
                          value={formData.toSemester}
                          onChange={handleChange}
                          required
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                        학기까지
                      </td>
                    </tr>
                    <tr>
                      <th>휴 학 구 분</th>
                      <td colSpan="3">
                        <label style={{ margin: 0 }}>
                          <input
                            type="radio"
                            name="type"
                            value="일반"
                            checked={formData.type === "일반"}
                            onChange={handleChange}
                          />
                          일반휴학
                        </label>
                        &nbsp;
                        <label style={{ margin: 0 }}>
                          <input
                            type="radio"
                            name="type"
                            value="임신·출산·육아"
                            checked={formData.type === "임신·출산·육아"}
                            onChange={handleChange}
                          />
                          임신·출산·육아휴학
                        </label>
                        &nbsp;
                        <label style={{ margin: 0 }}>
                          <input
                            type="radio"
                            name="type"
                            value="질병"
                            checked={formData.type === "질병"}
                            onChange={handleChange}
                          />
                          질병휴학
                        </label>
                        &nbsp;
                        <label style={{ margin: 0 }}>
                          <input
                            type="radio"
                            name="type"
                            value="창업"
                            checked={formData.type === "창업"}
                            onChange={handleChange}
                          />
                          창업휴학
                        </label>
                        &nbsp;
                        <label style={{ margin: 0 }}>
                          <input
                            type="radio"
                            name="type"
                            value="군입대"
                            checked={formData.type === "군입대"}
                            onChange={handleChange}
                          />
                          군입대휴학
                        </label>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="4" style={{ padding: "18px 8px 2px" }}>
                        <p>
                          위와 같이 휴학하고자 하오니 허가하여 주시기 바랍니다.
                        </p>
                        <br />
                        <p>{formattedDate}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button type="submit" className="btn btn-dark submit-button">
                신청하기
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
