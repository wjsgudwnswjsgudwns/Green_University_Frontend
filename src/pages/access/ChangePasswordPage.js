import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    beforePassword: "",
    afterPassword: "",
    passwordCheck: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    if (
      !formData.beforePassword ||
      !formData.afterPassword ||
      !formData.passwordCheck
    ) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    if (formData.afterPassword !== formData.passwordCheck) {
      setError("변경할 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (formData.afterPassword.length < 4) {
      setError("비밀번호는 최소 4자 이상이어야 합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.put("/api/user/password", {
        beforePassword: formData.beforePassword,
        afterPassword: formData.afterPassword,
        passwordCheck: formData.passwordCheck,
      });

      setSuccess("비밀번호가 성공적으로 변경되었습니다.");
      setFormData({
        beforePassword: "",
        afterPassword: "",
        passwordCheck: "",
      });

      setTimeout(() => {
        navigate(`/${user.userRole}/info`);
      }, 1500);
    } catch (err) {
      console.error("비밀번호 변경 실패:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 400) {
        setError("현재 비밀번호가 일치하지 않습니다.");
      } else {
        setError("비밀번호 변경에 실패했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMenuItems = () => {
    const commonItems = [
      { path: `/${user.userRole}/info`, label: "내 정보 조회" },
      {
        path: `/${user.userRole}/password`,
        label: "비밀번호 변경",
        active: true,
      },
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

  return (
    <div className="my-page-container">
      <aside className="side-menu">
        <div className="side-menu-header">
          <h2>MY</h2>
        </div>
        <nav className="side-menu-nav">
          {getMenuItems().map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`menu-item ${item.active ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <h1>비밀번호 변경</h1>
        <div className="divider"></div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="update-form">
          <table className="form-table">
            <tbody>
              <tr>
                <th>
                  <label htmlFor="beforePassword">현재 비밀번호</label>
                </th>
                <td>
                  <input
                    type="password"
                    id="beforePassword"
                    name="beforePassword"
                    value={formData.beforePassword}
                    onChange={handleChange}
                    className="input-field"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="afterPassword">변경할 비밀번호</label>
                </th>
                <td>
                  <input
                    type="password"
                    id="afterPassword"
                    name="afterPassword"
                    value={formData.afterPassword}
                    onChange={handleChange}
                    className="input-field"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>
                  <label htmlFor="passwordCheck">변경할 비밀번호 확인</label>
                </th>
                <td>
                  <input
                    type="password"
                    id="passwordCheck"
                    name="passwordCheck"
                    value={formData.passwordCheck}
                    onChange={handleChange}
                    className="input-field"
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
            {isSubmitting ? "변경 중..." : "수정하기"}
          </button>
        </form>
      </main>
    </div>
  );
}
