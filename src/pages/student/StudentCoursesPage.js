import React from 'react';
import '../../styles/studentCourses.css';

/**
 * StudentCoursesPage lists the subjects a student is currently taking.
 * It shows course name, professor, credits and schedule. Data is mocked
 * until real API integration is provided.
 */
export default function StudentCoursesPage() {
  // Mocked course list
  const courses = [
    {
      id: 101,
      name: '자료구조',
      professor: '김철수',
      credits: 3,
      schedule: '월 09:00-10:30, 수 09:00-10:30',
    },
    {
      id: 102,
      name: '운영체제',
      professor: '이영희',
      credits: 3,
      schedule: '화 11:00-12:30, 목 11:00-12:30',
    },
    {
      id: 103,
      name: '웹프로그래밍',
      professor: '박민수',
      credits: 3,
      schedule: '금 13:00-15:50',
    },
  ];

  return (
    <div className="student-courses page-container">
      <h2>수강 중인 강의</h2>
      <div className="table-wrapper">
        <table className="courses-table">
          <thead>
            <tr>
              <th>과목코드</th>
              <th>과목명</th>
              <th>담당교수</th>
              <th>학점</th>
              <th>시간표</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>{course.id}</td>
                <td>{course.name}</td>
                <td>{course.professor}</td>
                <td>{course.credits}</td>
                <td>{course.schedule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}