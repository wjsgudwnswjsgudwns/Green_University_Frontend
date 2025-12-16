import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import StudentInfoPage from "./pages/student/StudentInfoPage";
import NoticeListPage from "./pages/board/NoticeListPage";
import NoticeDetailPage from "./pages/board/NoticeDetailPage";
import ScheduleListPage from "./pages/schedule/ScheduleListPage";
import ScheduleDetailPage from "./pages/schedule/ScheduleDetailPage";
import FindIdPage from "./pages/access/FindIdPage";
import FindPasswordPage from "./pages/access/FindPasswordPage";
import ProfessorInfoPage from "./pages/professor/ProfessorInfoPage";
import StaffInfoPage from "./pages/staff/StaffInfoPage";
import UpdateUserPage from "./pages/access/UpdateUserPage";
import ChangePasswordPage from "./pages/access/ChangePasswordPage";
import BreakApplication from "./pages/break/BreakApplication";
import BreakListStudent from "./pages/break/BreakListStudent";
import BreakDetail from "./pages/break/BreakDetail";
import BreakListStaff from "./pages/break/BreakListStaff";
import StudentListStaff from "./pages/student/StudentListStaff";
import NoticeEditPage from "./pages/board/NoticeEditPage";
import NoticeWritePage from "./pages/board/NoticeWritePage";
import ScheduleManagePage from "./pages/schedule/ScheduleManagePage";
import ScheduleRegisterPage from "./pages/schedule/ScheduleRegisterPage";
import ProfessorListStaff from "./pages/professor/ProfessorListStaff";
import RegisterStudent from "./pages/admin/RegisterStudent";
import RegisterProfessor from "./pages/admin/RegisterProfessor";
import RegisterStaff from "./pages/admin/RegisterStaff";
import MeetingListPage from "./pages/MeetingListPage";
import MeetingDetailPage from "./pages/MeetingDetailPage";
import MeetingJoinPage from "./pages/MeetingJoinPage";
import CollegeManagement from "./pages/admin/CollegeManagement";
import UpdateStudentGradePage from "./pages/professor/UpdateStudentGradePage";
import SubjectStudentListPage from "./pages/professor/SubjectStudentListPage";
import ProfessorSubjectListPage from "./pages/professor/ProfessorSubjectListPage";
import ReadSyllabusPage from "./pages/professor/ReadSyllabusPage";
import UpdateSyllabusPage from "./pages/professor/UpdateSyllabusPage";
import SubjectListPage from "./pages/professor/SubjectListPage";
import SyllabusPage from "./pages/professor/SyllabusPage";
import DepartmentManagement from "./pages/admin/DepartmentManagement";
import RoomManagement from "./pages/admin/RoomManagement";
import TuitionManagement from "./pages/admin/TuitionManagement";
import SubjectManagement from "./pages/admin/SubjectManagement";
import SubjectList from "./pages/sugang/SubjectList";
import PreAppList from "./pages/sugang/PreAppList";
import PreApplication from "./pages/sugang/PreApplication";
import AppList from "./pages/sugang/AppList";
import Application from "./pages/sugang/Application";
import UpdatePeriodPage from "./pages/sugang/UpdatePeriodPage";
import SchedulePage from "./pages/sugang/SchedulePage";
import CreateTuitionBillPage from "./pages/tuition/CreateTuitionBillPage";
import TuitionListPage from "./pages/tuition/TuitionListPage";
import TuitionPaymentPage from "./pages/tuition/TuitionPaymentPage";
import ThisSemesterGrade from "./pages/grade/ThisSemesterGrade";
import SemesterGrade from "./pages/grade/SemesterGrade";
import TotalGrade from "./pages/grade/TotalGrade";
import MyEvaluation from "./pages/evaluation/MyEvaluation";
import EvaluationForm from "./pages/evaluation/EvaluationForm";
import ChatbotPage from "./pages/chatbot/ChatbotPage";
import ChatbotButton from "./components/ChatbotButton";
import ProfessorCounselingPage from "./pages/ProfessorCounselingPage";
import StudentCounselingPage from "./pages/StudentCounselingPage";
import StaffAllStudentsPage from "./pages/ai/StaffAllStudentsPage";
import StaffStudentDetailPage from "./pages/ai/StaffStudentDetailPage";
import AIProfessorCounselingPage from "./pages/ai/AIProfessorCounselingPage";
import CounselingHistoryPage from "./pages/ai/CounselingHistoryPage";
import AIProfessorRiskStudentsPage from "./pages/ai/AIProfessorRiskStudentsPage";
import AIProfessorCounselingLayout from "./pages/ai/AIProfessorCounselingLayout";
import StaffStudentManagementLayout from "./pages/ai/StaffStudentManagementLayout";
import StaffRiskStudentsPage from "./pages/ai/StaffRiskStudentsPage";
import AssignAdvisorPage from "./pages/AssignAdvisorPage";

function PrivateRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.userRole !== role) {
    // If role doesn't match, redirect to home
    return <Navigate to="/" replace />;
  }
  return children;
}

function Layout() {
  const location = useLocation();

  // 헤더와 푸터를 숨길 경로들
  const hideHeaderFooterPaths = [
    "/login",
    "/find-id",
    "/find-password",
    "/evaluation",
    "/professor/syllabus/:subjectId",
  ];
  const shouldHideHeaderFooter =
    hideHeaderFooterPaths.includes(location.pathname) ||
    location.pathname.startsWith("/subject/syllabus/") ||
    location.pathname.startsWith("/professor/syllabus/edit/");

  return (
    <>
      {!shouldHideHeaderFooter && <Header />}
      <Routes>
        {/* Public routes */}
        {/* 로그인 관련 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/find-id" element={<FindIdPage />} />
        <Route path="/find-password" element={<FindPasswordPage />} />

        <Route
          path="/subject/syllabus/:subjectId"
          element={
            <PrivateRoute>
              <SyllabusPage />
            </PrivateRoute>
          }
        />

        {/* 홈 */}

        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainPage />
            </PrivateRoute>
          }
        />

        {/* 공통 */}
        <Route
          path="/board/notice"
          element={
            <PrivateRoute>
              <NoticeListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/board/notice/:id"
          element={
            <PrivateRoute>
              <NoticeDetailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <PrivateRoute>
              <ScheduleListPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/schedule/:id"
          element={
            <PrivateRoute>
              <ScheduleDetailPage />
            </PrivateRoute>
          }
        />

        {/* 학생 */}

        {/* 휴학 */}
        <Route
          path="/student/break/application"
          element={<BreakApplication />}
        />
        <Route path="/student/break/list" element={<BreakListStudent />} />
        <Route path="/student/break/detail/:id" element={<BreakDetail />} />
        <Route path="/staff/break/list" element={<BreakListStaff />} />
        <Route path="/staff/break/detail/:id" element={<BreakDetail />} />

        <Route
          path="/subject/list/:page"
          element={
            <PrivateRoute>
              <SubjectListPage />
            </PrivateRoute>
          }
        />

        <Route path="/sugang/subjectlist" element={<SubjectList />} />

        <Route
          path="/sugang/preAppList"
          element={
            <PrivateRoute>
              <PreAppList />
            </PrivateRoute>
          }
        />
        <Route
          path="/sugang/pre"
          element={
            <PrivateRoute>
              <PreApplication />
            </PrivateRoute>
          }
        />
        <Route
          path="/sugang/list"
          element={
            <PrivateRoute>
              <AppList />
            </PrivateRoute>
          }
        />
        <Route
          path="/sugang/schedule"
          element={
            <PrivateRoute role="student">
              <SchedulePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/sugang/application"
          element={
            <PrivateRoute>
              <Application />
            </PrivateRoute>
          }
        />

        <Route
          path="/student/info"
          element={
            <PrivateRoute role="student">
              <StudentInfoPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/student/update"
          element={
            <PrivateRoute role="student">
              <UpdateUserPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/student/password"
          element={
            <PrivateRoute role="student">
              <ChangePasswordPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/grade/thisSemester"
          element={
            <PrivateRoute role="student">
              <ThisSemesterGrade />
            </PrivateRoute>
          }
        />
        <Route
          path="/grade/semester"
          element={
            <PrivateRoute role="student">
              <SemesterGrade />
            </PrivateRoute>
          }
        />
        <Route
          path="/grade/total"
          element={
            <PrivateRoute role="student">
              <TotalGrade />
            </PrivateRoute>
          }
        />

        <Route
          path="/evaluation"
          element={
            <PrivateRoute role="student">
              <EvaluationForm />
            </PrivateRoute>
          }
        />

        {/* 교수 */}
        <Route
          path="/professor/subject"
          element={
            <PrivateRoute role="professor">
              <ProfessorSubjectListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/professor/subject/:subjectId"
          element={
            <PrivateRoute role="professor">
              <SubjectStudentListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/professor/subject/:subjectId/student/:studentId"
          element={
            <PrivateRoute role="professor">
              <UpdateStudentGradePage />
            </PrivateRoute>
          }
        />

        <Route
          path="/professor/syllabus/edit/:subjectId"
          element={
            <PrivateRoute role="professor">
              <UpdateSyllabusPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/student/tuition/list"
          element={
            <PrivateRoute role="student">
              <TuitionListPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/student/tuition/payment"
          element={
            <PrivateRoute>
              <TuitionPaymentPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/professor/info"
          element={
            <PrivateRoute role="professor">
              <ProfessorInfoPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/professor/update"
          element={
            <PrivateRoute role="professor">
              <UpdateUserPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/professor/password"
          element={
            <PrivateRoute role="professor">
              <ChangePasswordPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/evaluation/read"
          element={
            <PrivateRoute role="professor">
              <MyEvaluation />
            </PrivateRoute>
          }
        />

        <Route
          path="/chatbot"
          element={
            <PrivateRoute role="student">
              <ChatbotPage />
            </PrivateRoute>
          }
        />

        {/* 직원 */}

        <Route path="/staff/student-list" element={<StudentListStaff />} />
        <Route
          path="/staff/student-list/:page"
          element={<StudentListStaff />}
        />

        <Route
          path="/board/notice/write"
          element={
            <PrivateRoute role="staff">
              <NoticeWritePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/board/notice/edit/:id"
          element={
            <PrivateRoute role="staff">
              <NoticeEditPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/schedule/manage"
          element={
            <PrivateRoute role="staff">
              <ScheduleManagePage />
            </PrivateRoute>
          }
        />

        <Route
          path="/schedule/register"
          element={
            <PrivateRoute role="staff">
              <ScheduleRegisterPage />
            </PrivateRoute>
          }
        />
        <Route path="/staff/professor-list" element={<ProfessorListStaff />} />
        <Route
          path="/staff/professor-list/:page"
          element={<ProfessorListStaff />}
        />
        <Route path="/staff/register-student" element={<RegisterStudent />} />
        <Route
          path="/staff/register-professor"
          element={<RegisterProfessor />}
        />
        <Route path="/staff/register-staff" element={<RegisterStaff />} />

        <Route
          path="/staff/course-period"
          element={
            <PrivateRoute role="staff">
              <UpdatePeriodPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/staff/tuition/bill"
          element={
            <PrivateRoute role="staff">
              <CreateTuitionBillPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/staff/info"
          element={
            <PrivateRoute role="staff">
              <StaffInfoPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/update"
          element={
            <PrivateRoute role="staff">
              <UpdateUserPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/password"
          element={
            <PrivateRoute role="staff">
              <ChangePasswordPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/staff/admin"
          element={
            <PrivateRoute role="staff">
              <Navigate to="/staff/admin/college" />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/admin/college"
          element={
            <PrivateRoute role="staff">
              <CollegeManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/admin/department"
          element={
            <PrivateRoute role="staff">
              <DepartmentManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/admin/room"
          element={
            <PrivateRoute role="staff">
              <RoomManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/admin/tuition"
          element={
            <PrivateRoute role="staff">
              <TuitionManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/admin/subject"
          element={
            <PrivateRoute role="staff">
              <SubjectManagement />
            </PrivateRoute>
          }
        />

        {/* Web Chatting */}

        <Route
          path="/meetings/:meetingId"
          element={
            <PrivateRoute>
              <MeetingDetailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/meetings/:meetingId/join"
          element={
            <PrivateRoute>
              <MeetingJoinPage />
            </PrivateRoute>
          }
        />

        {/* 학생 상담 페이지 */}
        <Route path="/student/counseling" element={<StudentCounselingPage />} />

        <Route
          path="/aiprofessor/counseling"
          element={<AIProfessorCounselingLayout />}
        >
          {/* 전체 학생 관리 (기본 페이지) */}
          <Route index element={<AIProfessorCounselingPage />} />

          {/* 위험 학생 관리 */}
          <Route path="risk" element={<AIProfessorRiskStudentsPage />} />

          <Route path="schedule" element={<ProfessorCounselingPage />} />

          <Route
            path="meetings"
            element={
              <PrivateRoute>
                <MeetingListPage />
              </PrivateRoute>
            }
          />
        </Route>

        <Route
          path="/aiprofessor/counseling/history/:studentId"
          element={<CounselingHistoryPage />}
        />

        {/* 스태프 상담 페이지 */}

        <Route
          path="/staff/students/all"
          element={<StaffStudentManagementLayout />}
        >
          <Route index element={<StaffAllStudentsPage />} />
          <Route path="risk" element={<StaffRiskStudentsPage />} />
        </Route>

        <Route
          path="/staff/student/:studentId"
          element={<StaffStudentDetailPage />}
        />

        <Route
          path="/staff/admin/assign-advisor"
          element={
            <PrivateRoute role="staff">
              <AssignAdvisorPage />
            </PrivateRoute>
          }
        />

        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!shouldHideHeaderFooter && <Footer />}
      {!shouldHideHeaderFooter && <ChatbotButton />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
