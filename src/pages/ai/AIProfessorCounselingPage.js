import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axiosConfig";
import CounselingFormModal from "./CounselingFormModal";
import "../../styles/professorCounseling.css";

export default function AIProfessorCounselingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [subjectStudents, setSubjectStudents] = useState({});
  const [studentAnalysis, setStudentAnalysis] = useState({});
  const [riskAlerts, setRiskAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState({});
  const [error, setError] = useState("");

  // 검색 및 정렬 상태
  const [searchTerms, setSearchTerms] = useState({});
  const [sortConfig, setSortConfig] = useState({});

  // 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (user && user.id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const subjectsResponse = await api.get(`/api/professor/subject`);
      const alertsResponse = await api.get(
        `/api/ai-risk-alert/professor/${user.id}/unchecked`
      );

      if (subjectsResponse.data) {
        setSubjects(subjectsResponse.data.subjectList || []);
      }

      if (alertsResponse.data?.code === 1) {
        setRiskAlerts(alertsResponse.data.data || []);
      }
    } catch (err) {
      console.error("데이터 조회 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = async (subjectId) => {
    const newExpanded = new Set(expandedSubjects);

    if (newExpanded.has(subjectId)) {
      newExpanded.delete(subjectId);
      setExpandedSubjects(newExpanded);
      return;
    }

    newExpanded.add(subjectId);
    setExpandedSubjects(newExpanded);

    if (!subjectStudents[subjectId]) {
      await fetchSubjectStudents(subjectId);
    }
  };

  const fetchSubjectStudents = async (subjectId) => {
    try {
      setLoadingStudents((prev) => ({ ...prev, [subjectId]: true }));

      const studentsResponse = await api.get(
        `/api/professor/subject/${subjectId}/enrolled`
      );

      if (!studentsResponse.data) {
        setSubjectStudents((prev) => ({ ...prev, [subjectId]: [] }));
        return;
      }

      const students = studentsResponse.data.studentList || [];
      setSubjectStudents((prev) => ({ ...prev, [subjectId]: students }));

      if (students.length === 0) return;

      const analysisPromises = students.map(async (student) => {
        const sid = student?.studentId ?? student?.id;
        if (!sid) {
          return { sid: null, subjectId, data: null };
        }
        try {
          const analysisResponse = await api.get(
            `/api/ai-analysis/student/${sid}`
          );

          if (analysisResponse.data?.code === 1) {
            const allResults = analysisResponse.data.data || [];
            const subjectAnalysis = allResults.find(
              (result) => result.subjectId === subjectId
            );
            return { sid, subjectId, data: subjectAnalysis || null };
          } else {
            return { sid, subjectId, data: null };
          }
        } catch (err) {
          console.error(
            `분석 조회 실패 studentId=${sid} subjectId=${subjectId}`,
            err
          );
          return { sid, subjectId, data: null };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);

      const newAnalysisMap = {};
      analysisResults.forEach((res) => {
        if (res && res.sid) {
          const key = `${res.sid}-${res.subjectId}`;
          newAnalysisMap[key] = res.data;
        }
      });

      setStudentAnalysis((prev) => ({ ...prev, ...newAnalysisMap }));
    } catch (err) {
      console.error("학생 목록 조회 실패:", err);
      if (err.response?.status === 404) {
        console.warn("enrolled 엔드포인트 없음. 기존 방식 사용");
        await fetchSubjectStudentsLegacy(subjectId);
      }
    } finally {
      setLoadingStudents((prev) => ({ ...prev, [subjectId]: false }));
    }
  };

  const fetchSubjectStudentsLegacy = async (subjectId) => {
    try {
      const studentsResponse = await api.get(
        `/api/professor/subject/${subjectId}`
      );

      if (!studentsResponse.data) {
        setSubjectStudents((prev) => ({ ...prev, [subjectId]: [] }));
        return;
      }

      const students = studentsResponse.data.studentList || [];
      setSubjectStudents((prev) => ({ ...prev, [subjectId]: students }));

      if (students.length === 0) return;

      const analysisPromises = students.map(async (student) => {
        const sid = student?.studentId ?? student?.id;
        if (!sid) {
          return { sid: null, subjectId, data: null };
        }
        try {
          const analysisResponse = await api.get(
            `/api/ai-analysis/student/${sid}`
          );

          if (analysisResponse.data?.code === 1) {
            const allResults = analysisResponse.data.data || [];
            const subjectAnalysis = allResults.find(
              (result) => result.subjectId === subjectId
            );
            return { sid, subjectId, data: subjectAnalysis || null };
          } else {
            return { sid, subjectId, data: null };
          }
        } catch (err) {
          console.error(
            `분석 조회 실패 studentId=${sid} subjectId=${subjectId}`,
            err
          );
          return { sid, subjectId, data: null };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);

      const newAnalysisMap = {};
      analysisResults.forEach((res) => {
        if (res && res.sid) {
          const key = `${res.sid}-${res.subjectId}`;
          newAnalysisMap[key] = res.data;
        }
      });

      setStudentAnalysis((prev) => ({ ...prev, ...newAnalysisMap }));
    } catch (err) {
      console.error("학생 목록 조회 실패 (legacy):", err);
    }
  };

  const handleCounselingClick = (studentId, subjectId) => {
    if (!studentId) {
      console.error("handleCounselingClick: studentId가 없습니다.", {
        studentId,
        subjectId,
      });
      setError("학생 식별자가 없어 상담페이지로 이동할 수 없습니다.");
      return;
    }

    const students = subjectStudents[subjectId] || [];
    const student = students.find((s) => (s?.studentId ?? s?.id) === studentId);
    const subject = subjects.find((s) => s.id === subjectId);

    setSelectedStudent({
      studentId: studentId,
      studentName: student?.studentName || student?.name || "학생",
      subjectId: subjectId,
      subjectName: subject?.name || "과목명",
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleModalSubmit = async () => {
    if (selectedStudent?.subjectId) {
      await fetchSubjectStudents(selectedStudent.subjectId);
    }
  };

  const handleAlertClick = (alert) => {
    if (alert.studentId && alert.subjectId) {
      navigate(
        `/aiprofessor/counseling/subject/${alert.subjectId}/student/${alert.studentId}`
      );
    } else {
      console.warn("handleAlertClick: alert에 studentId/subjectId 없음", alert);
    }
  };

  // 검색어 변경 핸들러
  const handleSearchChange = (subjectId, value) => {
    setSearchTerms((prev) => ({
      ...prev,
      [subjectId]: value,
    }));
  };

  // 정렬 핸들러
  const handleSort = (subjectId, field) => {
    setSortConfig((prev) => {
      const currentSort = prev[subjectId];
      const newDirection =
        currentSort?.field === field && currentSort?.direction === "asc"
          ? "desc"
          : "asc";

      return {
        ...prev,
        [subjectId]: { field, direction: newDirection },
      };
    });
  };

  // 상태값을 숫자로 변환 (정렬용)
  const getStatusValue = (status) => {
    const statusMap = {
      CRITICAL: 4,
      RISK: 3,
      CAUTION: 2,
      NORMAL: 1,
    };
    return statusMap[status] || 0;
  };

  // 학생 목록 필터링 및 정렬
  const getFilteredAndSortedStudents = (subjectId) => {
    const students = subjectStudents[subjectId] || [];
    const searchTerm = searchTerms[subjectId]?.toLowerCase() || "";
    const sortCfg = sortConfig[subjectId];

    // 검색 필터링
    let filtered = students;
    if (searchTerm) {
      filtered = students.filter((student) => {
        const sid = student?.studentId ?? student?.id;
        const name = student?.studentName || student?.name || "";
        const dept = student?.deptName || "";

        return (
          String(sid).toLowerCase().includes(searchTerm) ||
          name.toLowerCase().includes(searchTerm) ||
          dept.toLowerCase().includes(searchTerm)
        );
      });
    }

    // 정렬
    if (sortCfg?.field) {
      filtered = [...filtered].sort((a, b) => {
        const aId = a?.studentId ?? a?.id;
        const bId = b?.studentId ?? b?.id;
        const aAnalysis = studentAnalysis[`${aId}-${subjectId}`];
        const bAnalysis = studentAnalysis[`${bId}-${subjectId}`];

        let aValue, bValue;

        switch (sortCfg.field) {
          case "studentId":
            aValue = aId;
            bValue = bId;
            break;
          case "name":
            aValue = a?.studentName || a?.name || "";
            bValue = b?.studentName || b?.name || "";
            break;
          case "dept":
            aValue = a?.deptName || "";
            bValue = b?.deptName || "";
            break;
          case "attendance":
            aValue = getStatusValue(aAnalysis?.attendanceStatus);
            bValue = getStatusValue(bAnalysis?.attendanceStatus);
            break;
          case "homework":
            aValue = getStatusValue(aAnalysis?.homeworkStatus);
            bValue = getStatusValue(bAnalysis?.homeworkStatus);
            break;
          case "midterm":
            aValue = getStatusValue(aAnalysis?.midtermStatus);
            bValue = getStatusValue(bAnalysis?.midtermStatus);
            break;
          case "final":
            aValue = getStatusValue(aAnalysis?.finalStatus);
            bValue = getStatusValue(bAnalysis?.finalStatus);
            break;
          case "tuition":
            aValue = getStatusValue(aAnalysis?.tuitionStatus);
            bValue = getStatusValue(bAnalysis?.tuitionStatus);
            break;
          case "counseling":
            aValue = getStatusValue(aAnalysis?.counselingStatus);
            bValue = getStatusValue(bAnalysis?.counselingStatus);
            break;
          case "overallRisk":
            aValue = getStatusValue(aAnalysis?.overallRisk);
            bValue = getStatusValue(bAnalysis?.overallRisk);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortCfg.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortCfg.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  // 정렬 아이콘 표시
  const getSortIcon = (subjectId, field) => {
    const sortCfg = sortConfig[subjectId];
    if (sortCfg?.field !== field) return "↕";
    return sortCfg.direction === "asc" ? "↑" : "↓";
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      NORMAL: { text: "정상", class: "pc-risk-normal" },
      CAUTION: { text: "주의", class: "pc-risk-caution" },
      RISK: { text: "위험", class: "pc-risk-warning" },
      CRITICAL: { text: "심각", class: "pc-risk-critical" },
    };
    const badge = badges[riskLevel] || badges.NORMAL;
    return <span className={`pc-risk-badge ${badge.class}`}>{badge.text}</span>;
  };

  const getStatusBadge = (status) => {
    if (!status)
      return <span className="pc-status-badge pc-status-normal">-</span>;

    const badges = {
      NORMAL: { text: "정상", class: "pc-status-normal" },
      CAUTION: { text: "주의", class: "pc-status-caution" },
      RISK: { text: "위험", class: "pc-status-risk" },
      CRITICAL: { text: "심각", class: "pc-status-critical" },
    };
    const badge = badges[status] || badges.NORMAL;
    return (
      <span className={`pc-status-badge ${badge.class}`}>{badge.text}</span>
    );
  };

  if (loading) {
    return (
      <div className="pc-page-container">
        <div className="pc-loading">
          <div className="pc-loading-spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-page-container">
      <div className="pc-header">
        <h1 className="pc-title">상담 관리</h1>
        <p className="pc-subtitle">
          담당 과목의 학생들을 관리하고 상담을 진행할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="pc-error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {riskAlerts.length > 0 && (
        <div className="pc-alerts-section">
          <div className="pc-section-header">
            <h2>중도 이탈 위험 학생</h2>
            <span className="pc-alert-count">{riskAlerts.length}명</span>
          </div>
          <div className="pc-alerts-list">
            {riskAlerts.map((alert) => (
              <div
                key={alert.id}
                className="pc-alert-card"
                onClick={() => handleAlertClick(alert)}
              >
                <div className="pc-alert-header">
                  <div className="pc-alert-student">
                    <span>{alert.student?.name || "학생"}</span>
                  </div>
                  {getRiskBadge(alert.riskLevel)}
                </div>
                <div className="pc-alert-body">
                  <div className="pc-alert-subject">
                    {alert.subject?.name || "과목명"}
                  </div>
                  <div className="pc-alert-reason">{alert.riskReason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pc-subjects-section">
        <div className="pc-section-header">
          <h2>담당 과목</h2>
          <span className="pc-subject-count">{subjects.length}개</span>
        </div>

        {subjects.length === 0 ? (
          <div className="pc-empty-state">
            <p>담당 과목이 없습니다.</p>
          </div>
        ) : (
          <div className="pc-subjects-list">
            {subjects.map((subject) => (
              <div key={subject.id} className="pc-subject-item">
                <div
                  className="pc-subject-row"
                  onClick={() => toggleSubject(subject.id)}
                >
                  <div className="pc-subject-info-container">
                    <div className="pc-subject-info">
                      <h3>{subject.name}</h3>
                      <span className="pc-subject-details">
                        {subject.subYear}학년 {subject.semester}학기 |{" "}
                        {subject.subDay} {subject.startTime}교시 -{" "}
                        {subject.endTime}교시 |{" "}
                        {subject.room?.name || "강의실 미정"} | 수강인원:{" "}
                        {subject.numOfStudent || 0}/{subject.capacity}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedSubjects.has(subject.id) && (
                  <div className="pc-students-container">
                    {loadingStudents[subject.id] ? (
                      <div className="pc-students-loading">
                        <div className="pc-loading-spinner"></div>
                        <p>학생 목록을 불러오는 중...</p>
                      </div>
                    ) : subjectStudents[subject.id] &&
                      subjectStudents[subject.id].length > 0 ? (
                      <>
                        {/* 검색 바 */}
                        <div className="pc-search-bar">
                          <input
                            type="text"
                            placeholder="학번, 이름, 학과로 검색..."
                            value={searchTerms[subject.id] || ""}
                            onChange={(e) =>
                              handleSearchChange(subject.id, e.target.value)
                            }
                            className="pc-search-input"
                          />
                        </div>

                        <table className="pc-students-table">
                          <thead>
                            <tr>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "studentId")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                학번 {getSortIcon(subject.id, "studentId")}
                              </th>
                              <th
                                onClick={() => handleSort(subject.id, "name")}
                                style={{ cursor: "pointer" }}
                              >
                                이름 {getSortIcon(subject.id, "name")}
                              </th>
                              <th
                                onClick={() => handleSort(subject.id, "dept")}
                                style={{ cursor: "pointer" }}
                              >
                                학과 {getSortIcon(subject.id, "dept")}
                              </th>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "attendance")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                출결 {getSortIcon(subject.id, "attendance")}
                              </th>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "homework")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                과제 {getSortIcon(subject.id, "homework")}
                              </th>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "midterm")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                중간 {getSortIcon(subject.id, "midterm")}
                              </th>
                              <th
                                onClick={() => handleSort(subject.id, "final")}
                                style={{ cursor: "pointer" }}
                              >
                                기말 {getSortIcon(subject.id, "final")}
                              </th>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "tuition")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                등록금 {getSortIcon(subject.id, "tuition")}
                              </th>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "counseling")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                상담 {getSortIcon(subject.id, "counseling")}
                              </th>
                              <th
                                onClick={() =>
                                  handleSort(subject.id, "overallRisk")
                                }
                                style={{ cursor: "pointer" }}
                              >
                                종합위험도{" "}
                                {getSortIcon(subject.id, "overallRisk")}
                              </th>
                              <th>상담입력</th>
                              <th>상담이력</th>
                            </tr>
                          </thead>

                          <tbody>
                            {getFilteredAndSortedStudents(subject.id).map(
                              (student) => {
                                const sid = student?.studentId ?? student?.id;
                                const analysisKey = `${sid}-${subject.id}`;
                                const analysis = studentAnalysis[analysisKey];

                                return (
                                  <tr key={sid}>
                                    <td>{sid}</td>
                                    <td>
                                      {student.studentName || student.name}
                                    </td>
                                    <td>{student.deptName || "-"}</td>

                                    <td>
                                      {getStatusBadge(
                                        analysis?.attendanceStatus
                                      )}
                                    </td>
                                    <td>
                                      {getStatusBadge(analysis?.homeworkStatus)}
                                    </td>
                                    <td>
                                      {getStatusBadge(analysis?.midtermStatus)}
                                    </td>
                                    <td>
                                      {getStatusBadge(analysis?.finalStatus)}
                                    </td>
                                    <td>
                                      {getStatusBadge(analysis?.tuitionStatus)}
                                    </td>
                                    <td>
                                      {getStatusBadge(
                                        analysis?.counselingStatus
                                      )}
                                    </td>
                                    <td>
                                      {getRiskBadge(analysis?.overallRisk)}
                                    </td>

                                    <td>
                                      <button
                                        className="pc-counseling-btn"
                                        onClick={() =>
                                          handleCounselingClick(sid, subject.id)
                                        }
                                      >
                                        상담입력
                                      </button>
                                    </td>

                                    <td
                                      onClick={() =>
                                        navigate(
                                          `/aiprofessor/counseling/history/${sid}`
                                        )
                                      }
                                      style={{
                                        cursor: "pointer",
                                        color: "#0066ff",
                                      }}
                                    >
                                      상담이력
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </table>

                        {/* 검색 결과 없음 */}
                        {getFilteredAndSortedStudents(subject.id).length ===
                          0 && (
                          <div className="pc-empty-students">
                            <p>검색 결과가 없습니다.</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="pc-empty-students">
                        <p>수강 학생이 없습니다.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Counseling Form Modal */}
      {isModalOpen && selectedStudent && (
        <CounselingFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          studentName={selectedStudent.studentName}
          subjectName={selectedStudent.subjectName}
          studentId={selectedStudent.studentId}
          subjectId={selectedStudent.subjectId}
          professorId={user.id}
        />
      )}
    </div>
  );
}
