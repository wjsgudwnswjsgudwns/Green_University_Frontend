import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/ThisSemesterGrade.css";

const ThisSemesterGrade = () => {
  const navigate = useNavigate();
  const [gradeList, setGradeList] = useState([]);
  const [mygrade, setMygrade] = useState(null);
  const [yearList, setYearList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchThisSemesterGrade();
  }, []);

  const fetchThisSemesterGrade = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/grade/thisSemester");
      const data = response.data;

      setGradeList(data.gradeList || []);
      setMygrade(data.mygrade || null);
      setYearList(data.yearList || []);
    } catch (error) {
      console.error("금학기 성적 조회 실패:", error);
      alert("금학기 성적을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluation = (subjectId) => {
    window.open(
      `/evaluation?subjectId=${subjectId}`,
      "_blank",
      "width=720,height=1000"
    );
  };

  return (
    <div className="this-semester-grade-container">
      {/* 사이드 메뉴 */}
      <div className="tsg-sub-menu">
        <div className="tsg-sub-menu-top">
          <h2>성적</h2>
        </div>
        <div className="tsg-sub-menu-mid">
          <table className="tsg-sub-menu-table">
            <tbody>
              <tr>
                <td>
                  <a href="/grade/thisSemester" className="tsg-selected-menu">
                    금학기 성적 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/grade/semester">학기별 성적 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/grade/total">누계 성적</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="tsg-main">
        <h1>금학기 성적 조회</h1>
        <div className="tsg-split-div"></div>

        {loading ? (
          <p className="tsg-no-list-p">로딩 중...</p>
        ) : gradeList.length > 0 ? (
          <>
            <div>
              <h4 className="tsg-section-title">과목별 성적</h4>
              <table className="tsg-list-table">
                <thead>
                  <tr>
                    <th>연도</th>
                    <th>학기</th>
                    <th>과목번호</th>
                    <th>과목명</th>
                    <th>강의구분</th>
                    <th>이수학점</th>
                    <th>성적</th>
                    <th>강의평가</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeList.map((grade, index) => (
                    <tr key={index}>
                      <td>{grade.subYear}년</td>
                      <td>{grade.semester}학기</td>
                      <td>{grade.subjectId}</td>
                      <td className="tsg-list-name">{grade.name}</td>
                      <td>{grade.type}</td>
                      <td>{grade.grades}</td>
                      <td>{grade.grade}</td>
                      <td>
                        {grade.evaluationId == null ? (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleEvaluation(grade.subjectId);
                            }}
                            className="tsg-eval-link"
                          >
                            Click
                          </a>
                        ) : (
                          <span className="tsg-eval-completed">완료</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tsg-notice">※ 강의 평가 후 성적 조회 가능</p>
            </div>

            <hr className="tsg-divider" />

            {mygrade && (
              <div>
                <h4 className="tsg-section-title">누계 성적</h4>
                <table className="tsg-list-table">
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
                    <tr>
                      <td>{mygrade.subYear}년</td>
                      <td>{mygrade.semester}학기</td>
                      <td>{mygrade.sumGrades}</td>
                      <td>{mygrade.myGrades}</td>
                      <td>{mygrade.average?.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="tsg-no-list-p">강의 신청 및 수강 이력 확인 바랍니다.</p>
        )}
      </main>
    </div>
  );
};

export default ThisSemesterGrade;
