import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/sugang.css";
import "../../styles/PreApplication.css";

const PreApplication = () => {
  const navigate = useNavigate();
  const [subjectList, setSubjectList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [subNameList, setSubNameList] = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [searchParams, setSearchParams] = useState({
    type: "전체",
    deptId: "-1",
    name: "",
  });

  useEffect(() => {
    fetchSubjectList(1);
  }, []);

  const fetchSubjectList = async (page) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sugang/pre/${page}`);
      const data = response.data;

      setSubjectList(data.subjectList || []);
      setDeptList(data.deptList || []);
      setSubNameList(data.subNameList || []);
      setSubjectCount(data.subjectCount || 0);
      setPageCount(data.pageCount || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error("강의 목록 조회 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "예비 수강 신청 기간이 아닙니다.");
      } else {
        alert("강의 목록을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await api.get("/api/sugang/pre/search", {
        params: searchParams,
      });
      const data = response.data;

      setSubjectList(data.subjectList || []);
      setSubjectCount(data.subjectCount || 0);
      setDeptList(data.deptList || []);
      setSubNameList(data.subNameList || []);
      setPageCount(0);
    } catch (error) {
      console.error("강의 검색 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "예비 수강 신청 기간이 아닙니다.");
      } else {
        alert("강의 검색에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePageChange = (page) => {
    fetchSubjectList(page);
    window.scrollTo(0, 0);
  };

  const handleApply = async (subjectId) => {
    if (!window.confirm("해당 강의를 수강신청하시겠습니까?")) {
      return;
    }

    try {
      await api.post(`/api/sugang/pre/${subjectId}`);
      alert("예비 수강 신청이 완료되었습니다.");
      fetchSubjectList(currentPage);
    } catch (error) {
      console.error("수강 신청 실패:", error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("수강 신청에 실패했습니다.");
      }
    }
  };

  const handleCancel = async (subjectId) => {
    if (!window.confirm("수강신청을 취소하시겠습니까?")) {
      return;
    }

    try {
      await api.delete(`/api/sugang/pre/${subjectId}`, {
        params: { type: 0 },
      });
      alert("예비 수강 신청이 취소되었습니다.");
      fetchSubjectList(currentPage);
    } catch (error) {
      console.error("수강 신청 취소 실패:", error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("수강 신청 취소에 실패했습니다.");
      }
    }
  };

  const formatTime = (startTime, endTime) => {
    const start = startTime < 10 ? `0${startTime}` : startTime;
    return `${start}:00-${endTime}:00`;
  };

  return (
    <div className="sugang-application-wrapper">
      {/* 사이드 메뉴 */}
      <div className="sugang-application-sidebar">
        <div className="sugang-application-sidebar-header">
          <h2>수강신청</h2>
        </div>
        <div className="sugang-application-menu-mid">
          <table className="sugang-application-menu-table">
            <tbody>
              <tr>
                <td>
                  <a
                    href="/sugang/subjectList"
                    className="sugang-application-menu-link"
                  >
                    강의 시간표 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/schedule"
                    className="sugang-application-menu-link"
                  >
                    나의 시간표
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/pre"
                    className="sugang-application-menu-link sugang-application-menu-active"
                  >
                    예비 수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/application"
                    className="sugang-application-menu-link"
                  >
                    수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/list"
                    className="sugang-application-menu-link"
                  >
                    수강 신청 내역 조회
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>예비 수강 신청</h1>
        <div className="split--div"></div>

        <div className="d-flex justify-content-between align-items-start">
          {/* 검색 필터 */}
          <div className="sub--filter">
            <form onSubmit={handleSearch}>
              <div>
                <label htmlFor="type">강의구분</label>
                <select
                  name="type"
                  id="type"
                  value={searchParams.type}
                  onChange={handleFilterChange}
                >
                  <option value="전체">전체</option>
                  <option value="전공">전공</option>
                  <option value="교양">교양</option>
                </select>

                <label htmlFor="deptId">개설학과</label>
                <select
                  name="deptId"
                  id="deptId"
                  value={searchParams.deptId}
                  onChange={handleFilterChange}
                >
                  <option value="-1">전체</option>
                  {deptList.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="name">강의명</label>
                <input
                  type="text"
                  name="name"
                  list="subName"
                  value={searchParams.name}
                  onChange={handleFilterChange}
                />
                <datalist id="subName">
                  {subNameList.map((name, index) => (
                    <option key={index} value={name} />
                  ))}
                </datalist>

                <button type="submit" disabled={loading}>
                  조회
                </button>
              </div>
            </form>
          </div>

          <button
            className="preStuSubList--button"
            onClick={() => navigate("/sugang/preAppList")}
          >
            예비 수강 신청 내역
          </button>
        </div>

        {/* 강의 목록 */}
        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : subjectList.length > 0 ? (
          <>
            <h4>
              <span style={{ fontWeight: 600 }}>강의 목록</span>&nbsp;
              <span style={{ color: "gray", fontSize: "18px" }}>
                [이 {subjectCount}건]
              </span>
            </h4>

            <table border="1" className="sub--list--table">
              <thead>
                <tr>
                  <th>단과대학</th>
                  <th>개설학과</th>
                  <th>학수번호</th>
                  <th>강의구분</th>
                  <th style={{ width: "200px" }}>강의명</th>
                  <th>담당교수</th>
                  <th>학점</th>
                  <th>요일시간 (강의실)</th>
                  <th>현재인원</th>
                  <th>정원</th>
                  <th>수강신청</th>
                </tr>
              </thead>
              <tbody>
                {subjectList.map((subject) => (
                  <tr key={subject.id}>
                    <td>{subject.collName}</td>
                    <td>{subject.deptName}</td>
                    <td>{subject.id}</td>
                    <td>{subject.type}</td>
                    <td className="sub--list--name">{subject.name}</td>
                    <td>{subject.professorName}</td>
                    <td>{subject.grades}</td>
                    <td>
                      {subject.subDay}{" "}
                      {formatTime(subject.startTime, subject.endTime)}&nbsp; (
                      {subject.roomId})
                    </td>
                    <td>{subject.numOfStudent}</td>
                    <td>{subject.capacity}</td>
                    <td className="sub--list--button--row">
                      {subject.status ? (
                        <button
                          onClick={() => handleCancel(subject.id)}
                          style={{ backgroundColor: "#a7a7a7" }}
                        >
                          취소
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApply(subject.id)}
                          style={{ backgroundColor: "#548AC2" }}
                        >
                          신청
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이징 */}
            {pageCount > 0 && (
              <ul className="page--list">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                  (page) => (
                    <li key={page}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(page);
                        }}
                        style={
                          page === currentPage
                            ? { fontWeight: 700, color: "#007bff" }
                            : {}
                        }
                      >
                        {page}
                      </a>
                    </li>
                  )
                )}
              </ul>
            )}
          </>
        ) : (
          <p className="no--list--p">검색 결과가 없습니다.</p>
        )}
      </main>
    </div>
  );
};

export default PreApplication;
