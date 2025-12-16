import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/notice.css";
import api from "../../api/axiosConfig";

export default function NoticeWritePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    category: "[일반]",
    title: "",
    content: "",
  });
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("Choose file");
  const [loading, setLoading] = useState(false);

  // staff가 아니면 접근 불가
  useEffect(() => {
    if (user?.userRole !== "staff") {
      alert("접근 권한이 없습니다.");
      navigate("/board/notice");
    }
  }, [user, navigate]);

  // 입력 처리
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 파일 선택 처리
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  // 등록 처리
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

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append("category", formData.category);
      submitData.append("title", formData.title);
      submitData.append("content", formData.content);
      if (file) {
        submitData.append("file", file);
      }

      const response = await api.post("/api/notice", submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("공지사항이 등록되었습니다.");
      navigate("/board/notice");
    } catch (error) {
      console.error("등록 실패:", error);
      alert(error.response?.data?.message || "등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notice-page-wrapper">
      <div className="notice-container">
        {/* 사이드 메뉴 */}
        <div className="notice-sidebar">
          <div className="notice-sidebar-header">
            <h2>학사정보</h2>
          </div>
          <div className="notice-sidebar-nav">
            <table className="notice-menu-table">
              <tbody>
                <tr>
                  <td>
                    <a
                      href="/board/notice"
                      className="notice-menu-link notice-menu-active"
                    >
                      공지사항
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/schedule" className="notice-menu-link">
                      학사일정
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="/schedule/list" className="notice-menu-link">
                      학사일정 등록
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="notice-main">
          <h1 className="notice-title">공지사항 등록</h1>
          <div className="notice-divider"></div>

          <div className="notice-write-container">
            <form onSubmit={handleSubmit}>
              {/* 제목 영역 */}
              <div className="notice-write-header">
                <select
                  name="category"
                  className="notice-category-select"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="[일반]">[일반]</option>
                  <option value="[학사]">[학사]</option>
                  <option value="[장학]">[장학]</option>
                </select>
                <input
                  type="text"
                  className="notice-title-input"
                  name="title"
                  placeholder="제목을 입력하세요"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* 내용 영역 */}
              <textarea
                name="content"
                className="notice-content-textarea"
                cols="100"
                rows="20"
                placeholder="내용을 입력하세요"
                value={formData.content}
                onChange={handleChange}
                required
              />

              {/* 파일 업로드 */}
              <div className="notice-file-upload">
                <input
                  type="file"
                  className="notice-file-input"
                  id="noticeFile"
                  accept=".jpg, .jpeg, .png"
                  onChange={handleFileChange}
                />
                <label className="notice-file-label" htmlFor="noticeFile">
                  {fileName}
                </label>
              </div>

              {/* 버튼 */}
              <div className="notice-btn-group">
                <button
                  type="button"
                  className="notice-btn-secondary"
                  onClick={() => navigate("/board/notice")}
                >
                  목록
                </button>
                <button type="submit" className="notice-btn" disabled={loading}>
                  {loading ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
