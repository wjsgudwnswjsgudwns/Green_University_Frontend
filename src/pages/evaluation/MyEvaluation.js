import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/MyEvaluation.css";

const MyEvaluation = () => {
  const navigate = useNavigate();
  const [subjectName, setSubjectName] = useState([]);
  const [evalList, setEvalList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMyEvaluation();
  }, []);

  const fetchMyEvaluation = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/evaluation/read");
      const data = response.data;

      setSubjectName(data.subjectName || []);
      setEvalList(data.eval || []);

      // 초기값 설정
      if (data.subjectName && data.subjectName.length > 0) {
        setSelectedSubject(data.subjectName[0]);
      }
    } catch (error) {
      console.error("강의평가 조회 실패:", error);
      alert("강의평가를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!selectedSubject) {
      alert("과목을 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/evaluation/read", null, {
        params: {
          subjectId: selectedSubject,
        },
      });
      const data = response.data;

      setEvalList(data.eval || []);
    } catch (error) {
      console.error("강의평가 조회 실패:", error);
      alert("강의평가를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const calculateAnswerSum = (evaluation) => {
    return (
      (evaluation.answer1 || 0) +
      (evaluation.answer2 || 0) +
      (evaluation.answer3 || 0) +
      (evaluation.answer4 || 0) +
      (evaluation.answer5 || 0) +
      (evaluation.answer6 || 0) +
      (evaluation.answer7 || 0)
    );
  };

  return (
    <div className="my-eval-container">
      {/* 사이드 메뉴 */}
      <div className="me-sub-menu">
        <div className="me-sub-menu-top">
          <h2>수업</h2>
        </div>
        <div className="me-sub-menu-mid">
          <table className="me-sub-menu-table">
            <tbody>
              <tr>
                <td>
                  <a href="/subject/list/1">전체 강의 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/professor/subject">내 강의 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/evaluation/read" className="me-selected-menu">
                    내 강의 평가
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="me-main">
        <h1>내 강의 평가</h1>
        <div className="me-split-div"></div>

        {subjectName.length > 0 ? (
          <>
            <div className="me-filter">
              <form onSubmit={handleSearch}>
                <div className="me-filter-content">
                  <select
                    name="subjectId"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="me-select"
                  >
                    {subjectName.map((name, index) => (
                      <option key={index} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={loading}
                    className="me-search-btn"
                  >
                    <ul className="me-btn-content">
                      <li className="me-btn-text">조회</li>
                    </ul>
                  </button>
                </div>
              </form>
            </div>

            {loading ? (
              <p className="me-no-list-p">로딩 중...</p>
            ) : evalList.length > 0 ? (
              <table className="me-list-table">
                <thead>
                  <tr>
                    <th>과목 이름</th>
                    <th>총 평가 점수</th>
                    <th>건의 사항</th>
                  </tr>
                </thead>
                <tbody>
                  {evalList.map((evals, index) => (
                    <tr key={index}>
                      <td>{evals.name}</td>
                      <td>{calculateAnswerSum(evals)}</td>
                      <td className="me-improvements">{evals.improvements}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="me-no-list-p">조회된 강의 평가가 없습니다.</p>
            )}
          </>
        ) : (
          <p className="me-no-list-p">조회할 강의 평가가 존재하지 않습니다.</p>
        )}
      </main>
    </div>
  );
};

export default MyEvaluation;
