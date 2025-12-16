import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/notice.css";
import api from "../../api/axiosConfig";

export default function NoticeListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [noticeList, setNoticeList] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchType, setSearchType] = useState("title");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  // 공지사항 목록 조회
  const fetchNoticeList = async (page = 0, keyword = "", type = "title") => {
    setLoading(true);
    try {
      const params = { page };
      if (keyword) {
        params.keyword = keyword;
        params.type = type;
      }

      const response = await api.get("/api/notice", { params });
      setNoticeList(response.data.content);
      setCurrentPage(response.data.currentPage);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("공지사항 조회 실패:", error);
      alert("공지사항을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const page = parseInt(searchParams.get("page")) || 0;
    const keyword = searchParams.get("keyword") || "";
    const type = searchParams.get("type") || "title";

    setActiveKeyword(keyword);
    setSearchType(type);
    fetchNoticeList(page, keyword, type);
  }, [searchParams]);

  // 검색 처리
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchKeyword.trim()) {
      navigate(
        `/board/notice?page=0&keyword=${searchKeyword}&type=${searchType}`
      );
    } else {
      navigate("/board/notice?page=0");
    }
  };

  // 페이지 이동
  const handlePageChange = (page) => {
    if (activeKeyword) {
      navigate(
        `/board/notice?page=${page}&keyword=${activeKeyword}&type=${searchType}`
      );
    } else {
      navigate(`/board/notice?page=${page}`);
    }
  };

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString("ko-KR");
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
                {user?.userRole === "staff" && (
                  <tr>
                    <td>
                      <a href="/schedule/list" className="notice-menu-link">
                        학사일정 등록
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="notice-main">
          <h1 className="notice-title">공지사항</h1>
          <div className="notice-divider"></div>

          {/* 검색 폼 */}
          <form onSubmit={handleSearch} className="notice-search-form">
            <select
              className="notice-select"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <option value="title">제목</option>
              <option value="keyword">제목+내용</option>
            </select>
            <input
              type="text"
              className="notice-input"
              placeholder="검색어를 입력하세요"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            <button type="submit" className="notice-btn">
              검색
            </button>
          </form>

          {/* 공지사항 테이블 */}
          {loading ? (
            <p className="notice-empty">로딩 중...</p>
          ) : noticeList.length > 0 ? (
            <div className="notice-table-container">
              <table className="notice-table">
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>말머리</th>
                    <th>제목</th>
                    <th>작성일</th>
                    <th>조회수</th>
                  </tr>
                </thead>
                <tbody>
                  {noticeList.map((notice) => (
                    <tr
                      key={notice.id}
                      onClick={() => navigate(`/board/notice/${notice.id}`)}
                    >
                      <td>{notice.id}</td>
                      <td>{notice.category}</td>
                      <td>{notice.title}</td>
                      <td>{formatDate(notice.createdTime)}</td>
                      <td>{notice.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice-empty">
              {activeKeyword
                ? "해당 키워드로 작성된 공지글이 없습니다."
                : "공지사항이 없습니다."}
            </p>
          )}

          {/* 페이징 */}
          <div className="notice-pagination">
            {Array.from({ length: totalPages }, (_, i) => (
              <a
                key={i}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handlePageChange(i);
                }}
                className={`notice-page-link ${
                  currentPage === i ? "active" : ""
                }`}
              >
                {i + 1}
              </a>
            ))}
            {user?.userRole === "staff" && (
              <button
                className="notice-btn"
                onClick={() => navigate("/board/notice/write")}
                style={{ marginLeft: "20px" }}
              >
                등록
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
