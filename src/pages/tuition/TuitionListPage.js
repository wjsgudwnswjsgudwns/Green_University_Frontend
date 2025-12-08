import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosConfig";
import "../../styles/TuitionList.css";

export default function TuitionListPage() {
  const navigate = useNavigate();
  const [tuitionList, setTuitionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTuitionList();
  }, []);

  const fetchTuitionList = async () => {
    try {
      const response = await api.get("/api/tuition/list");
      setTuitionList(response.data.tuitionList || []);
    } catch (err) {
      setError("등록금 내역을 불러오는데 실패했습니다.");
      console.error("Error fetching tuition list:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 세부 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>MY</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table">
            <tbody>
              <tr>
                <td>
                  <a href="/student/info">내 정보 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/password">비밀번호 변경</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/break/application">휴학 신청</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/break/list">휴학 내역 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/tuition/list" className="selected--menu">
                    등록금 내역 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/student/tuition/payment">등록금 납부 고지서</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 */}
      <main>
        <h1>등록금 내역 조회</h1>
        <div className="split--div"></div>

        {loading ? (
          <p className="no--list--p">로딩 중...</p>
        ) : error ? (
          <p className="no--list--p">{error}</p>
        ) : tuitionList.length > 0 ? (
          <table border="1" className="list--table">
            <thead>
              <tr>
                <th>등록연도</th>
                <th>등록학기</th>
                <th>장학금 유형</th>
                <th>등록금</th>
                <th>장학금</th>
                <th>납입금</th>
              </tr>
            </thead>
            <tbody>
              {tuitionList.map((tuition, index) => (
                <tr key={index}>
                  <td>{tuition.id.tuiYear}년</td>
                  <td>{tuition.id.semester}학기</td>
                  <td>
                    {tuition.schType ? `${tuition.schType}유형` : "해당 없음"}
                  </td>
                  <td>{tuition.tuiAmount?.toLocaleString()}원</td>
                  <td>
                    {tuition.schAmount
                      ? `${tuition.schAmount.toLocaleString()}원`
                      : "0원"}
                  </td>
                  <td>
                    {(
                      tuition.tuiAmount - (tuition.schAmount || 0)
                    ).toLocaleString()}
                    원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no--list--p">등록금 납부 내역이 없습니다.</p>
        )}
      </main>
    </div>
  );
}
