import React from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/studentInfo.css';

/**
 * StudentInfoPage displays detailed information about the logged in student.
 * The fields shown mirror those found in the original JSP: email, phone,
 * department, advisor, semester and status. For now static data is used.
 */
export default function StudentInfoPage() {
  const { user } = useAuth();

  // Mocked student profile data. Replace with data fetched from API.
  const profile = {
    id: user?.id,
    name: user?.name,
    email: user?.email,
    phone: '010-1234-5678',
    department: '컴퓨터공학과',
    advisor: '홍길동 교수',
    grade: '3학년',
    semester: '2학기',
    status: '재학',
  };

  return (
    <div className="student-info page-container">
      <h2>학생 정보</h2>
      <div className="info-card">
        <table>
          <tbody>
            <tr>
              <td>학번</td>
              <td>{profile.id}</td>
            </tr>
            <tr>
              <td>이름</td>
              <td>{profile.name}</td>
            </tr>
            <tr>
              <td>이메일</td>
              <td>{profile.email}</td>
            </tr>
            <tr>
              <td>전화번호</td>
              <td>{profile.phone}</td>
            </tr>
            <tr>
              <td>학과</td>
              <td>{profile.department}</td>
            </tr>
            <tr>
              <td>지도교수</td>
              <td>{profile.advisor}</td>
            </tr>
            <tr>
              <td>학년/학기</td>
              <td>
                {profile.grade} {profile.semester}
              </td>
            </tr>
            <tr>
              <td>학적상태</td>
              <td>{profile.status}</td>
            </tr>
          </tbody>
        </table>
        <div className="info-buttons">
          {/* Buttons that would navigate to update pages */}
          <button onClick={() => alert('비밀번호 변경 페이지로 이동합니다.')}>비밀번호 변경</button>
          <button onClick={() => alert('정보 수정 페이지로 이동합니다.')}>정보 수정</button>
        </div>
      </div>
    </div>
  );
}