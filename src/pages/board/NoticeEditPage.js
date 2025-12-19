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
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
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
        
        // 기존 첨부파일 조회
        try {
          const filesResponse = await api.get(`/api/notice/${id}/files`);
          setExistingFiles(filesResponse.data || []);
        } catch (filesError) {
          console.warn("첨부파일 조회 실패:", filesError);
          setExistingFiles([]);
        }
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

  // 파일 선택 처리 (여러 파일)
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      
      // 이미지 미리보기 생성
      const previews = selectedFiles.map((file) => {
        const isImage = file.type.startsWith("image/");
        return {
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          isImage,
          preview: isImage ? URL.createObjectURL(file) : null,
        };
      });
      setFilePreviews(previews);
    }
  };

  // 파일 제거
  const handleRemoveFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    
    // URL 해제 (메모리 누수 방지)
    if (filePreviews[index]?.preview) {
      URL.revokeObjectURL(filePreviews[index].preview);
    }
    
    setFiles(newFiles);
    setFilePreviews(newPreviews);
    
    // input 초기화
    const fileInput = document.getElementById("noticeFilesEdit");
    if (fileInput) {
      fileInput.value = "";
    }
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
      const submitData = new FormData();
      submitData.append("category", formData.category);
      submitData.append("title", formData.title);
      submitData.append("content", formData.content);
      
      // 여러 파일 추가
      if (files.length > 0) {
        files.forEach((file) => {
          submitData.append("files", file);
        });
      }

      await api.put(`/api/notice/${id}`, submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // 미리보기 URL 정리
      filePreviews.forEach((preview) => {
        if (preview.preview) {
          URL.revokeObjectURL(preview.preview);
        }
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
      <div className="notice-page-wrapper">
        <div className="notice-container">
          <div className="notice-main">
            <h1 className="notice-title">공지사항 수정</h1>
            <div className="notice-divider"></div>
            <p className="notice-loading">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="notice-title">공지사항 수정</h1>
          <div className="notice-divider"></div>

          <div className="notice-write-container">
            <form onSubmit={handleSubmit}>
              <table className="notice-detail-table">
                <tbody>
                  <tr>
                    <td className="notice-detail-label">제목</td>
                    <td className="notice-detail-content">
                      <div className="notice-edit-title-container">
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
                          name="title"
                          className="notice-edit-title-input"
                          value={formData.title}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="notice-detail-label">내용</td>
                    <td className="notice-detail-content">
                      <textarea
                        name="content"
                        rows="20"
                        cols="100"
                        className="notice-content-textarea"
                        value={formData.content}
                        onChange={handleChange}
                        required
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 기존 첨부파일 표시 */}
              {existingFiles.length > 0 && (
                <div className="notice-existing-files">
                  <h4 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: "600" }}>
                    기존 첨부파일 ({existingFiles.length}개)
                  </h4>
                  <div className="notice-files-list">
                    {existingFiles.map((file, index) => (
                      <div key={index} className="notice-file-download">
                        <span className="notice-file-icon">📄</span>
                        <a
                          href={`/api/notice/file/${file.uuidFilename}`}
                          download={file.originFilename}
                          className="notice-file-link"
                        >
                          {file.originFilename}
                        </a>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: "8px", fontSize: "13px", color: "#6c757d" }}>
                    새 파일을 선택하면 기존 파일이 모두 교체됩니다.
                  </p>
                </div>
              )}

              {/* 파일 업로드 (여러 파일) */}
              <div className="notice-file-upload">
                <input
                  type="file"
                  className="notice-file-input"
                  id="noticeFilesEdit"
                  multiple
                  onChange={handleFileChange}
                />
                <label className="notice-file-label" htmlFor="noticeFilesEdit">
                  {files.length > 0
                    ? `${files.length}개 파일 선택됨`
                    : "새 파일 선택 (여러 개 가능)"}
                </label>
              </div>

              {/* 파일 미리보기 */}
              {filePreviews.length > 0 && (
                <div className="notice-file-previews">
                  {filePreviews.map((preview, index) => (
                    <div key={index} className="notice-file-preview-item">
                      {preview.isImage ? (
                        <div className="notice-image-preview">
                          <img
                            src={preview.preview}
                            alt={preview.name}
                            className="notice-preview-image"
                          />
                          <button
                            type="button"
                            className="notice-remove-file-btn"
                            onClick={() => handleRemoveFile(index)}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="notice-file-preview">
                          <span className="notice-file-icon">📄</span>
                          <span className="notice-file-name">{preview.name}</span>
                          <span className="notice-file-size">
                            {(preview.size / 1024).toFixed(1)} KB
                          </span>
                          <button
                            type="button"
                            className="notice-remove-file-btn"
                            onClick={() => handleRemoveFile(index)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="notice-btn-group">
                <button
                  type="button"
                  className="notice-btn-secondary"
                  onClick={() => navigate(`/board/notice/${id}`)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="notice-btn"
                  disabled={submitting}
                >
                  {submitting ? "수정 중..." : "수정"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
