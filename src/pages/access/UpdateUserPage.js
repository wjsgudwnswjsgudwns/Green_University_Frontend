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

  // 이메일 인증 관련 상태
  const [originalEmail, setOriginalEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [codeSendLoading, setCodeSendLoading] = useState(false);
  const [codeVerifyLoading, setCodeVerifyLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchUserInfo();
  }, [user, navigate]);

  // 타이머 카운트다운
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0 && isCodeSent) {
      setIsCodeSent(false);
    }
  }, [timer, isCodeSent]);

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
        setOriginalEmail(response.data.student.email || "");
      } else if (user.userRole === "professor") {
        response = await api.get("/api/user/info/professor");
        setUserInfo(response.data.professor);
        setFormData({
          address: response.data.professor.address || "",
          tel: response.data.professor.tel || "",
          email: response.data.professor.email || "",
          password: "",
        });
        setOriginalEmail(response.data.professor.email || "");
      } else if (user.userRole === "staff") {
        response = await api.get("/api/user/info/staff");
        setUserInfo(response.data.staff);
        setFormData({
          address: response.data.staff.address || "",
          tel: response.data.staff.tel || "",
          email: response.data.staff.email || "",
          password: "",
        });
        setOriginalEmail(response.data.staff.email || "");
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

    // 이메일이 변경되면 인증 상태 초기화
    if (name === "email" && value !== originalEmail) {
      setIsEmailVerified(false);
      setIsCodeSent(false);
      setVerificationCode("");
    } else if (name === "email" && value === originalEmail) {
      setIsEmailVerified(true);
    }
  };

  // 인증 코드 발송
  const handleSendCode = async () => {
    if (!formData.email) {
      setError("이메일을 입력해주세요.");
      return;
    }

    if (formData.email === originalEmail) {
      setError("현재 이메일과 동일합니다.");
      return;
    }

    setCodeSendLoading(true);
    setError("");

    try {
      await api.post("/api/email/send", { email: formData.email });
      setIsCodeSent(true);
      setTimer(300); // 5분 = 300초
      setSuccess("인증 코드가 이메일로 발송되었습니다.");
    } catch (err) {
      console.error("인증 코드 발송 실패:", err);
      setError(err.response?.data?.message || "인증 코드 발송에 실패했습니다.");
    } finally {
      setCodeSendLoading(false);
    }
  };

  // 인증 코드 확인
  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError("인증 코드를 입력해주세요.");
      return;
    }

    setCodeVerifyLoading(true);
    setError("");

    try {
      await api.post("/api/email/verify", {
        email: formData.email,
        code: verificationCode,
      });
      setIsEmailVerified(true);
      setIsCodeSent(false);
      setSuccess("이메일 인증이 완료되었습니다.");
    } catch (err) {
      console.error("인증 코드 확인 실패:", err);
      setError(err.response?.data?.message || "인증 코드가 올바르지 않습니다.");
    } finally {
      setCodeVerifyLoading(false);
    }
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

    // 이메일이 변경되었는데 인증하지 않은 경우
    if (formData.email !== originalEmail && !isEmailVerified) {
      setError("이메일 인증을 완료해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.put(
        `/api/user/update?password=${encodeURIComponent(
          formData.password
        )}&emailVerified=${isEmailVerified}`,
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

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="mypage-container">
        <div className="mypage-loading-container">
          <div className="mypage-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  const emailChanged = formData.email !== originalEmail;

  return (
    <div className="mypage-container">
      <aside className="mypage-side-menu">
        <div className="mypage-side-menu-header">
          <h2>MY</h2>
        </div>
        <nav className="mypage-side-menu-nav">
          {getMenuItems().map((item) => (
            <Link key={item.path} to={item.path} className="mypage-menu-item">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>개인 정보 수정</h1>
        <div className="mypage-divider"></div>

        {error && <div className="mypage-error-message">{error}</div>}
        {success && <div className="mypage-success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="mypage-update-form">
          <table className="mypage-form-table">
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
                    className="mypage-input-field"
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
                    className="mypage-input-field"
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
                  <div className="mypage-email-verification-container">
                    <div className="mypage-email-input-wrapper">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="mypage-input-field"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    {emailChanged && !isEmailVerified && (
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={codeSendLoading || isCodeSent}
                        className={`mypage-verification-button ${
                          isCodeSent ? "resend" : ""
                        }`}
                      >
                        {codeSendLoading
                          ? "발송 중..."
                          : isCodeSent
                          ? `재발송 (${formatTime(timer)})`
                          : "인증코드 발송"}
                      </button>
                    )}
                    {emailChanged && isEmailVerified && (
                      <span className="mypage-verified-badge">✓ 인증완료</span>
                    )}
                  </div>
                </td>
              </tr>
              {emailChanged && isCodeSent && !isEmailVerified && (
                <tr>
                  <th>
                    <label htmlFor="verificationCode">인증 코드</label>
                  </th>
                  <td>
                    <div className="mypage-email-verification-container">
                      <div className="mypage-verification-code-input">
                        <input
                          type="text"
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="6자리 인증 코드 입력"
                          className="mypage-input-field"
                          maxLength={6}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={codeVerifyLoading}
                        className="mypage-verify-button"
                      >
                        {codeVerifyLoading ? "확인 중..." : "인증 확인"}
                      </button>
                    </div>
                    <small className="mypage-verification-help-text">
                      ※ 이메일로 발송된 6자리 코드를 입력하세요 (유효시간: 5분)
                    </small>
                  </td>
                </tr>
              )}
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
                    className="mypage-input-field"
                    placeholder="현재 비밀번호를 입력하세요"
                    disabled={isSubmitting}
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mypage-button-group">
            <button
              type="submit"
              className="mypage-submit-button"
              disabled={isSubmitting || (emailChanged && !isEmailVerified)}
            >
              {isSubmitting ? "수정 중..." : "수정하기"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
