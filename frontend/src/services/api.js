/**
 * SmartProctor - API Servis Katmanı
 * Axios ile backend API iletişimi.
 * Token otomatik olarak header'a eklenir.
 */

import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: Token ekleme
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: 401 durumunda token yenileme
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, {
            refresh_token: refreshToken,
          })
          localStorage.setItem('access_token', res.data.access_token)
          localStorage.setItem('refresh_token', res.data.refresh_token)
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
          return api(originalRequest)
        } catch {
          // Refresh başarısız, çıkış yap
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// --- Auth ---
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
}

// --- Courses ---
export const courseAPI = {
  list: () => api.get('/courses/'),
  create: (data) => api.post('/courses/', data),
  get: (id) => api.get(`/courses/${id}`),
  update: (id, data) => api.put(`/courses/${id}`, data),
  enroll: (courseId, data) => api.post(`/courses/${courseId}/enroll`, data),
  students: (courseId) => api.get(`/courses/${courseId}/students`),
}

// --- Exams ---
export const examAPI = {
  list: () => api.get('/exams/'),
  create: (data) => api.post('/exams/', data),
  get: (id) => api.get(`/exams/${id}`),
  update: (id, data) => api.put(`/exams/${id}`, data),
  addQuestion: (examId, data) => api.post(`/exams/${examId}/questions`, data),
  listQuestions: (examId) => api.get(`/exams/${examId}/questions`),
  listQuestionsStudent: (examId) => api.get(`/exams/${examId}/questions/student`),
}

// --- Sessions ---
export const sessionAPI = {
  start: (examId) => api.post(`/sessions/start/${examId}`),
  submitAnswer: (data) => api.post('/sessions/answer', data),
  finish: (sessionId) => api.post(`/sessions/finish/${sessionId}`),
  logTabSwitch: (sessionId) => api.post(`/sessions/tab-switch/${sessionId}`),
  mySessions: () => api.get('/sessions/my-sessions'),
}

// --- Violations ---
export const violationAPI = {
  log: (data) => api.post('/violations/log', data),
  uploadEvidence: (violationId, formData) =>
    api.post(`/violations/upload-evidence/${violationId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  pendingReviews: () => api.get('/violations/pending-reviews'),
  submitReview: (violationId, data) => api.post(`/violations/review/${violationId}`, data),
  listConflicts: () => api.get('/violations/conflicts'),
  resolveConflict: (violationId, data) =>
    api.post(`/violations/conflicts/${violationId}/resolve`, data),
}

// --- Notifications ---
export const notificationAPI = {
  list: () => api.get('/notifications/'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
}

export default api
