import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login from './components/auth/Login'
import Register from './components/auth/Register'
import { ProtectedRoute, DashboardLayout } from './components/layout/Layout'
import StudentDashboard from './components/dashboard/StudentDashboard'
import StudentHistory from './components/dashboard/StudentHistory'
import InstructorDashboard from './components/dashboard/InstructorDashboard'
import InstructorExams from './components/instructor/InstructorExams'
import ExamCreate from './components/instructor/ExamCreate'
import ExamEdit from './components/instructor/ExamEdit'
import ExamStats from './components/instructor/ExamStats'
import ConflictResolution from './components/instructor/ConflictResolution'
import InstructorStudents from './components/instructor/InstructorStudents'
import ExamInterface from './components/exam/ExamInterface'
import ProctorDashboard from './components/proctor/ProctorDashboard'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminCourses from './components/admin/AdminCourses'
import AdminUsers from './components/admin/AdminUsers'
import AdminEnrollments from './components/admin/AdminEnrollments'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  switch (user.role) {
    case 'admin': return <Navigate to="/admin" replace />
    case 'instructor': return <Navigate to="/instructor" replace />
    case 'proctor': return <Navigate to="/proctor" replace />
    default: return <Navigate to="/student" replace />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<HomeRedirect />} />

          {/* Öğrenci */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/history" element={<StudentHistory />} />
            </Route>
            <Route path="/student/exam/:examId" element={<ExamInterface />} />
          </Route>

          {/* Eğitmen — gözetmen ata kaldırıldı */}
          <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/instructor" element={<InstructorDashboard />} />
              <Route path="/instructor/exams" element={<InstructorExams />} />
              <Route path="/instructor/exams/create" element={<ExamCreate />} />
              <Route path="/instructor/exams/:examId" element={<ExamEdit />} />
              <Route path="/instructor/exams/:examId/stats" element={<ExamStats />} />
              <Route path="/instructor/students" element={<InstructorStudents />} />
              <Route path="/instructor/conflicts" element={<ConflictResolution />} />
            </Route>
          </Route>

          {/* Gözetmen */}
          <Route element={<ProtectedRoute allowedRoles={['proctor']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/proctor" element={<ProctorDashboard />} />
            </Route>
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/enrollments" element={<AdminEnrollments />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
