import { Navigate, Route, Routes } from 'react-router-dom';

import AdminRoute from '../components/AdminRoute';
import ProtectedRoute from '../components/ProtectedRoute';
import StudentRoute from '../components/StudentRoute';
import TeacherRoute from '../components/TeacherRoute';
import AdminLayout from '../pages/admin/AdminLayout';
import TeacherLayout from '../layouts/TeacherLayout';
import MainLayout from '../layouts/MainLayout';
import HomePage from '../pages/HomePage';
import LeaderboardPage from '../pages/LeaderboardPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProblemDetailPage from '../pages/ProblemDetailPage';
import ProblemsPage from '../pages/ProblemsPage';
import ProfilePage from '../pages/ProfilePage';
import RegisterPage from '../pages/RegisterPage';
import AdminProblemsPage from '../pages/admin/AdminProblemsPage';
import CreateEditProblemPage from '../pages/admin/CreateEditProblemPage';
import SettingsPage from '../pages/SettingsPage';
import SubmissionsPage from '../pages/SubmissionsPage';
import CoursesPage from '../pages/CoursesPage';
import CourseDetailPage from '../pages/CourseDetailPage';
import LessonViewPage from '../pages/LessonViewPage';
import MyLearningPage from '../pages/MyLearningPage';
import CourseCreatePage from '../pages/CourseCreatePage';
import TeacherDashboardPage from '../pages/teacher/DashboardPage';
import TeacherCourseListPage from '../pages/teacher/CourseListPage';
import TeacherCourseEditPage from '../pages/teacher/CourseEditPage';
import TeacherModuleManagePage from '../pages/teacher/ModuleManagePage';
import TeacherLessonManagePage from '../pages/teacher/LessonManagePage';
import TeacherMaterialManagePage from '../pages/teacher/MaterialManagePage';
import TeacherStudentListPage from '../pages/teacher/StudentListPage';
import StudentAnalyticsPage from '../pages/StudentAnalyticsPage';
import CourseAnalyticsPage from '../pages/CourseAnalyticsPage';
import ContestCatalogPage from '../pages/ContestCatalogPage';
import ContestDetailPage from '../pages/ContestDetailPage';
import ContestActivePage from '../pages/ContestActivePage';
import ContestStandingsPage from '../pages/ContestStandingsPage';
import ContestHistoryPage from '../pages/ContestHistoryPage';
import TeacherContestManagementPage from '../pages/TeacherContestManagementPage';
export default function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="profile/:handle" element={<ProfilePage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />

        <Route
          path="problems"
          element={
            <ProtectedRoute>
              <ProblemsPage />
            </ProtectedRoute>
          }
        />
        <Route path="problems/:slug" element={<ProblemDetailPage />} />

        <Route
          path="submissions"
          element={
            <ProtectedRoute>
              <SubmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/create" element={<CourseCreatePage />} />
        <Route path="courses/:id" element={<CourseDetailPage />} />
        <Route
          path="courses/:courseId/lessons/:lessonId"
          element={
            <StudentRoute>
              <LessonViewPage />
            </StudentRoute>
          }
        />
        <Route
          path="my-learning"
          element={
            <StudentRoute>
              <MyLearningPage />
            </StudentRoute>
          }
        />
        <Route
          path="my-learning/analytics"
          element={
            <StudentRoute>
              <StudentAnalyticsPage />
            </StudentRoute>
          }
        />
        <Route
          path="problems/:slug/submissions"
          element={
            <ProtectedRoute>
              <SubmissionsPage />
            </ProtectedRoute>
          }
        />

        <Route path="contests" element={<ContestCatalogPage />} />
        <Route path="contests/history" element={<ContestHistoryPage />} />
        <Route path="contests/:id" element={<ContestDetailPage />} />
        <Route path="contests/:id/active" element={<ContestActivePage />} />
        <Route path="contests/:id/standings" element={<ContestStandingsPage />} />

        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/problems" replace />} />
          <Route path="problems" element={<AdminProblemsPage />} />
          <Route path="problems/create" element={<CreateEditProblemPage />} />
          <Route path="problems/:slug/edit" element={<CreateEditProblemPage />} />
        </Route>

        <Route
          path="teacher"
          element={
            <TeacherRoute>
              <TeacherLayout />
            </TeacherRoute>
          }
        >
          <Route path="" element={<TeacherDashboardPage />} />
          <Route path="contests" element={<TeacherContestManagementPage />} />
          <Route path="courses" element={<TeacherCourseListPage />} />
          <Route path="courses/:id/edit" element={<TeacherCourseEditPage />} />
          <Route path="courses/:courseId/modules" element={<TeacherModuleManagePage />} />
          <Route path="courses/:courseId/modules/:moduleId/lessons" element={<TeacherLessonManagePage />} />
          <Route path="courses/:courseId/modules/:moduleId/lessons/:lessonId/materials" element={<TeacherMaterialManagePage />} />
          <Route path="courses/:courseId/analytics" element={<CourseAnalyticsPage />} />
          <Route path="students" element={<TeacherStudentListPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
