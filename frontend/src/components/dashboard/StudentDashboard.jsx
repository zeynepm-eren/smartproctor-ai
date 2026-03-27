import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { examAPI, sessionAPI } from '../../services/api'
import { BookOpen, Clock, CheckCircle, AlertTriangle, Play } from 'lucide-react'

export default function StudentDashboard() {
  const [exams, setExams] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [examRes, sessionRes] = await Promise.allSettled([
        examAPI.list(),
        sessionAPI.mySessions(),
      ])
      if (examRes.status === 'fulfilled') setExams(examRes.value.data)
      else setError('Sinavlar yuklenirken hata olustu')
      if (sessionRes.status === 'fulfilled') setSessions(sessionRes.value.data)
    } catch (err) {
      setError('Veriler yuklenirken hata olustu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [location.key])

  const getSessionForExam = (examId) => sessions.find((s) => s.exam_id === examId)

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sinavlarim</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <div className="flex items-center gap-2"><AlertTriangle size={16} /><span>{error}</span></div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
          <p>Henuz atanmis sinaviniz yok.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => {
            const session = getSessionForExam(exam.id)
            const isCompleted = session && ['submitted', 'timed_out', 'terminated'].includes(session.status)
            const isInProgress = session && ['started', 'in_progress'].includes(session.status)
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
                      <CheckCircle size={14} /> Tamamlandi
                    </span>
                  ) : isActive ? (
                    <span className="flex items-center gap-1 text-blue-600 text-xs font-medium bg-blue-50 px-2 py-1 rounded-full">
                      <Play size={14} /> Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium bg-yellow-50 px-2 py-1 rounded-full">
                      <Clock size={14} /> {exam.status === 'scheduled' ? 'Planlanmis' : exam.status}
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-500 mb-4 space-y-1">
                  <p className="flex items-center gap-2"><Clock size={14} /> {exam.duration_minutes} dakika</p>
                  {exam.question_count > 0 && <p>{exam.question_count} soru</p>}
                </div>

                {isCompleted && (
                  <div className="w-full py-2.5 text-center text-green-600 text-sm bg-green-50 rounded-lg font-medium">
                    Sınav tamamlandı
                  </div>
                )}

                {!isCompleted && isInProgress && isActive && (
                  <button onClick={() => navigate(`/student/exam/${exam.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium transition">
                    <Play size={18} /> Devam Et
                  </button>
                )}

                {!isCompleted && !isInProgress && isActive && (
                  <button onClick={() => navigate(`/student/exam/${exam.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">
                    <Play size={18} /> Sinava Basla
                  </button>
                )}

                {!isCompleted && !isActive && (
                  <div className="w-full py-2.5 text-center text-gray-400 text-sm border border-dashed rounded-lg">
                    Sinav henuz aktif degil
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}