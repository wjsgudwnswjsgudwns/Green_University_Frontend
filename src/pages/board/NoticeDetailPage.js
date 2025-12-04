import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/notice.css";
import api from "../../api/axiosConfig";

export default function NoticeDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();

  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFetched = React.useRef(false);

  // 공지사항 상세 조회
  useEffect(() => {
    let cancelled = false;

    const fetchNoticeDetail = async () => {
      // 이미 조회했으면 스킵 (Strict Mode 대응)
      if (isFetched.current) {
        setLoading(false);
        return;
      }

      try {
        // 1. 공지사항 조회 (조회수 증가 없음)
        const response = await api.get(`/api/notice/${id}`);

        // 컴포넌트가 언마운트되지 않았을 때만 상태 업데이트
        if (!cancelled) {
          setNotice(response.data);
          isFetched.current = true;

          // 2. 조회수 증가 (별도 API 호출)
          try {
            await api.post(`/api/notice/${id}/views`);
          } catch (viewError) {
            // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
            console.warn("조회수 증가 실패:", viewError);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("공지사항 조회 실패:", error);
          alert("공지사항을 불러오는데 실패했습니다.");
          navigate("/board/notice");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNoticeDetail();

    // cleanup 함수: 컴포넌트 언마운트 시 실행
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // 삭제 처리
  const handleDelete = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;

    try {
      await api.delete(`/api/notice/${id}`);
      alert("공지사항이 삭제되었습니다.");
      navigate("/board/notice");
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <main>
          <h1>공지사항</h1>
          <div className="split--div"></div>
          <p className="no--list--p">로딩 중...</p>
        </main>
      </div>
    );
  }

  if (!notice) {
    return null;
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
              {user?.userRole === "staff" && (
                <tr>
                  <td>
                    <a href="/schedule/list">학사일정 등록</a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>공지사항</h1>
        <div className="split--div"></div>

        <div className="container">
          <table className="table">
            <tbody>
              <tr className="title">
                <td className="type">제목</td>
                <td>
                  {notice.category} {notice.title}
                </td>
              </tr>
              <tr className="content--container">
                <td className="type">내용</td>
                <td>
                  <div dangerouslySetInnerHTML={{ __html: notice.content }} />
                  {notice.uuidFilename && (
                    <>
                      <br />
                      <br />
                      <img
                        src={`/images/uploads/${notice.uuidFilename}`}
                        alt="첨부 이미지"
                        style={{ maxWidth: "600px", maxHeight: "800px" }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="select--button">
            <button
              className="button"
              onClick={() => navigate("/board/notice")}
            >
              목록
            </button>
            {user?.userRole === "staff" && (
              <>
                <button
                  className="button"
                  onClick={() => navigate(`/board/notice/edit/${id}`)}
                  style={{ marginLeft: "10px" }}
                >
                  수정
                </button>
                <button
                  className="button"
                  onClick={handleDelete}
                  style={{ marginLeft: "10px" }}
                >
                  삭제
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
