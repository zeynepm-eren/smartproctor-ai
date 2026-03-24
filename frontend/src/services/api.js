import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
          localStorage.setItem('access_token', res.data.access_token)
          localStorage.setItem('refresh_token', res.data.refresh_token)
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
          return api(originalRequest)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getUsers: (params) => api.get('/auth/users', { params }),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  getInstructors: () => api.get('/auth/instructors'),
  getStudents: () => api.get('/auth/students'),
  getProctors: () => api.get('/auth/proctors'),
}

export const courseAPI = {
  list: () => api.get('/courses/'),
  listAll: () => api.get('/courses/all'),
  get: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses/', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),
  assignInstructor: (courseId, instructorId) => api.post(`/courses/${courseId}/assign-instructor`, { instructor_id: instructorId }),
  removeInstructor: (courseId) => api.delete(`/courses/${courseId}/remove-instructor`),
  enroll: (courseId, studentId) => api.post(`/courses/${courseId}/enroll`, { student_id: studentId }),
  unenroll: (courseId, studentId) => api.delete(`/courses/${courseId}/unenroll/${studentId}`),
  students: (courseId) => api.get(`/courses/${courseId}/students`),
}

export const examAPI = {
  list: () => api.get('/exams/'),
  create: (data) => api.post('/exams/', data),
  get: (id) => api.get(`/exams/${id}`),
  update: (id, data) => api.put(`/exams/${id}`, data),
  delete: (id) => api.delete(`/exams/${id}`),
  addQuestion: (examId, data) => api.post(`/exams/${examId}/questions`, data),
  updateQuestion: (examId, questionId, data) => api.put(`/exams/${examId}/questions/${questionId}`, data),
  deleteQuestion: (examId, questionId) => api.delete(`/exams/${examId}/questions/${questionId}`),
  listQuestions: (examId) => api.get(`/exams/${examId}/questions`),
  listQuestionsStudent: (examId) => api.get(`/exams/${examId}/questions/student`),
}

export const sessionAPI = {
  start: (examId) => api.post(`/sessions/start/${examId}`),
  submitAnswer: (data) => api.post('/sessions/answer', data),
  finish: (sessionId) => api.post(`/sessions/finish/${sessionId}`),
  logTabSwitch: (sessionId) => api.post(`/sessions/tab-switch/${sessionId}`),
  mySessions: () => api.get('/sessions/my-sessions'),
}

export const violationAPI = {
  log: (data) => api.post('/violations/log', data),
  uploadEvidence: (violationId, blob) => {
    const formData = new FormData()
    formData.append('video', blob, 'evidence.webm')
    return api.post(`/violations/upload-evidence/${violationId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  pendingReviews: () => api.get('/violations/pending-reviews'),
  submitReview: (violationId, data) => api.post(`/violations/review/${violationId}`, data),
  listConflicts: () => api.get('/violations/conflicts'),
  resolveConflict: (violationId, data) => api.post(`/violations/conflicts/${violationId}/resolve`, data),
  heartbeat: (sessionId) => api.post(`/violations/heartbeat/${sessionId}`),
  heartbeatStatus: (sessionId) => api.get(`/violations/heartbeat/${sessionId}/status`),
  sessionReport: (sessionId) => api.get(`/violations/session/${sessionId}/report`),
}

// violationApi.js uyumluluğu — hook'lar bu fonksiyonları kullanıyor
export async function logViolation(data) {
  const res = await violationAPI.log(data)
  return res.data
}

export async function uploadEvidence(violationId, blob) {
  const res = await violationAPI.uploadEvidence(violationId, blob)
  return res.data
}

export async function sendHeartbeat(sessionId) {
  const res = await violationAPI.heartbeat(sessionId)
  return res.data
}

export const notificationAPI = {
  list: () => api.get('/notifications/'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
}

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
}

export default api
