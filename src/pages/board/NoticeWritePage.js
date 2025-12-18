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
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const contentTextareaRef = React.useRef(null);
  const savedSelectionRef = React.useRef(null); // 마지막 커서 위치 저장

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

  // 파일 선택 처리 (여러 파일)
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      // contentEditable div의 현재 커서 위치 저장
      const contentDiv = contentTextareaRef.current;
      if (contentDiv) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
        }
      }

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

      // contentEditable div에 포커스 주기
      setTimeout(() => {
        if (contentDiv) {
          contentDiv.focus();
          // 저장된 커서 위치 복원
          if (savedSelectionRef.current) {
            try {
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(savedSelectionRef.current);
            } catch (e) {
              // 커서 복원 실패 시 무시
            }
          }
        }
      }, 0);
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
    const fileInput = document.getElementById("noticeFiles");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // 이미지를 본문에 삽입
  const handleInsertImageToContent = (previewIndex) => {
    const preview = filePreviews[previewIndex];
    if (!preview || !preview.isImage) return;

    const contentDiv = contentTextareaRef.current;
    if (!contentDiv) return;

    // contentEditable div에 포커스 주기 (먼저 포커스를 주어야 함)
    contentDiv.focus();

    // 약간의 지연을 두어 포커스가 완전히 이동하도록 함
    setTimeout(() => {
      const selection = window.getSelection();
      let range;

      // 저장된 커서 위치가 있고, contentEditable div 내부에 있는지 확인
      if (savedSelectionRef.current) {
        const savedRange = savedSelectionRef.current;
        // 저장된 range가 contentEditable div 내부에 있는지 확인
        if (contentDiv.contains(savedRange.commonAncestorContainer)) {
          range = savedRange.cloneRange();
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // contentEditable div 내부가 아니면 끝에 커서 설정
          range = document.createRange();
          range.selectNodeContents(contentDiv);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else if (selection.rangeCount > 0) {
        // 현재 커서 위치 확인
        const currentRange = selection.getRangeAt(0);
        // contentEditable div 내부에 있는지 확인
        if (contentDiv.contains(currentRange.commonAncestorContainer)) {
          range = currentRange;
        } else {
          // contentEditable div 내부가 아니면 끝에 커서 설정
          range = document.createRange();
          range.selectNodeContents(contentDiv);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // 커서가 없으면 contentEditable div 끝에 커서 설정
        range = document.createRange();
        range.selectNodeContents(contentDiv);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // 이미지 삽입 로직
      insertImageAtRange(range, preview, contentDiv);
    }, 50); // 50ms 지연
  };

  // 이미지를 특정 range에 삽입하는 헬퍼 함수
  const insertImageAtRange = (range, preview, contentDiv) => {
    const selection = window.getSelection();

    // 이미지 태그 생성 (임시 식별자 사용, 업로드 후 서버에서 UUID로 교체)
    // 미리보기용으로 실제 파일 URL 사용
    const tempId = `__IMAGE_${preview.name}__`;
    const imageUrl = preview.preview; // 미리보기용 실제 URL
    const imageTag = document.createElement("img");
    imageTag.src = imageUrl;
    imageTag.alt = preview.name;
    imageTag.setAttribute("data-temp-id", tempId);
    imageTag.style.maxWidth = "100%";
    imageTag.style.height = "auto";
    imageTag.style.borderRadius = "6px";
    imageTag.style.margin = "8px 0";
    imageTag.style.display = "block";

    // 이미지 삽입
    range.insertNode(imageTag);

    // 줄바꿈 추가
    const br = document.createElement("br");
    range.setStartAfter(imageTag);
    range.insertNode(br);

    // 커서를 이미지 뒤로 이동
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // 저장된 커서 위치 업데이트
    savedSelectionRef.current = range.cloneRange();

    // content 업데이트
    updateContentFromDiv();
  };

  // contentEditable div의 내용을 formData에 반영
  const updateContentFromDiv = () => {
    const contentDiv = contentTextareaRef.current;
    if (!contentDiv) return;

    // contentEditable div의 현재 내용을 가져옴 (이미지 URL은 그대로 유지)
    const html = contentDiv.innerHTML;

    setFormData((prev) => ({
      ...prev,
      content: html,
    }));
  };

  // contentEditable div의 내용 변경 처리
  const handleContentChange = () => {
    updateContentFromDiv();
  };

  // 초기 content 설정
  useEffect(() => {
    const contentDiv = contentTextareaRef.current;
    if (!contentDiv) return;

    // contentEditable div가 비어있을 때만 초기 content 설정
    if (!contentDiv.innerHTML && formData.content) {
      contentDiv.innerHTML = formData.content;
    }
  }, []); // 초기 마운트 시에만 실행

  // 등록 처리
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    // contentEditable div에서 최종 내용 가져오기
    const contentDiv = contentTextareaRef.current;
    let finalContent = formData.content;

    if (contentDiv) {
      // 임시 이미지 URL을 임시 식별자로 교체
      const tempImages = contentDiv.querySelectorAll("img[data-temp-id]");
      tempImages.forEach((img) => {
        const tempId = img.getAttribute("data-temp-id");
        // src를 임시 식별자로 교체 (서버에서 실제 S3 URL로 교체됨)
        img.setAttribute("src", tempId);
      });
      // 교체된 최종 HTML 가져오기
      finalContent = contentDiv.innerHTML;

      // 디버깅: 최종 content에 임시 식별자가 포함되어 있는지 확인
      console.log("Final content before submit:", finalContent);
    }

    // HTML 태그 제거한 순수 텍스트로 내용 확인
    const textContent = finalContent.replace(/<[^>]*>/g, "").trim();
    if (!textContent && !finalContent.match(/<img[^>]*>/i)) {
      alert("내용을 입력하세요.");
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append("category", formData.category);
      submitData.append("title", formData.title);
      submitData.append("content", finalContent);

      // 여러 파일 추가
      if (files.length > 0) {
        files.forEach((file) => {
          submitData.append("files", file);
        });
      }

      const response = await api.post("/api/notice", submitData, {
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

      alert("공지사항이 등록되었습니다.");
      // 목록 페이지로 이동 시 URL 파라미터 초기화
      navigate("/board/notice?page=0");
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
              <div
                ref={contentTextareaRef}
                contentEditable
                className="notice-content-textarea notice-content-editable"
                data-placeholder="내용을 입력하세요"
                onInput={handleContentChange}
                onBlur={() => {
                  // 포커스를 잃을 때 현재 커서 위치 저장
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    savedSelectionRef.current = selection
                      .getRangeAt(0)
                      .cloneRange();
                  }
                }}
                onClick={() => {
                  // 클릭 시 커서 위치 저장
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    savedSelectionRef.current = selection
                      .getRangeAt(0)
                      .cloneRange();
                  }
                }}
                onKeyUp={() => {
                  // 키 입력 시 커서 위치 저장
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    savedSelectionRef.current = selection
                      .getRangeAt(0)
                      .cloneRange();
                  }
                }}
              />

              {/* 파일 업로드 (여러 파일) */}
              <div className="notice-file-upload">
                <input
                  type="file"
                  className="notice-file-input"
                  id="noticeFiles"
                  multiple
                  onChange={handleFileChange}
                />
                <label className="notice-file-label" htmlFor="noticeFiles">
                  {files.length > 0
                    ? `${files.length}개 파일 선택됨`
                    : "파일 선택 (여러 개 가능)"}
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
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              marginTop: "4px",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              type="button"
                              className="notice-insert-image-btn"
                              onClick={() => handleInsertImageToContent(index)}
                              title="본문에 이미지 삽입"
                            >
                              본문에 삽입
                            </button>
                            <button
                              type="button"
                              className="notice-remove-file-btn"
                              onClick={() => handleRemoveFile(index)}
                              title="파일 제거"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="notice-file-preview">
                          <span className="notice-file-icon">📄</span>
                          <span className="notice-file-name">
                            {preview.name}
                          </span>
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
