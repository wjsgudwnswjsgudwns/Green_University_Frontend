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

  // 표시 모드: 'pre' = 예비 신청 목록, 'all' = 전체 목록
  const [viewMode, setViewMode] = useState("pre");

  // 검색 필터
  const [searchParams, setSearchParams] = useState({
    type: "전체",
    deptId: "-1",
    name: "",
  });

  // 컴포넌트 마운트 시 예비 신청 목록 로드
  useEffect(() => {
    fetchPreSubjectList();
  }, []);

  // 예비 수강 신청한 과목 목록 조회 (수정됨)
  const fetchPreSubjectList = async () => {
    try {
      setLoading(true);
      console.log("예비 수강 신청 목록 조회 중...");

      // 예비 신청 목록 조회
      const preAppResponse = await api.get("/api/sugang/preAppList", {
        params: { type: 1 },
      });
      const preAppData = preAppResponse.data;
      console.log("예비 신청 목록 API 응답:", preAppData);

      // 전체 과목 목록 조회 (한 번만)
      const allSubjectsResponse = await api.get("/api/sugang/application/1");
      const allSubjects = allSubjectsResponse.data.subjectList || [];

      // subjectId를 key로 하는 Map 생성 (빠른 검색)
      const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));

      // 신청 미완료 목록 (preStuSubList) 매핑
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
          status: false, // 아직 본 수강 신청 안 함
          // 상세 정보에서 가져온 필드들
          collName: subjectDetail?.collName || "",
          deptName: subjectDetail?.deptName || "",
          type: subjectDetail?.type || "",
        };
      });

      setSubjectList(preList);
      setSubjectCount(preList.length);
      setPageCount(0); // 페이징 없음
      setViewMode("pre");

      // 5. 필터용 데이터 설정
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

  // ✅ 필터용 데이터 가져오기
  const fetchFilterData = async () => {
    try {
      const response = await api.get("/api/sugang/application/1");
      const data = response.data;

      setDeptList(data.deptList || []);
      setSubNameList(data.subNameList || []);
    } catch (error) {
      console.error("필터 데이터 조회 실패:", error);
    }
  };

  // ✅ 전체 강의 목록 조회
  const fetchAllSubjectList = async (page) => {
    try {
      setLoading(true);
      console.log(`전체 목록 페이지 ${page} 요청 중...`);

      const response = await api.get(`/api/sugang/application/${page}`);
      const data = response.data;

      console.log("전체 목록 API 응답:", data);

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

  // 검색 처리
  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      console.log("검색 파라미터:", searchParams);

      const response = await api.get("/api/sugang/application/search", {
        params: searchParams,
      });
      const data = response.data;

      console.log("검색 API 응답:", data);

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

  // 검색 필터 변경
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 페이지 이동
  const handlePageChange = (page) => {
    console.log(`페이지 ${page}로 이동`);
    if (viewMode === "all") {
      fetchAllSubjectList(page);
    }
    window.scrollTo(0, 0);
  };

  // ✅ 모드 전환
  const toggleViewMode = () => {
    if (viewMode === "pre") {
      fetchAllSubjectList(1);
    } else {
      fetchPreSubjectList();
    }
  };

  // 수강 신청
  const handleApply = async (subjectId) => {
    try {
      await api.post(`/api/sugang/insertApp/${subjectId}`, null, {
        params: { type: 0 },
      });
      alert("수강 신청이 완료되었습니다.");

      // 현재 모드에 따라 새로고침
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

  // 수강 신청 취소
  const handleCancel = async (subjectId) => {
    if (!window.confirm("수강신청을 취소하시겠습니까?")) {
      return;
    }

    try {
      await api.delete(`/api/sugang/deleteApp/${subjectId}`, {
        params: { type: 0 },
      });
      alert("수강신청이 취소되었습니다.");

      // 현재 모드에 따라 새로고침
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

  // 시간 포맷팅
  const formatTime = (startTime, endTime) => {
    const start = startTime < 10 ? `0${startTime}` : startTime;
    return `${start}:00-${endTime}:00`;
  };

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 사이드 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>수강신청</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table">
            <tbody>
              <tr>
                <td>
                  <a href="/sugang/subjectList">강의 시간표 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/sugang/pre">예비 수강 신청</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/sugang/application" className="selected--menu">
                    수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/sugang/list">수강 신청 내역 조회</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>수강 신청</h1>
        <div className="split--div"></div>

        <div className="d-flex justify-content-between align-items-start">
          {/* 검색 필터 */}
          <div className="sub--filter">
            <form onSubmit={handleSearch}>
              <div>
                {/* 강의구분 */}
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

                {/* 개설학과 */}
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

                {/* 강의명 */}
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

                {/* 검색 버튼 */}
                <button type="submit" disabled={loading}>
                  <ul
                    className="d-flex justify-content-center"
                    style={{ margin: 0 }}
                  >
                    <li style={{ height: "24px", marginRight: "2px" }}>조회</li>
                  </ul>
                </button>
              </div>
            </form>
          </div>

          {/* ✅ 우측 버튼 그룹 */}
          <div style={{ display: "flex", gap: "10px" }}>
            {/* 모드 전환 버튼 */}
            <button
              className="preStuSubList--button"
              onClick={toggleViewMode}
              style={{
                backgroundColor: viewMode === "pre" ? "#548AC2" : "#6c757d",
              }}
            >
              {viewMode === "pre" ? "전체 강의 검색" : "예비 신청 목록"}
            </button>
          </div>
        </div>

        {/* 강의 목록 */}
        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : subjectList.length > 0 ? (
          <>
            <h4>
              <span style={{ fontWeight: 600 }}>
                {viewMode === "pre"
                  ? "예비 수강 신청한 강의 (신청 미완료)"
                  : "강의 목록"}
              </span>
              &nbsp;
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
                  <tr key={subject.subjectId || subject.id}>
                    <td>{subject.collName}</td>
                    <td>{subject.deptName}</td>
                    <td>{subject.subjectId || subject.id}</td>
                    <td>{subject.type}</td>
                    <td className="sub--list--name">
                      {subject.subjectName || subject.name}
                    </td>
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
                          onClick={() =>
                            handleCancel(subject.subjectId || subject.id)
                          }
                          style={{ backgroundColor: "#a7a7a7" }}
                        >
                          취소
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleApply(subject.subjectId || subject.id)
                          }
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

            {/* 페이징 (전체 목록일 때만) */}
            {viewMode === "all" && pageCount > 0 && (
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
          <p className="no--list--p">
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
