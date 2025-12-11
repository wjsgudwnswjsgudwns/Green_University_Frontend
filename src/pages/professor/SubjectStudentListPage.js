import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosConfig";
import "../../styles/subject.css";

export default function SubjectStudentListPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { subjectId } = useParams();

    const [subject, setSubject] = useState(null);
    const [studentList, setStudentList] = useState([]);
    const [loading, setLoading] = useState(true);

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
                const response = await api.get(
                    `/api/professor/subject/${subjectId}`
                );
                setSubject(response.data.subject);
                setStudentList(response.data.studentList || []);
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
                                    <a
                                        href="/professor/subject"
                                        className="selected--menu"
                                    >
                                        내 강의 조회
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <a href="/professor/evaluation">
                                        내 강의 평가
                                    </a>
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

                {studentList.length > 0 ? (
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
                                <th>점수 기입</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentList.map((student) => (
                                <tr key={student.studentId}>
                                    <td>{student.studentId}</td>
                                    <td>{student.studentName}</td>
                                    <td>{student.deptName}</td>
                                    <td>{student.absent || 0}</td>
                                    <td>{student.lateness || 0}</td>
                                    <td>{student.homework || 0}</td>
                                    <td>{student.midExam || 0}</td>
                                    <td>{student.finalExam || 0}</td>
                                    <td>{student.convertedMark || 0}</td>
                                    <td>
                                        <a
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigate(
                                                    `/professor/subject/${subjectId}/student/${student.studentId}`
                                                );
                                            }}
                                        >
                                            기입
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
