import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import AdminRegisterPage from "./pages/admin/AdminRegisterPage";
import AdminCollegePage from "./pages/admin/AdminCollegePage";
import AdminDepartmentPage from "./pages/admin/AdminDepartmentPage";
import AdminRoomPage from "./pages/admin/AdminRoomPage";
import AdminSubjectPage from "./pages/admin/AdminSubjectPage";
import AdminTuitionPage from "./pages/admin/AdminTuitionPage";
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

/**
 * A wrapper for routes requiring authentication. If a user is not
 * authenticated, they will be redirected to the login page. Optionally
 * role based access control can be implemented by passing a role prop.
 */
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

export default function App() {
  return (
    <AuthProvider>
      <Header />
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

        {/* Admin registration routes (staff role) */}
        <Route
          path="/admin/register"
          element={
            <PrivateRoute role="staff">
              <AdminRegisterPage />
            </PrivateRoute>
          }
        >
          <Route index element={<AdminCollegePage />} />
          <Route path="college" element={<AdminCollegePage />} />
          <Route path="department" element={<AdminDepartmentPage />} />
          <Route path="room" element={<AdminRoomPage />} />
          <Route path="subject" element={<AdminSubjectPage />} />
          <Route path="tuition" element={<AdminTuitionPage />} />
        </Route>

        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </AuthProvider>
  );
}
