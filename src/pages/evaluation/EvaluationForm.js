import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/EvaluationForm.css";

const EvaluationForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subjectId = searchParams.get("subjectId");

  const [dto, setDto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    answer1: null,
    answer2: null,
    answer3: null,
    answer4: null,
    answer5: null,
    answer6: null,
    answer7: null,
    improvements: "",
  });

  useEffect(() => {
    if (!subjectId) {
      alert("과목 정보가 없습니다.");
      window.close();
      return;
    }
    fetchEvaluationQuestions();
  }, [subjectId]);

  const fetchEvaluationQuestions = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/evaluation", {
        params: { subjectId },
      });
      setDto(response.data.dto);
    } catch (error) {
      console.error("강의평가 질문 조회 실패:", error);
      alert("강의평가 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleRadioChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: parseInt(value),
    }));
  };

  const handleTextChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      improvements: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 모든 답변이 선택되었는지 확인
    for (let i = 1; i <= 7; i++) {
      if (formData[`answer${i}`] === null) {
        alert(`${i}번 질문에 답해주세요.`);
        return;
      }
    }

    try {
      setLoading(true);
      await api.post(`/api/evaluation/write/${subjectId}`, formData);
      alert("강의 평가가 제출되었습니다.");
      window.close();
    } catch (error) {
      console.error("강의평가 제출 실패:", error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("강의평가 제출에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dto) {
    return (
      <div className="eval-form-container">
        <div className="eval-form-loading">로딩 중...</div>
      </div>
    );
  }

  if (!dto) {
    return null;
  }

  const renderQuestion = (questionNumber, questionText) => (
    <ul className="eval-form-radio-check">
      <li className="eval-form-question">
        {questionNumber}.&nbsp;{questionText}
      </li>
      <li>
        &nbsp;
        <input
          type="radio"
          name={`answer${questionNumber}`}
          value="5"
          id={`a${questionNumber}1`}
          onChange={(e) =>
            handleRadioChange(`answer${questionNumber}`, e.target.value)
          }
          checked={formData[`answer${questionNumber}`] === 5}
        />
        <label htmlFor={`a${questionNumber}1`}> 매우 그렇다</label>
      </li>
      <li>
        &nbsp;
        <input
          type="radio"
          name={`answer${questionNumber}`}
          value="4"
          id={`a${questionNumber}2`}
          onChange={(e) =>
            handleRadioChange(`answer${questionNumber}`, e.target.value)
          }
          checked={formData[`answer${questionNumber}`] === 4}
        />
        <label htmlFor={`a${questionNumber}2`}> 그렇다</label>
      </li>
      <li>
        &nbsp;
        <input
          type="radio"
          name={`answer${questionNumber}`}
          value="3"
          id={`a${questionNumber}3`}
          onChange={(e) =>
            handleRadioChange(`answer${questionNumber}`, e.target.value)
          }
          checked={formData[`answer${questionNumber}`] === 3}
        />
        <label htmlFor={`a${questionNumber}3`}> 보통</label>
      </li>
      <li>
        &nbsp;
        <input
          type="radio"
          name={`answer${questionNumber}`}
          value="2"
          id={`a${questionNumber}4`}
          onChange={(e) =>
            handleRadioChange(`answer${questionNumber}`, e.target.value)
          }
          checked={formData[`answer${questionNumber}`] === 2}
        />
        <label htmlFor={`a${questionNumber}4`}> 그렇지 않다</label>
      </li>
      <li>
        &nbsp;
        <input
          type="radio"
          name={`answer${questionNumber}`}
          value="1"
          id={`a${questionNumber}5`}
          onChange={(e) =>
            handleRadioChange(`answer${questionNumber}`, e.target.value)
          }
          checked={formData[`answer${questionNumber}`] === 1}
        />
        <label htmlFor={`a${questionNumber}5`}> 전혀 그렇지 않다</label>
      </li>
    </ul>
  );

  return (
    <div className="eval-form-container">
      <main className="eval-form-main">
        <div className="eval-form-title-row">
          <h1>강의 평가</h1>
        </div>
        <hr className="eval-form-divider" />

        <form onSubmit={handleSubmit}>
          {renderQuestion(1, dto.question1)}
          {renderQuestion(2, dto.question2)}
          {renderQuestion(3, dto.question3)}
          {renderQuestion(4, dto.question4)}
          {renderQuestion(5, dto.question5)}
          {renderQuestion(6, dto.question6)}
          {renderQuestion(7, dto.question7)}

          <ul className="eval-form-etc-row">
            <li>
              <span className="eval-form-etc-title">{dto.sugContent}</span>
            </li>
            <li>
              <textarea
                className="eval-form-textarea"
                cols="80"
                rows="5"
                name="improvements"
                value={formData.improvements}
                onChange={handleTextChange}
                placeholder="건의사항을 입력해주세요 (선택사항)"
              />
            </li>
          </ul>

          <div className="eval-form-button-row">
            <button
              type="submit"
              className="eval-form-submit-btn"
              disabled={loading}
            >
              {loading ? "제출 중..." : "제출하기"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default EvaluationForm;
