import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function UpdateUserPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [formData, setFormData] = useState({
    address: "",
    tel: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchUserInfo();
  }, [user, navigate]);

  const fetchUserInfo = async () => {
    try {
      let response;
      if (user.userRole === "student") {
        response = await api.get("/api/user/info/student");
        setUserInfo(response.data.student);
        setFormData({
          address: response.data.student.address || "",
          tel: response.data.student.tel || "",
          email: response.data.student.email || "",
          password: "",
        });
      } else if (user.userRole === "professor") {
        response = await api.get("/api/user/info/professor");
        setUserInfo(response.data.professor);
        setFormData({
          address: response.data.professor.address || "",
          tel: response.data.professor.tel || "",
          email: response.data.professor.email || "",
          password: "",
        });
      } else if (user.userRole === "staff") {
        response = await api.get("/api/user/info/staff");
        setUserInfo(response.data.staff);
        setFormData({
          address: response.data.staff.address || "",
          tel: response.data.staff.tel || "",
          email: response.data.staff.email || "",
          password: "",
        });
      }
    } catch (err) {
      console.error("정보 조회 실패:", err);
      setError("정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    if (!formData.address || !formData.tel || !formData.email) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.put(
        `/api/user/update?password=${encodeURIComponent(formData.password)}`,
        {
          address: formData.address,
          tel: formData.tel,
          email: formData.email,
        }
      );

      setSuccess("정보가 성공적으로 수정되었습니다.");
      await refreshUser();

      setTimeout(() => {
        navigate(`/${user.userRole}/info`);
      }, 1500);
    } catch (err) {
      console.error("정보 수정 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 400) {
        setError("비밀번호가 일치하지 않습니다.");
      } else {
        setError("정보 수정에 실패했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMenuItems = () => {
    const commonItems = [
      { path: `/${user.userRole}/info`, label: "내 정보 조회" },
      { path: `/${user.userRole}/password`, label: "비밀번호 변경" },
    ];

    if (user.userRole === "student") {
      return [
        ...commonItems,
        { path: "/student/break/application", label: "휴학 신청" },
        { path: "/student/break/list", label: "휴학 내역 조회" },
        { path: "/student/tuition/list", label: "등록금 내역 조회" },
        { path: "/student/tuition/payment", label: "등록금 납부 고지서" },
      ];
    }
    return commonItems;
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
          <h2>MY</h2>
        </div>
        <nav className="side-menu-nav">
          {getMenuItems().map((item) => (
            <Link key={item.path} to={item.path} className="menu-item">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <h1>개인 정보 수정</h1>
        <div className="divider"></div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="update-form">
          <table className="form-table">
            <tbody>
              <tr>
                <th>
                  <label htmlFor="address">주소</label>
                </th>
                <td>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="input-field"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="tel">전화번호</label>
                </th>
                <td>
                  <input
                    type="text"
                    id="tel"
                    name="tel"
                    value={formData.tel}
                    onChange={handleChange}
                    className="input-field"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="email">이메일</label>
                </th>
                <td>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="password">비밀번호 확인</label>
                </th>
                <td>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="현재 비밀번호를 입력하세요"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "수정 중..." : "수정하기"}
          </button>
        </form>
      </main>
    </div>
  );
}
