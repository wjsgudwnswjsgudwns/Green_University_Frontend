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

        {/* 검색 폼 */}
        <form onSubmit={handleSearch} className="form--container">
          <select
            className="input--box"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="title">제목</option>
            <option value="keyword">제목+내용</option>
          </select>
          <input
            type="text"
            className="input--box"
            placeholder="검색어를 입력하세요"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <button type="submit" className="button">
            검색
          </button>
        </form>

        {/* 공지사항 테이블 */}
        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : noticeList.length > 0 ? (
          <table className="table">
            <thead>
              <tr className="first--tr">
                <td>번호</td>
                <td>말머리</td>
                <td>제목</td>
                <td>작성일</td>
                <td>조회수</td>
              </tr>
            </thead>
            <tbody>
              {noticeList.map((notice) => (
                <tr
                  key={notice.id}
                  className="second--tr"
                  onClick={() => navigate(`/board/notice/${notice.id}`)}
                  style={{ cursor: "pointer" }}
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
        ) : (
          <p className="no--list--p">
            {activeKeyword
              ? "해당 키워드로 작성된 공지글이 없습니다."
              : "공지사항이 없습니다."}
          </p>
        )}

        {/* 페이징 */}
        <div className="paging--container">
          {Array.from({ length: totalPages }, (_, i) => (
            <React.Fragment key={i}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handlePageChange(i);
                }}
                style={{
                  fontWeight: currentPage === i ? "bold" : "normal",
                  color: currentPage === i ? "#007bff" : "#000",
                }}
              >
                {i + 1}
              </a>
              &nbsp;&nbsp;
            </React.Fragment>
          ))}
          {user?.userRole === "staff" && (
            <button
              className="button"
              onClick={() => navigate("/board/notice/write")}
              style={{ marginLeft: "20px" }}
            >
              등록
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
