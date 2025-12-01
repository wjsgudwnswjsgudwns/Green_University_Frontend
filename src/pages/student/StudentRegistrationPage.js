import React, { useState } from 'react';
import '../../styles/studentRegistration.css';

/**
 * StudentRegistrationPage allows students to select courses to register for
 * the upcoming semester. Two lists are displayed: available courses and
 * a basket of selected courses. Students can add/remove courses before
 * finalizing their registration. This mimics the functionality of
 * 수강신청 JSP pages (preApplication.jsp, application.jsp, etc.).
 */
export default function StudentRegistrationPage() {
  // Mocked available courses
  const availableCourses = [
    { id: 201, name: '알고리즘', professor: '정현우', credits: 3 },
    { id: 202, name: '데이터베이스', professor: '손지영', credits: 3 },
    { id: 203, name: '네트워크', professor: '강성민', credits: 3 },
    { id: 204, name: '인공지능', professor: '이수진', credits: 3 },
  ];

  const [selected, setSelected] = useState([]);

  // Adds a course to the selected list if not already present
  const addCourse = (course) => {
    if (!selected.find((c) => c.id === course.id)) {
      setSelected([...selected, course]);
    }
  };

  // Removes a course from the selected list
  const removeCourse = (id) => {
    setSelected(selected.filter((c) => c.id !== id));
  };

  // Finalize registration (placeholder)
  const finalizeRegistration = () => {
    alert('수강신청이 완료되었습니다.');
    // Here you would send the selected list to the backend
  };

  return (
    <div className="student-registration page-container">
      <h2>수강신청</h2>
      <div className="registration-container">
        {/* Available courses */}
        <div className="course-list">
          <h3>개설 강좌</h3>
          <table className="registration-table">
            <thead>
              <tr>
                <th>과목코드</th>
                <th>과목명</th>
                <th>교수</th>
                <th>학점</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {availableCourses.map((course) => (
                <tr key={course.id}>
                  <td>{course.id}</td>
                  <td>{course.name}</td>
                  <td>{course.professor}</td>
                  <td>{course.credits}</td>
                  <td>
                    <button onClick={() => addCourse(course)}>담기</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Selected courses */}
        <div className="selected-list">
          <h3>수강신청 내역</h3>
          <table className="registration-table">
            <thead>
              <tr>
                <th>과목코드</th>
                <th>과목명</th>
                <th>교수</th>
                <th>학점</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {selected.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '12px' }}>
                    선택된 과목이 없습니다.
                  </td>
                </tr>
              ) : (
                selected.map((course) => (
                  <tr key={course.id}>
                    <td>{course.id}</td>
                    <td>{course.name}</td>
                    <td>{course.professor}</td>
                    <td>{course.credits}</td>
                    <td>
                      <button onClick={() => removeCourse(course.id)}>취소</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="action-row">
            <button onClick={finalizeRegistration} disabled={selected.length === 0}>
              신청완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}