import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/notice.css";
import api from "../../api/axiosConfig";

export default function NoticeEditPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    category: "[일반]",
    title: "",
    content: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 기존 데이터 조회
  useEffect(() => {
    // staff가 아니면 접근 불가
    if (user?.userRole !== "staff") {
      alert("접근 권한이 없습니다.");
      navigate("/board/notice");
      return;
    }
    const fetchNotice = async () => {
      try {
        const response = await api.get(`/api/notice/${id}/edit`);
        const notice = response.data;
        setFormData({
          category: notice.category,
          title: notice.title,
          content: notice.content.replace(/<br>/g, "\n"),
        });
      } catch (error) {
        console.error("공지사항 조회 실패:", error);
        alert("공지사항을 불러오는데 실패했습니다.");
        navigate("/board/notice");
      } finally {
        setLoading(false);
      }
    };

    fetchNotice();
  }, [id, navigate, user]);

  // 입력 처리
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 수정 처리
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }
    if (!formData.content.trim()) {
      alert("내용을 입력하세요.");
      return;
    }

    setSubmitting(true);

    try {
      await api.put(`/api/notice/${id}`, {
        category: formData.category,
        title: formData.title,
        content: formData.content,
      });

      alert("공지사항이 수정되었습니다.");
      navigate(`/board/notice/${id}`);
    } catch (error) {
      console.error("수정 실패:", error);
      alert(error.response?.data?.message || "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <main>
          <h1>공지사항 수정</h1>
          <div className="split--div"></div>
          <p className="no--list--p">로딩 중...</p>
        </main>
      </div>
    );
  }

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 사이드 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>학사정보</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table" border="1">
            <tbody>
              <tr>
                <td>
                  <a href="/board/notice" className="selected--menu">
                    공지사항
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/schedule">학사일정</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/schedule/list">학사일정 등록</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>공지사항 수정</h1>
        <div className="split--div"></div>

        <div className="container">
          <form onSubmit={handleSubmit}>
            <table className="table">
              <tbody>
                <tr className="title">
                  <td className="type">제목</td>
                  <td>
                    <select
                      name="category"
                      className="input--box"
                      value={formData.category}
                      onChange={handleChange}
                      style={{ marginRight: "10px" }}
                    >
                      <option value="[일반]">[일반]</option>
                      <option value="[학사]">[학사]</option>
                      <option value="[장학]">[장학]</option>
                    </select>
                    <input
                      type="text"
                      name="title"
                      className="update--box"
                      value={formData.title}
                      onChange={handleChange}
                      required
                    />
                  </td>
                </tr>
                <tr className="content--container">
                  <td className="type">내용</td>
                  <td>
                    <textarea
                      name="content"
                      rows="20"
                      cols="100"
                      className="textarea"
                      value={formData.content}
                      onChange={handleChange}
                      required
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="select--button">
              <button
                type="button"
                className="button"
                onClick={() => navigate(`/board/notice/${id}`)}
              >
                취소
              </button>
              <button
                type="submit"
                className="button"
                disabled={submitting}
                style={{ marginLeft: "10px" }}
              >
                {submitting ? "수정 중..." : "수정"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
