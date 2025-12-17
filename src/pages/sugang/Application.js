import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/Application.css";

const Application = () => {
  const navigate = useNavigate();
  const [subjectList, setSubjectList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [subNameList, setSubNameList] = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState("pre");

  const [searchParams, setSearchParams] = useState({
    type: "전체",
    deptId: "-1",
    name: "",
  });

  useEffect(() => {
    fetchPreSubjectList();
  }, []);

  const fetchPreSubjectList = async () => {
    try {
      setLoading(true);
      const preAppResponse = await api.get("/api/sugang/preAppList", {
        params: { type: 1 },
      });
      const preAppData = preAppResponse.data;

      const allSubjectsResponse = await api.get("/api/sugang/application/1");
      const allSubjects = allSubjectsResponse.data.subjectList || [];

      const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));

      const preList = (preAppData.preStuSubList || []).map((item) => {
        const subjectDetail = subjectMap.get(item.subjectId);
        return {
          subjectId: item.subjectId,
          id: item.subjectId,
          subjectName: item.subjectName,
          name: item.subjectName,
          professorName: item.professorName,
          grades: item.grades,
          subDay: item.subDay,
          startTime: item.startTime,
          endTime: item.endTime,
          numOfStudent: item.numOfStudent,
          capacity: item.capacity,
          roomId: item.roomId,
          status: false,
          collName: subjectDetail?.collName || "",
          deptName: subjectDetail?.deptName || "",
          type: subjectDetail?.type || "",
        };
      });

      setSubjectList(preList);
      setSubjectCount(preList.length);
      setPageCount(0);
      setViewMode("pre");
      setDeptList(allSubjectsResponse.data.deptList || []);
      setSubNameList(allSubjectsResponse.data.subNameList || []);
    } catch (error) {
      console.error("예비 신청 목록 조회 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "수강 신청 기간이 아닙니다.");
      } else {
        alert("목록을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSubjectList = async (page) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sugang/application/${page}`);
      const data = response.data;

      setSubjectList(data.subjectList || []);
      setDeptList(data.deptList || []);
      setSubNameList(data.subNameList || []);
      setSubjectCount(data.subjectCount || 0);
      setPageCount(data.pageCount || 0);
      setCurrentPage(page);
      setViewMode("all");
    } catch (error) {
      console.error("전체 목록 조회 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "수강 신청 기간이 아닙니다.");
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
      const response = await api.get("/api/sugang/application/search", {
        params: searchParams,
      });
      const data = response.data;

      setSubjectList(data.subjectList || []);
      setSubjectCount(data.subjectCount || 0);
      setDeptList(data.deptList || []);
      setSubNameList(data.subNameList || []);
      setPageCount(0);
      setViewMode("all");
    } catch (error) {
      console.error("강의 검색 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "수강 신청 기간이 아닙니다.");
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
    if (viewMode === "all") {
      fetchAllSubjectList(page);
    }
    window.scrollTo(0, 0);
  };

  const toggleViewMode = () => {
    if (viewMode === "pre") {
      fetchAllSubjectList(1);
    } else {
      fetchPreSubjectList();
    }
  };

  const handleApply = async (subjectId) => {
    try {
      await api.post(`/api/sugang/insertApp/${subjectId}`, null, {
        params: { type: 0 },
      });
      alert("수강 신청이 완료되었습니다.");

      if (viewMode === "pre") {
        fetchPreSubjectList();
      } else if (pageCount > 0) {
        fetchAllSubjectList(currentPage);
      } else {
        handleSearch({ preventDefault: () => {} });
      }
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
      await api.delete(`/api/sugang/deleteApp/${subjectId}`, {
        params: { type: 0 },
      });
      alert("수강신청이 취소되었습니다.");

      if (viewMode === "pre") {
        fetchPreSubjectList();
      } else if (pageCount > 0) {
        fetchAllSubjectList(currentPage);
      } else {
        handleSearch({ preventDefault: () => {} });
      }
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
                    className="sugang-application-menu-link"
                  >
                    예비 수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/application"
                    className="sugang-application-menu-link sugang-application-menu-active"
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
      <main className="sugang-application-main">
        <h1 className="sugang-application-title">수강 신청</h1>
        <div className="sugang-application-divider"></div>

        <div className="sugang-application-controls">
          {/* 검색 필터 */}
          <div className="sugang-application-filter">
            <form
              onSubmit={handleSearch}
              className="sugang-application-filter-form"
            >
              <label htmlFor="type" className="sugang-application-filter-label">
                강의구분
              </label>
              <select
                name="type"
                id="type"
                value={searchParams.type}
                onChange={handleFilterChange}
                className="sugang-application-filter-select"
              >
                <option value="전체">전체</option>
                <option value="전공">전공</option>
                <option value="교양">교양</option>
              </select>

              <label
                htmlFor="deptId"
                className="sugang-application-filter-label"
              >
                개설학과
              </label>
              <select
                name="deptId"
                id="deptId"
                value={searchParams.deptId}
                onChange={handleFilterChange}
                className="sugang-application-filter-select"
              >
                <option value="-1">전체</option>
                {deptList.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>

              <label htmlFor="name" className="sugang-application-filter-label">
                강의명
              </label>
              <input
                type="text"
                name="name"
                list="subName"
                value={searchParams.name}
                onChange={handleFilterChange}
                className="sugang-application-filter-input"
              />
              <datalist id="subName">
                {subNameList.map((name, index) => (
                  <option key={index} value={name} />
                ))}
              </datalist>

              <button
                type="submit"
                disabled={loading}
                className="sugang-application-search-btn"
              >
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                  }}
                >
                  <li style={{ height: "24px", marginRight: "2px" }}>조회</li>
                </ul>
              </button>
            </form>
          </div>

          {/* 우측 버튼 그룹 */}
          <div className="sugang-application-btn-group">
            <button
              className={`sugang-application-toggle-btn ${
                viewMode === "all" ? "inactive" : ""
              }`}
              onClick={toggleViewMode}
            >
              {viewMode === "pre" ? "전체 강의 검색" : "예비 신청 목록"}
            </button>
          </div>
        </div>

        {/* 강의 목록 */}
        {loading ? (
          <p className="sugang-application-no-data">로딩 중...</p>
        ) : subjectList.length > 0 ? (
          <>
            <h4 className="sugang-application-list-header">
              <span className="title-text">
                {viewMode === "pre"
                  ? "예비 수강 신청한 강의 (신청 미완료)"
                  : "강의 목록"}
              </span>
              &nbsp;
              <span className="count-text">[이 {subjectCount}건]</span>
            </h4>

            <table border="1" className="sugang-application-table">
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
                  <tr key={subject.subjectId || subject.id}>
                    <td>{subject.collName}</td>
                    <td>{subject.deptName}</td>
                    <td>{subject.subjectId || subject.id}</td>
                    <td>{subject.type}</td>
                    <td className="sugang-application-subject-name">
                      {subject.subjectName || subject.name}
                    </td>
                    <td>{subject.professorName}</td>
                    <td>{subject.grades}</td>
                    <td>
                      {subject.subDay}{" "}
                      {formatTime(subject.startTime, subject.endTime)}
                      &nbsp;({subject.roomId})
                    </td>
                    <td>{subject.numOfStudent}</td>
                    <td>{subject.capacity}</td>
                    <td className="sugang-application-action-cell">
                      {subject.status ? (
                        <button
                          onClick={() =>
                            handleCancel(subject.subjectId || subject.id)
                          }
                          className="sugang-application-action-btn cancel"
                        >
                          취소
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleApply(subject.subjectId || subject.id)
                          }
                          className="sugang-application-action-btn apply"
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
            {viewMode === "all" && pageCount > 0 && (
              <ul className="sugang-application-pagination">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                  (page) => (
                    <li key={page}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(page);
                        }}
                        className={`sugang-application-page-link ${
                          page === currentPage ? "active" : ""
                        }`}
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
          <p className="sugang-application-no-data">
            {viewMode === "pre"
              ? "예비 수강 신청한 과목이 없습니다."
              : "검색 결과가 없습니다."}
          </p>
        )}
      </main>
    </div>
  );
};

export default Application;
