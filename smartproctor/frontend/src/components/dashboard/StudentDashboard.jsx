/**
 * SmartProctor - Öğrenci Dashboard
 * Atanan ve geçmiş sınavları listeler.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { examAPI, sessionAPI } from '../../services/api'
import { BookOpen, Clock, CheckCircle, AlertTriangle, Play } from 'lucide-react'

export default function StudentDashboard() {
  const [exams, setExams] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([examAPI.list(), sessionAPI.mySessions()])
      .then(([examRes, sessionRes]) => {
        setExams(examRes.data)
        setSessions(sessionRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const getSessionForExam = (examId) => sessions.find((s) => s.exam_id === examId)

  const startExam = (examId) => navigate(`/student/exam/${examId}`)

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sınavlarım</h1>

      {exams.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
          <p>Henüz atanmış sınavınız yok.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => {
            const session = getSessionForExam(exam.id)
            const isCompleted = session && ['submitted', 'timed_out', 'terminated'].includes(session.status)
            const isActive = exam.status === 'active'

            return (
              <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{exam.description}</p>
                  </div>
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle size={14} /> Tamamlandı
                    </span>
                  ) : isActive ? (
                    <span className="flex items-center gap-1 text-blue-600 text-xs font-medium bg-blue-50 px-2 py-1 rounded-full">
                      <Play size={14} /> Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium bg-yellow-50 px-2 py-1 rounded-full">
                      <Clock size={14} /> Planlanmış
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1"><Clock size={14} /> {exam.duration_minutes} dk</span>
                  <span>{exam.question_count || 0} soru</span>
                  {exam.pass_score && <span>Geçme: %{exam.pass_score}</span>}
                </div>

                {isCompleted ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Puan:</span>
                    <span className={`text-lg font-bold ${session.score >= (exam.pass_score || 50) ? 'text-green-600' : 'text-red-600'}`}>
                      {session.score}
                    </span>
                  </div>
                ) : isActive ? (
                  <button onClick={() => startExam(exam.id)}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2">
                    <Play size={18} /> Sınava Başla
                  </button>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">Sınav henüz başlamadı</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
