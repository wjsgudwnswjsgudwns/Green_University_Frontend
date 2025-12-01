import React, { useState } from 'react';
import '../../styles/studentGrades.css';

/**
 * StudentGradesPage displays the student's grades. Tabs allow switching
 * between current semester and cumulative records. Data is mocked.
 */
export default function StudentGradesPage() {
  const [activeTab, setActiveTab] = useState('current');

  // Mocked data for current semester
  const currentGrades = [
    { id: 301, name: '자료구조', credits: 3, grade: 'A' },
    { id: 302, name: '운영체제', credits: 3, grade: 'B+' },
    { id: 303, name: '웹프로그래밍', credits: 3, grade: 'A-' },
  ];
  // Mocked cumulative GPA data
  const cumulative = [
    { semester: '1-1', gpa: 3.8 },
    { semester: '1-2', gpa: 3.6 },
    { semester: '2-1', gpa: 3.9 },
    { semester: '2-2', gpa: 3.7 },
  ];

  return (
    <div className="student-grades page-container">
      <h2>성적 조회</h2>
      <div className="tabs">
        <button
          className={activeTab === 'current' ? 'active' : ''}
          onClick={() => setActiveTab('current')}
        >
          이번 학기
        </button>
        <button
          className={activeTab === 'cumulative' ? 'active' : ''}
          onClick={() => setActiveTab('cumulative')}
        >
          누적 성적
        </button>
      </div>
      {activeTab === 'current' && (
        <div className="grades-table-wrapper">
          <table className="grades-table">
            <thead>
              <tr>
                <th>과목코드</th>
                <th>과목명</th>
                <th>학점</th>
                <th>성적</th>
              </tr>
            </thead>
            <tbody>
              {currentGrades.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                  <td>{row.credits}</td>
                  <td>{row.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'cumulative' && (
        <div className="grades-table-wrapper">
          <table className="grades-table">
            <thead>
              <tr>
                <th>학기</th>
                <th>평점</th>
              </tr>
            </thead>
            <tbody>
              {cumulative.map((row) => (
                <tr key={row.semester}>
                  <td>{row.semester}</td>
                  <td>{row.gpa.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}