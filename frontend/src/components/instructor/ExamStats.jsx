/**
 * SmartProctor - Sınav İstatistik ve Sonuç Sayfası
 * Eğitmen öğrenci cevaplarını ve istatistikleri görüntüler.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { examAPI } from '../../services/api'
import api from '../../services/api'
import { ArrowLeft, BarChart3, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function ExamStats() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      examAPI.get(examId),
      api.get(`/sessions/exam/${examId}/results`).catch(() => ({ data: [] })),
    ]).then(([examRes, sessRes]) => {
      setExam(examRes.data)
      setSessions(sessRes.data || [])
    }).finally(() => setLoading(false))
  }, [examId])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  if (!exam) return <p className="text-center py-20 text-gray-500">Sınav bulunamadı</p>

  const completedSessions = sessions.filter(s => s.score !== null)
  const avgScore = completedSessions.length > 0
    ? (completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length).toFixed(1)
    : '-'
  const passedCount = completedSessions.filter(s => s.score >= (exam.pass_score || 50)).length

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/instructor/exams')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft size={20} /> Sınavlara Dön
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
      <p className="text-gray-500 mb-6">{exam.description}</p>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Users size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
              <p className="text-sm text-gray-500">Katılımcı</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><BarChart3 size={20} className="text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
              <p className="text-sm text-gray-500">Ort. Puan</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle size={20} className="text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{passedCount}</p>
              <p className="text-sm text-gray-500">Başarılı</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><XCircle size={20} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completedSessions.length - passedCount}</p>
              <p className="text-sm text-gray-500">Başarısız</p>
            </div>
          </div>
        </div>
      </div>

      {/* Öğrenci Sonuçları Tablosu */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Öğrenci ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Durum</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Puan</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sekme Değ.</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Başlangıç</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Bitiş</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sessions.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Henüz katılımcı yok</td></tr>
            ) : sessions.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">#{s.student_id}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    s.status === 'submitted' ? 'bg-green-100 text-green-700' :
                    s.status === 'terminated' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold">
                  {s.score !== null ? (
                    <span className={s.score >= (exam.pass_score || 50) ? 'text-green-600' : 'text-red-600'}>
                      {s.score}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 text-sm">
                  {s.tab_switch_count > 0 ? (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <AlertTriangle size={14} /> {s.tab_switch_count}
                    </span>
                  ) : <span className="text-gray-400">0</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(s.started_at).toLocaleString('tr-TR')}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{s.finished_at ? new Date(s.finished_at).toLocaleString('tr-TR') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
