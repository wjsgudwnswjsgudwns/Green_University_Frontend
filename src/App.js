import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import StudentInfoPage from "./pages/student/StudentInfoPage";
import StudentCoursesPage from "./pages/student/StudentCoursesPage";
import StudentRegistrationPage from "./pages/student/StudentRegistrationPage";
import StudentGradesPage from "./pages/student/StudentGradesPage";
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
import CreateTuitionBillPage from "./pages/tuition/CreateTuitionBillPage";
import TuitionListPage from "./pages/tuition/TuitionListPage";
import TuitionPaymentPage from "./pages/tuition/TuitionPaymentPage";

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
  const hideHeaderFooterPaths = ["/login", "/find-id", "/find-password"];
  const shouldHideHeaderFooter = hideHeaderFooterPaths.includes(
    location.pathname
  );

  return (
    <>
      {!shouldHideHeaderFooter && <Header />}
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/find-id" element={<FindIdPage />} />
        <Route path="/find-password" element={<FindPasswordPage />} />
        <Route
          path="/student/break/application"
          element={<BreakApplication />}
        />
        <Route path="/student/break/list" element={<BreakListStudent />} />
        <Route path="/student/break/detail/:id" element={<BreakDetail />} />
        <Route path="/staff/break/list" element={<BreakListStaff />} />
        <Route path="/staff/break/detail/:id" element={<BreakDetail />} />
        <Route path="/staff/student-list" element={<StudentListStaff />} />
        <Route
          path="/staff/student-list/:page"
          element={<StudentListStaff />}
        />
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
          path="/schedule"
          element={
            <PrivateRoute>
              <ScheduleListPage />
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
          path="/schedule/:id"
          element={
            <PrivateRoute>
              <ScheduleDetailPage />
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
          path="/professor/syllabus/:subjectId"
          element={
            <PrivateRoute>
              <ReadSyllabusPage />
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
          path="/subject/list/:page"
          element={
            <PrivateRoute>
              <SubjectListPage />
            </PrivateRoute>
          }
        />
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
          path="/sugang/application"
          element={
            <PrivateRoute>
              <Application />
            </PrivateRoute>
          }
        />

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
          path="/subject/syllabus/:subjectId"
          element={
            <PrivateRoute>
              <SyllabusPage />
            </PrivateRoute>
          }
        />

        {/* Home route */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainPage />
            </PrivateRoute>
          }
        />
        {/* Student routes */}
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
          path="/student/subjects"
          element={
            <PrivateRoute role="student">
              <StudentCoursesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/student/registration"
          element={
            <PrivateRoute role="student">
              <StudentRegistrationPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/student/grades"
          element={
            <PrivateRoute role="student">
              <StudentGradesPage />
            </PrivateRoute>
          }
        />
        {/* Professor routes */}
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
        {/* Staff routes */}
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
        {/* Board routes */}
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
        {/* Schedule routes */}
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
        <Route path="/sugang/subjectlist" element={<SubjectList />} />
        {/* Admin registration routes (staff role) */}
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
        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!shouldHideHeaderFooter && <Footer />}
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
