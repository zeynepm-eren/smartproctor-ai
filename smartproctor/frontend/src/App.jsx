/**
 * SmartProctor - Ana Uygulama Bileşeni
 * React Router ile rol tabanlı sayfa yönlendirmesi.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Auth
import Login from './components/auth/Login'
import Register from './components/auth/Register'

// Layout
import { ProtectedRoute, DashboardLayout } from './components/layout/Layout'

// Dashboards
import StudentDashboard from './components/dashboard/StudentDashboard'
import StudentHistory from './components/dashboard/StudentHistory'
import InstructorDashboard from './components/dashboard/InstructorDashboard'

// Instructor
import InstructorExams from './components/instructor/InstructorExams'
import ExamCreate from './components/instructor/ExamCreate'
import ExamEdit from './components/instructor/ExamEdit'
import ExamStats from './components/instructor/ExamStats'
import ConflictResolution from './components/instructor/ConflictResolution'
import ProctorAssign from './components/instructor/ProctorAssign'

// Exam
import ExamInterface from './components/exam/ExamInterface'

// Proctor
import ProctorDashboard from './components/proctor/ProctorDashboard'

/** Ana sayfa yönlendirmesi: Role göre dashboard'a atar. */
function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  switch (user.role) {
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
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Ana sayfa yönlendirme */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Öğrenci Rotaları */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/history" element={<StudentHistory />} />
            </Route>
            {/* Sınav arayüzü - tam ekran (layout dışı) */}
            <Route path="/student/exam/:examId" element={<ExamInterface />} />
          </Route>

          {/* Eğitmen Rotaları */}
          <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/instructor" element={<InstructorDashboard />} />
              <Route path="/instructor/exams" element={<InstructorExams />} />
              <Route path="/instructor/exams/create" element={<ExamCreate />} />
              <Route path="/instructor/exams/:examId" element={<ExamEdit />} />
              <Route path="/instructor/exams/:examId/stats" element={<ExamStats />} />
              <Route path="/instructor/conflicts" element={<ConflictResolution />} />
              <Route path="/instructor/proctors" element={<ProctorAssign />} />
            </Route>
          </Route>

          {/* Gözetmen Rotaları */}
          <Route element={<ProtectedRoute allowedRoles={['proctor']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/proctor" element={<ProctorDashboard />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
