import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axiosConfig";
// import "../../styles/sugang.css";
import "../../styles/PreAppList.css";

const PreAppList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = parseInt(searchParams.get("type") || "0"); // 0: 예비, 1: 본

  const [stuSubList, setStuSubList] = useState([]); // 신청 미완료 목록 (본수강 시)
  const [stuSubListC, setStuSubListC] = useState([]); // 신청 완료 목록 (본수강 시)
  const [preStuSubList, setPreStuSubList] = useState([]); // 예비수강 목록
  const [sumGrades, setSumGrades] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAppList();
  }, [type]);

  // 신청 내역 조회
  const fetchAppList = async () => {
    try {
      setLoading(true);
      console.log(`type ${type} 신청 내역 조회 중...`);

      const response = await api.get("/api/sugang/preAppList", {
        params: { type },
      });
      const data = response.data;

      console.log("API 응답:", data);

      if (type === 0) {
        // 예비 수강 신청
        setPreStuSubList(data.stuSubList || []);
        setSumGrades(data.sumGrades || 0);
      } else {
        // 본 수강 신청
        setStuSubList(data.preStuSubList || []); // 신청 미완료
        setStuSubListC(data.stuSubList || []); // 신청 완료
        setSumGrades(data.sumGrades || 0);
      }
    } catch (error) {
      console.error("신청 내역 조회 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "수강 신청 기간이 아닙니다.");
      } else {
        alert("신청 내역을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 예비 수강 신청 취소
  const handlePreCancel = async (subjectId) => {
    if (!window.confirm("예비수강신청을 취소하시겠습니까?")) {
      return;
    }

    try {
      await api.delete(`/api/sugang/pre/${subjectId}`, {
        params: { type: 1 },
      });
      alert("예비수강신청이 취소되었습니다.");
      fetchAppList();
    } catch (error) {
      console.error("예비수강신청 취소 실패:", error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("예비수강신청 취소에 실패했습니다.");
      }
    }
  };

  // 수강 신청
  const handleApply = async (subjectId) => {
    try {
      await api.post(`/api/sugang/insertApp/${subjectId}`, null, {
        params: { type: 1 },
      });
      alert("수강 신청이 완료되었습니다.");
      fetchAppList();
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
        params: { type: 1 },
      });
      alert("수강신청이 취소되었습니다.");
      fetchAppList();
    } catch (error) {
      console.error("수강신청 취소 실패:", error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("수강신청 취소에 실패했습니다.");
      }
    }
  };

  // 시간 포맷팅
  const formatTime = (startTime, endTime) => {
    const start = startTime < 10 ? `0${startTime}` : startTime;
    return `${start}:00-${endTime}:00`;
  };

  // 목록 렌더링 함수
  const renderTable = (list, isCompleted = false) => (
    <table border="1" className="sub--list--table">
      <thead>
        <tr>
          <th>학수번호</th>
          <th style={{ width: "250px" }}>강의명</th>
          <th>담당교수</th>
          <th>학점</th>
          <th>요일시간 (강의실)</th>
          <th>현재인원</th>
          <th>정원</th>
          <th>수강신청</th>
        </tr>
      </thead>
      <tbody>
        {list.map((stuSub) => (
          <tr key={stuSub.subjectId}>
            <td>{stuSub.subjectId}</td>
            <td className="sub--list--name">{stuSub.subjectName}</td>
            <td>{stuSub.professorName}</td>
            <td>{stuSub.grades}</td>
            <td>
              {stuSub.subDay} {formatTime(stuSub.startTime, stuSub.endTime)}
              &nbsp;({stuSub.roomId})
            </td>
            <td>{stuSub.numOfStudent}</td>
            <td>{stuSub.capacity}</td>
            <td className="sub--list--button--row">
              {type === 0 ? (
                <button
                  onClick={() => handlePreCancel(stuSub.subjectId)}
                  style={{ backgroundColor: "#a7a7a7" }}
                >
                  취소
                </button>
              ) : isCompleted ? (
                <button
                  onClick={() => handleCancel(stuSub.subjectId)}
                  style={{ backgroundColor: "#a7a7a7" }}
                >
                  취소
                </button>
              ) : (
                <button
                  onClick={() => handleApply(stuSub.subjectId)}
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
  );

  const hasData =
    preStuSubList.length > 0 || stuSubList.length > 0 || stuSubListC.length > 0;

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
                  <a href="/sugang/schedule">나의 시간표</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/pre"
                    className={type === 0 ? "selected--menu" : ""}
                  >
                    예비 수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/application"
                    className={type === 1 ? "selected--menu" : ""}
                  >
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
        <h1>{type === 0 ? "예비 수강 신청" : "수강 신청"}</h1>
        <div className="split--div"></div>

        <div
          className="d-flex justify-content-between align-items-start"
          style={{ width: "100%" }}
        >
          <div>
            {loading ? (
              <p className="no--list--p">로딩 중...</p>
            ) : hasData ? (
              <>
                {/* 예비 수강 신청 내역 또는 신청 미완료 목록 */}
                {(type === 0 ? preStuSubList : stuSubList).length > 0 && (
                  <>
                    <h4>
                      <span style={{ fontWeight: 600 }}>
                        {type === 0 ? (
                          <>
                            신청 내역&nbsp;
                            <span style={{ color: "gray", fontSize: "18px" }}>
                              [총 {sumGrades}학점]
                            </span>
                          </>
                        ) : (
                          "신청 미완료 강의 목록"
                        )}
                      </span>
                    </h4>
                    {renderTable(
                      type === 0 ? preStuSubList : stuSubList,
                      false
                    )}
                    <br />
                    <br />
                  </>
                )}

                {/* 수강 신청 완료 목록 (본수강 시) */}
                {type === 1 && stuSubListC.length > 0 && (
                  <>
                    <h4>
                      <span style={{ fontWeight: 600 }}>신청 내역</span>&nbsp;
                      <span style={{ color: "gray", fontSize: "18px" }}>
                        [총 {sumGrades}학점]
                      </span>
                    </h4>
                    {renderTable(stuSubListC, true)}
                  </>
                )}
              </>
            ) : (
              <p className="no--list--p">
                {type === 0
                  ? "예비 수강 신청 내역이 없습니다."
                  : "수강 신청 내역이 없습니다."}
              </p>
            )}
          </div>

          {/* 강의 검색으로 가기 */}
          <a href={type === 0 ? "/sugang/pre" : "/sugang/application"}>
            <button className="preStuSubList--button">강의 검색</button>
          </a>
        </div>
      </main>
    </div>
  );
};

export default PreAppList;
