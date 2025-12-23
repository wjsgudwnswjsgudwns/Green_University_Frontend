import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/AppList.css";

const AppList = () => {
  const navigate = useNavigate();
  const [stuSubList, setStuSubList] = useState([]);
  const [sumGrades, setSumGrades] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAppList();
  }, []);

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

  const formatTime = (startTime, endTime) => {
    const start = startTime < 10 ? `0${startTime}` : startTime;
    return `${start}:00-${endTime}:00`;
  };

  return (
    <div className="sugang-applist-wrapper">
      {/* 사이드 메뉴 */}
      <div className="sugang-applist-sidebar">
        <div className="sugang-applist-sidebar-header">
          <h2>수강신청</h2>
        </div>
        <div className="sugang-applist-menu-mid">
          <table className="sugang-applist-menu-table">
            <tbody>
              <tr>
                <td>
                  <a
                    href="/sugang/subjectList"
                    className="sugang-applist-menu-link"
                  >
                    강의 시간표 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/schedule"
                    className="sugang-applist-menu-link"
                  >
                    나의 시간표
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/sugang/pre" className="sugang-applist-menu-link">
                    예비 수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/application"
                    className="sugang-applist-menu-link"
                  >
                    수강 신청
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="/sugang/list"
                    className="sugang-applist-menu-link sugang-applist-menu-active"
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
      <main className="sugang-applist-main">
        <h1 className="sugang-applist-title">수강 신청 내역 조회</h1>
        <div className="sugang-applist-divider"></div>

        {loading ? (
          <p className="sugang-applist-no-data">로딩 중...</p>
        ) : stuSubList.length > 0 ? (
          <>
            <h4 className="sugang-applist-list-header">
              <span className="title-text">신청 내역</span>&nbsp;
              <span className="count-text">[총 {sumGrades}학점]</span>
            </h4>

            <table className="sugang-applist-table">
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
                    <td className="sugang-applist-subject-name">
                      {stuSub.subjectName}
                    </td>
                    <td>{stuSub.professorName}</td>
                    <td>{stuSub.grades}</td>
                    <td>
                      {stuSub.subDay}{" "}
                      {formatTime(stuSub.startTime, stuSub.endTime)}
                      &nbsp;({stuSub.roomId})
                    </td>
                    <td>{stuSub.numOfStudent}</td>
                    <td>{stuSub.capacity}</td>
                    <td className="sugang-applist-action-cell">
                      <button
                        onClick={() => handleCancel(stuSub.subjectId)}
                        className="sugang-applist-cancel-btn"
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
          <p className="sugang-applist-no-data">수강 신청 내역이 없습니다.</p>
        )}
      </main>
    </div>
  );
};

export default AppList;
