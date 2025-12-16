import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/subject.css";

// 학점 변환 함수
const gradeToGPA = (grade) => {
  const gradeMap = {
    "A+": 4.5,
    A: 4.0,
    "B+": 3.5,
    B: 3.0,
    "C+": 2.5,
    C: 2.0,
    D: 1.0,
    F: 0.0,
  };
  return gradeMap[grade] || 0.0;
};

// GPA를 등급으로 변환 (가장 가까운 등급)
const gpaToGrade = (gpa) => {
  if (gpa >= 4.5) return "A+";
  if (gpa >= 4.0) return "A";
  if (gpa >= 3.5) return "B+";
  if (gpa >= 3.0) return "B";
  if (gpa >= 2.5) return "C+";
  if (gpa >= 2.0) return "C";
  if (gpa >= 1.0) return "D";
  return "F";
};

export default function SubjectStudentListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subjectId } = useParams();
  const formRefs = useRef({});

  const [subject, setSubject] = useState(null);
  const [studentList, setStudentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState({
    attendanceWeight: 10,
    homeworkWeight: 30,
    midtermWeight: 30,
    finalWeight: 30,
    latenessPerAbsent: 3,
    latenessPenaltyPer: 0,
    latenessFreeCount: 0,
    attendanceMax: 100,
    homeworkMax: 100,
    midtermMax: 100,
    finalMax: 100,
  });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [expandedForms, setExpandedForms] = useState({});
  const [studentForms, setStudentForms] = useState({});
  const [submitting, setSubmitting] = useState({});

  // 교수가 아니면 접근 불가
  useEffect(() => {
    if (user?.userRole !== "professor") {
      alert("접근 권한이 없습니다.");
      navigate("/");
    }
  }, [user, navigate]);

  // 학생 목록 조회
  useEffect(() => {
    const fetchStudentList = async () => {
      try {
        const response = await api.get(`/api/professor/subject/${subjectId}`);
        setSubject(response.data.subject);
        const students = response.data.studentList || [];
        setStudentList(students);

        // 각 학생의 폼 데이터 초기화
        const initialForms = {};
        students.forEach((student) => {
          // 기존 등급이 있으면 사용, 없으면 추천 등급 사용
          const defaultGrade =
            student.currentGrade ||
            (student.recommendedGrade
              ? student.recommendedGrade === "A"
                ? "A+"
                : student.recommendedGrade === "B"
                ? "B+"
                : student.recommendedGrade === "C"
                ? "C+"
                : student.recommendedGrade
              : "C+");

          initialForms[student.studentId] = {
            studentId: student.studentId,
            subjectId: parseInt(subjectId),
            absent: student.absent || 0,
            lateness: student.lateness || 0,
            homework: student.homework || 0,
            midExam: student.midExam || 0,
            finalExam: student.finalExam || 0,
            convertedMark: student.computedMark ?? student.convertedMark ?? 0,
            grade: defaultGrade,
          };
        });
        setStudentForms(initialForms);

        if (response.data.policy) {
          setPolicy((prev) => ({
            ...prev,
            ...response.data.policy,
          }));
        }
      } catch (error) {
        console.error("학생 목록 조회 실패:", error);
        alert("학생 목록을 불러오는데 실패했습니다.");
        navigate("/professor/subject");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentList();
  }, [subjectId, navigate]);

  const handlePolicyChange = (e) => {
    const { name, value } = e.target;
    setPolicy((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  };

  const savePolicy = async (e) => {
    e.preventDefault();
    const sum =
      policy.attendanceWeight +
      policy.homeworkWeight +
      policy.midtermWeight +
      policy.finalWeight;
    if (sum !== 100) {
      alert("가중치 합계가 100이어야 합니다.");
      return;
    }
    if (policy.latenessPerAbsent <= 0) {
      alert("지각 환산 기준은 1 이상이어야 합니다.");
      return;
    }
    try {
      setSavingPolicy(true);
      await api.put(
        `/api/professor/subject/${subjectId}/grading-policy`,
        policy
      );
      // 저장 후 재조회
      const response = await api.get(`/api/professor/subject/${subjectId}`);
      setSubject(response.data.subject);
      const students = response.data.studentList || [];
      setStudentList(students);

      // 폼 데이터 업데이트
      const updatedForms = { ...studentForms };
      students.forEach((student) => {
        if (updatedForms[student.studentId]) {
          updatedForms[student.studentId].convertedMark =
            student.computedMark ?? student.convertedMark ?? 0;
        }
      });
      setStudentForms(updatedForms);
    } catch (err) {
      console.error("정책 저장 실패:", err);
      alert("정책 저장에 실패했습니다.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const toggleForm = (studentId) => {
    setExpandedForms((prev) => {
      // 이미 열려있는 학생이면 닫기
      if (prev[studentId]) {
        return {};
      }
      // 새로운 학생을 열 때는 이전 학생을 모두 닫고 현재 학생만 열기
      return { [studentId]: true };
    });
  };

  const scrollToForm = (studentId) => {
    toggleForm(studentId);
    setTimeout(() => {
      const formElement = formRefs.current[studentId];
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleFormChange = (studentId, field, value) => {
    setStudentForms((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: field === "grade" ? value : Number(value),
      },
    }));
  };

  const handleSubmit = async (studentId, e) => {
    e.preventDefault();
    const formData = studentForms[studentId];

    if (!formData) return;

    // 결석 4회 이상 체크
    if (formData.absent >= 4) {
      if (
        !window.confirm(
          "결석이 4회 이상입니다. F학점으로 처리됩니다. 계속하시겠습니까?"
        )
      ) {
        return;
      }
      formData.grade = "F";
    }

    setSubmitting((prev) => ({ ...prev, [studentId]: true }));

    try {
      await api.put(
        `/api/professor/subject/${subjectId}/${studentId}`,
        formData
      );
      alert("성적이 등록되었습니다.");

      // 재조회
      const response = await api.get(`/api/professor/subject/${subjectId}`);
      const students = response.data.studentList || [];
      setStudentList(students);

      // 폼 데이터 업데이트
      const updatedForms = {};
      students.forEach((student) => {
        const existingForm = studentForms[student.studentId];
        const defaultGrade =
          student.currentGrade ||
          (student.recommendedGrade
            ? student.recommendedGrade === "A"
              ? "A+"
              : student.recommendedGrade === "B"
              ? "B+"
              : student.recommendedGrade === "C"
              ? "C+"
              : student.recommendedGrade
            : "C+");

        updatedForms[student.studentId] = {
          studentId: student.studentId,
          subjectId: parseInt(subjectId),
          absent: student.absent || 0,
          lateness: student.lateness || 0,
          homework: student.homework || 0,
          midExam: student.midExam || 0,
          finalExam: student.finalExam || 0,
          convertedMark: student.computedMark ?? student.convertedMark ?? 0,
          grade: existingForm?.grade || defaultGrade,
        };
      });
      setStudentForms(updatedForms);

      // 폼 접기
      setExpandedForms((prev) => ({
        ...prev,
        [studentId]: false,
      }));
    } catch (error) {
      console.error("성적 등록 실패:", error);
      alert(error.response?.data?.message || "성적 등록에 실패했습니다.");
    } finally {
      setSubmitting((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minWidth: "100em" }}
      >
        <main>
          <h1>학생 리스트</h1>
          <div className="split--div"></div>
          <p className="no--list--p">로딩 중...</p>
        </main>
      </div>
    );
  }

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minWidth: "100em" }}
    >
      {/* 사이드 메뉴 */}
      <div className="sub--menu">
        <div className="sub--menu--top">
          <h2>수업</h2>
        </div>
        <div className="sub--menu--mid">
          <table className="sub--menu--table">
            <tbody>
              <tr>
                <td>
                  <a href="/subject/list/1">전체 강의 조회</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/professor/subject" className="selected--menu">
                    내 강의 조회
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="/professor/evaluation">내 강의 평가</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main>
        <h1>[{subject?.name}] 학생 리스트 조회</h1>
        <div className="split--div"></div>

        {/* 가중치/출결 정책 설정 */}
        <form className="grading-policy-form" onSubmit={savePolicy}>
          <h4>성적 가중치 / 출결 정책</h4>
          <div className="policy-inputs">
            <label>
              출결(%):
              <input
                type="number"
                name="attendanceWeight"
                value={policy.attendanceWeight}
                onChange={handlePolicyChange}
                min="0"
                max="100"
              />
            </label>
            <label>
              출결 만점:
              <input
                type="number"
                name="attendanceMax"
                value={policy.attendanceMax}
                onChange={handlePolicyChange}
                min="1"
                step="0.1"
              />
            </label>
            <label>
              과제(%):
              <input
                type="number"
                name="homeworkWeight"
                value={policy.homeworkWeight}
                onChange={handlePolicyChange}
                min="0"
                max="100"
              />
            </label>
            <label>
              과제 만점:
              <input
                type="number"
                name="homeworkMax"
                value={policy.homeworkMax}
                onChange={handlePolicyChange}
                min="1"
                step="0.1"
              />
            </label>
            <label>
              중간(%):
              <input
                type="number"
                name="midtermWeight"
                value={policy.midtermWeight}
                onChange={handlePolicyChange}
                min="0"
                max="100"
              />
            </label>
            <label>
              중간 만점:
              <input
                type="number"
                name="midtermMax"
                value={policy.midtermMax}
                onChange={handlePolicyChange}
                min="1"
                step="0.1"
              />
            </label>
            <label>
              기말(%):
              <input
                type="number"
                name="finalWeight"
                value={policy.finalWeight}
                onChange={handlePolicyChange}
                min="0"
                max="100"
              />
            </label>
            <label>
              기말 만점:
              <input
                type="number"
                name="finalMax"
                value={policy.finalMax}
                onChange={handlePolicyChange}
                min="1"
                step="0.1"
              />
            </label>
            <label>
              지각 n회 = 1결석:
              <input
                type="number"
                name="latenessPerAbsent"
                value={policy.latenessPerAbsent}
                onChange={handlePolicyChange}
              />
            </label>
            <label>
              지각 감점(회당):
              <input
                type="number"
                name="latenessPenaltyPer"
                value={policy.latenessPenaltyPer}
                onChange={handlePolicyChange}
              />
            </label>
            <label>
              지각 무감점 횟수:
              <input
                type="number"
                name="latenessFreeCount"
                value={policy.latenessFreeCount}
                onChange={handlePolicyChange}
              />
            </label>
            <button
              type="submit"
              disabled={savingPolicy}
              className="policy-save-btn"
            >
              {savingPolicy ? "저장 중..." : "정책 저장"}
            </button>
          </div>
          <p className="policy-note">
            * 기본값: 10/30/30/30, 지각 {policy.latenessPerAbsent}회=1결석, 지각{" "}
            {policy.latenessFreeCount}회까지 무감점, 이후 회당{" "}
            {policy.latenessPenaltyPer}점 감점, 결석 4회 이상 F
          </p>
        </form>

        {/* 그룹 색상 범례 */}
        <div className="grade-legend">
          <span>
            <span className="grade-badge grade-a" /> A 구간
          </span>
          <span>
            <span className="grade-badge grade-b" /> B 구간
          </span>
          <span>
            <span className="grade-badge grade-c" /> C 구간
          </span>
          <span>
            <span className="grade-badge grade-f" /> F (결석 기준)
          </span>
        </div>

        {studentList.length > 0 ? (
          <div className="student-list-container">
            <table border="1" className="sub--list--table">
              <thead>
                <tr>
                  <th>학생 번호</th>
                  <th>이름</th>
                  <th>소속</th>
                  <th>결석</th>
                  <th>지각</th>
                  <th>과제점수</th>
                  <th>중간시험</th>
                  <th>기말시험</th>
                  <th>환산점수</th>
                  <th>추천 등급</th>
                  <th>학점</th>
                  <th>점수 기입</th>
                </tr>
              </thead>
              <tbody>
                {studentList.map((student) => {
                  const formData = studentForms[student.studentId] || {};
                  const currentGrade =
                    formData.grade || student.recommendedGrade || "C+";
                  const gpa = gradeToGPA(currentGrade);

                  return (
                    <React.Fragment key={student.studentId}>
                      <tr
                        className={
                          student.group === "A"
                            ? "grade-row grade-a"
                            : student.group === "B"
                            ? "grade-row grade-b"
                            : student.group === "C"
                            ? "grade-row grade-c"
                            : student.group === "F"
                            ? "grade-row grade-f"
                            : ""
                        }
                      >
                        <td>{student.studentId}</td>
                        <td>{student.studentName}</td>
                        <td>{student.deptName}</td>
                        <td>{student.absent || 0}</td>
                        <td>{student.lateness || 0}</td>
                        <td>{student.homework || 0}</td>
                        <td>{student.midExam || 0}</td>
                        <td>{student.finalExam || 0}</td>
                        <td className="computed-mark">
                          {student.computedMark != null
                            ? student.computedMark.toFixed(2)
                            : student.convertedMark ?? 0}
                        </td>
                        <td>{student.recommendedGrade || "-"}</td>
                        <td>
                          {student.currentGrade ? (
                            <span className="current-grade-display">
                              {student.currentGrade} (
                              {gradeToGPA(student.currentGrade).toFixed(1)})
                            </span>
                          ) : (
                            <span className="no-grade">-</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => scrollToForm(student.studentId)}
                            className="grade-edit-btn"
                          >
                            {expandedForms[student.studentId] ? "접기" : "기입"}
                          </button>
                        </td>
                      </tr>
                      {expandedForms[student.studentId] && (
                        <tr>
                          <td colSpan={12} className="student-form-cell">
                            <div
                              ref={(el) =>
                                (formRefs.current[student.studentId] = el)
                              }
                              className="student-grade-form"
                            >
                              <h4>
                                {student.studentName} ({student.studentId}) 성적
                                입력
                              </h4>
                              <form
                                onSubmit={(e) =>
                                  handleSubmit(student.studentId, e)
                                }
                              >
                                <div className="form-grid">
                                  <div className="form-group">
                                    <label>결석</label>
                                    <input
                                      type="number"
                                      name="absent"
                                      value={formData.absent || 0}
                                      onChange={(e) =>
                                        handleFormChange(
                                          student.studentId,
                                          "absent",
                                          e.target.value
                                        )
                                      }
                                      min="0"
                                    />
                                    <span className="form-note">
                                      ※ 결석 4회 이상시 F학점입니다.
                                    </span>
                                  </div>
                                  <div className="form-group">
                                    <label>지각</label>
                                    <input
                                      type="number"
                                      name="lateness"
                                      value={formData.lateness || 0}
                                      onChange={(e) =>
                                        handleFormChange(
                                          student.studentId,
                                          "lateness",
                                          e.target.value
                                        )
                                      }
                                      min="0"
                                    />
                                    <span
                                      className="form-note"
                                      style={{ color: "transparent" }}
                                    >
                                      ※
                                    </span>
                                  </div>
                                  <div className="form-group">
                                    <label>과제점수</label>
                                    <input
                                      type="number"
                                      name="homework"
                                      value={formData.homework || 0}
                                      onChange={(e) =>
                                        handleFormChange(
                                          student.studentId,
                                          "homework",
                                          e.target.value
                                        )
                                      }
                                      min="0"
                                      step="0.1"
                                    />
                                    <span
                                      className="form-note"
                                      style={{ color: "transparent" }}
                                    >
                                      ※
                                    </span>
                                  </div>
                                  <div className="form-group">
                                    <label>중간시험</label>
                                    <input
                                      type="number"
                                      name="midExam"
                                      value={formData.midExam || 0}
                                      onChange={(e) =>
                                        handleFormChange(
                                          student.studentId,
                                          "midExam",
                                          e.target.value
                                        )
                                      }
                                      min="0"
                                      step="0.1"
                                    />
                                    <span
                                      className="form-note"
                                      style={{ color: "transparent" }}
                                    >
                                      ※
                                    </span>
                                  </div>
                                  <div className="form-group">
                                    <label>기말시험</label>
                                    <input
                                      type="number"
                                      name="finalExam"
                                      value={formData.finalExam || 0}
                                      onChange={(e) =>
                                        handleFormChange(
                                          student.studentId,
                                          "finalExam",
                                          e.target.value
                                        )
                                      }
                                      min="0"
                                      step="0.1"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>등급</label>
                                    <select
                                      name="grade"
                                      value={formData.grade || "C+"}
                                      onChange={(e) =>
                                        handleFormChange(
                                          student.studentId,
                                          "grade",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="A+">A+ (4.5)</option>
                                      <option value="A">A (4.0)</option>
                                      <option value="B+">B+ (3.5)</option>
                                      <option value="B">B (3.0)</option>
                                      <option value="C+">C+ (2.5)</option>
                                      <option value="C">C (2.0)</option>
                                      <option value="D">D (1.0)</option>
                                      <option value="F">F (0.0)</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="form-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleForm(student.studentId)
                                    }
                                    className="btn-cancel"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={submitting[student.studentId]}
                                    className="btn-submit"
                                  >
                                    {submitting[student.studentId]
                                      ? "제출 중..."
                                      : "제출하기"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no--list--p">
            해당 강의를 수강하는 학생이 존재하지 않습니다.
          </p>
        )}

        <div style={{ marginTop: "20px" }}>
          <button
            className="button"
            onClick={() => navigate("/professor/subject")}
          >
            목록
          </button>
        </div>
      </main>
    </div>
  );
}
