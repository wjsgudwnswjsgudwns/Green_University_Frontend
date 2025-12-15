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
          <table className="sub--menu--table">
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
        <h1>공지사항 등록</h1>
        <div className="split--div"></div>

        <div className="write--div">
          <form onSubmit={handleSubmit}>
            {/* 제목 영역 */}
            <div className="title--container">
              <div className="category">
                <select
                  name="category"
                  className="input--box"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="[일반]">[일반]</option>
                  <option value="[학사]">[학사]</option>
                  <option value="[장학]">[장학]</option>
                </select>
              </div>
              <div className="title">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  name="title"
                  placeholder="제목을 입력하세요"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  style={{ width: "900px" }}
                />
              </div>
            </div>

            {/* 내용 영역 */}
            <div className="content--container">
              <textarea
                name="content"
                className="form-control"
                cols="100"
                rows="20"
                placeholder="내용을 입력하세요"
                value={formData.content}
                onChange={handleChange}
                required
              />
            </div>

            {/* 파일 업로드 */}
            <div className="custom-file">
              <input
                type="file"
                className="custom-file-input"
                id="customFile"
                accept=".jpg, .jpeg, .png"
                onChange={handleFileChange}
              />
              <label className="custom-file-label" htmlFor="customFile">
                {fileName}
              </label>
            </div>

            {/* 버튼 */}
            <div style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="button"
                onClick={() => navigate("/board/notice")}
              >
                목록
              </button>
              <button
                type="submit"
                className="button"
                disabled={loading}
                style={{ marginLeft: "10px" }}
              >
                {loading ? "등록 중..." : "등록"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
