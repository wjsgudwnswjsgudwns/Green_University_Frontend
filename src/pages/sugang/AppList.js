import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
// import "../../styles/sugang.css";
import "../../styles/AppList.css";

const AppList = () => {
  const navigate = useNavigate();
  const [stuSubList, setStuSubList] = useState([]);
  const [sumGrades, setSumGrades] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAppList();
  }, []);

  // 수강 신청 내역 조회
  const fetchAppList = async () => {
    try {
      setLoading(true);
      console.log("수강 신청 내역 조회 중...");

      const response = await api.get("/api/sugang/list");
      const data = response.data;

      console.log("API 응답:", data);

      setStuSubList(data.stuSubList || []);
      setSumGrades(data.sumGrades || 0);
    } catch (error) {
      console.error("수강 신청 내역 조회 실패:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "수강 신청 기간이 아닙니다.");
      } else {
        alert("수강 신청 내역을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
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
                  <a href="/sugang/application">수강 신청</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/sugang/list" className="selected--menu">
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
        <h1>수강 신청 내역 조회</h1>
        <div className="split--div"></div>

        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : stuSubList.length > 0 ? (
          <>
            <h4>
              <span style={{ fontWeight: 600 }}>신청 내역</span>&nbsp;
              <span style={{ color: "gray", fontSize: "18px" }}>
                [총 {sumGrades}학점]
              </span>
            </h4>

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
                {stuSubList.map((stuSub) => (
                  <tr key={stuSub.subjectId}>
                    <td>{stuSub.subjectId}</td>
                    <td className="sub--list--name">{stuSub.subjectName}</td>
                    <td>{stuSub.professorName}</td>
                    <td>{stuSub.grades}</td>
                    <td>
                      {stuSub.subDay}{" "}
                      {formatTime(stuSub.startTime, stuSub.endTime)}
                      &nbsp;({stuSub.roomId})
                    </td>
                    <td>{stuSub.numOfStudent}</td>
                    <td>{stuSub.capacity}</td>
                    <td className="sub--list--button--row">
                      <button
                        onClick={() => handleCancel(stuSub.subjectId)}
                        style={{ backgroundColor: "#a7a7a7" }}
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="no--list--p">수강 신청 내역이 없습니다.</p>
        )}
      </main>
    </div>
  );
};

export default AppList;
