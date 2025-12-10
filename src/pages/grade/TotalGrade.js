import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/Grade.css";

const TotalGrade = () => {
  const navigate = useNavigate();
  const [mygradeList, setMygradeList] = useState([]);
  const [yearList, setYearList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTotalGrade();
  }, []);

  const fetchTotalGrade = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/grade/total");
      const data = response.data;

      setMygradeList(data.mygradeList || []);
      setYearList(data.yearList || []);
    } catch (error) {
      console.error("누계 성적 조회 실패:", error);
      alert("누계 성적을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grade-container">
      {/* 사이드 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>성적</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table">
            <tbody>
              <tr>
                <td>
                  <a href="/grade/thisSemester">금학기 성적 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/grade/semester">학기별 성적 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/grade/total" className="selected--menu">
                    누계 성적
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>총 누계 성적</h1>
        <div className="split--div"></div>

        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : mygradeList.length > 0 ? (
          <>
            <h4 style={{ fontWeight: 600 }}>평점 평균</h4>
            <table border="1" className="sub--list--table">
              <thead>
                <tr>
                  <th>연도</th>
                  <th>학기</th>
                  <th>신청학점</th>
                  <th>취득학점</th>
                  <th>평점평균</th>
                </tr>
              </thead>
              <tbody>
                {mygradeList.map((mygrade, index) => (
                  <tr key={index}>
                    <td>{mygrade.subYear}년</td>
                    <td>{mygrade.semester}학기</td>
                    <td>{mygrade.sumGrades}</td>
                    <td>{mygrade.myGrades}</td>
                    <td>{mygrade.average?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="no--list--p">강의 신청 및 수강 이력 확인 바랍니다.</p>
        )}

        <br />
        <br />
      </main>
    </div>
  );
};

export default TotalGrade;
