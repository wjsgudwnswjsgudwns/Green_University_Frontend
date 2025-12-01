import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
    if (role && user.role !== role) {
        // If role doesn't match, redirect to home
        return <Navigate to="/" replace />;
    }
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Header />
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
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
                        <Route
                            path="department"
                            element={<AdminDepartmentPage />}
                        />
                        <Route path="room" element={<AdminRoomPage />} />
                        <Route path="subject" element={<AdminSubjectPage />} />
                        <Route path="tuition" element={<AdminTuitionPage />} />
                    </Route>
                    {/* Catch-all route for undefined paths */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Footer />
            </BrowserRouter>
        </AuthProvider>
    );
}
