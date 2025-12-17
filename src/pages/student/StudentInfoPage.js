import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/myPage.css";

export default function StudentInfoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studentInfo, setStudentInfo] = useState(null);
  const [stustatList, setStustatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.userRole !== "student") {
      navigate("/");
      return;
    }
    fetchStudentInfo();
  }, [user, navigate]);

  const fetchStudentInfo = async () => {
    try {
      const response = await api.get("/api/user/info/student");
      setStudentInfo(response.data.student);
      setStustatList(response.data.stustatList || []);
    } catch (err) {
      console.error("학생 정보 조회 실패:", err);
      setError("정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mypage-container">
        <div className="mypage-loading-container">
          <div className="mypage-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mypage-container">
        <div className="mypage-error-container">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage-container">
      <aside className="mypage-side-menu">
        <div className="mypage-side-menu-header">
          <h2>MY</h2>
        </div>
        <nav className="mypage-side-menu-nav">
          <Link to="/student/info" className="mypage-menu-item active">
            내 정보 조회
          </Link>
          <Link to="/student/password" className="mypage-menu-item">
            비밀번호 변경
          </Link>
          <Link to="/student/break/application" className="mypage-menu-item">
            휴학 신청
          </Link>
          <Link to="/student/break/list" className="mypage-menu-item">
            휴학 내역 조회
          </Link>
          <Link to="/student/tuition/list" className="mypage-menu-item">
            등록금 내역 조회
          </Link>
          <Link to="/student/tuition/payment" className="mypage-menu-item">
            등록금 납부 고지서
          </Link>
        </nav>
      </aside>

      <main className="mypage-main-content">
        <h1>내 정보 조회</h1>
        <div className="mypage-divider"></div>

        {studentInfo && (
          <>
            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>학번</th>
                  <td>{studentInfo.id}</td>
                  <th>소속</th>
                  <td>
                    {studentInfo.collegeName} {studentInfo.deptName}
                  </td>
                </tr>
                <tr>
                  <th>학년</th>
                  <td>{studentInfo.grade}</td>
                  <th>학기</th>
                  <td>{studentInfo.semester}</td>
                </tr>
                <tr>
                  <th>입학일</th>
                  <td>{studentInfo.entranceDate}</td>
                  <th>졸업일(졸업예정일)</th>
                  <td>{studentInfo.graduationDate || "-"}</td>
                </tr>
              </tbody>
            </table>

            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>성명</th>
                  <td>{studentInfo.name}</td>
                  <th>생년월일</th>
                  <td>{studentInfo.birthDate}</td>
                </tr>
                <tr>
                  <th>성별</th>
                  <td>{studentInfo.gender}</td>
                  <th>주소</th>
                  <td>{studentInfo.address}</td>
                </tr>
                <tr>
                  <th>연락처</th>
                  <td>{studentInfo.tel}</td>
                  <th>이메일</th>
                  <td>{studentInfo.email}</td>
                </tr>
                <tr>
                  <th>지도교수</th>
                  <td>{studentInfo.tel}</td>
                  <th>이메일</th>
                  <td>{studentInfo.email}</td>
                </tr>
              </tbody>
            </table>

            <table className="mypage-info-table">
              <tbody>
                <tr>
                  <th>지도교수</th>
                  <td>{studentInfo.professorName}</td>
                  <th>소속</th>
                  <td>
                    {studentInfo.professorCollegeName}{" "}
                    {studentInfo.professorDepartName}
                  </td>
                </tr>
                <tr>
                  <th>전화번호</th>
                  <td>{studentInfo.professorTel}</td>
                  <th>이메일</th>
                  <td>{studentInfo.professorEmail}</td>
                </tr>
              </tbody>
            </table>

            <button
              className="mypage-update-button"
              onClick={() => navigate("/student/update")}
            >
              수정하기
            </button>

            <div className="mypage-section-divider"></div>

            <h4 className="mypage-section-title">학적 변동 내역</h4>
            <table className="mypage-stat-table">
              <thead>
                <tr>
                  <th>변동 일자</th>
                  <th>변동 구분</th>
                  <th>세부</th>
                  <th>승인 여부</th>
                  <th>복학 예정 연도/학기</th>
                </tr>
              </thead>
              <tbody>
                {stustatList.length > 0 ? (
                  stustatList.map((stat, index) => (
                    <tr key={index}>
                      <td>{stat.fromDate}</td>
                      <td>{stat.status}</td>
                      <td>{stat.detail}</td>
                      <td>승인</td>
                      <td>
                        {stat.toYear && stat.toSemester
                          ? `${stat.toYear}-${stat.toSemester}학기`
                          : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-data">
                      학적 변동 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}
