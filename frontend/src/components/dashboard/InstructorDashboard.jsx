/**
 * SmartProctor - Eğitmen Dashboard
 * Dersler, sınavlar ve uyuşmazlıkların yönetimi.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { courseAPI, examAPI } from '../../services/api'
import { BookOpen, FileText, Plus, Users, BarChart3 } from 'lucide-react'

export default function InstructorDashboard() {
  const [courses, setCourses] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([courseAPI.list(), examAPI.list()])
      .then(([courseRes, examRes]) => {
        setCourses(courseRes.data)
        setExams(examRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
  }

  const statusLabels = {
    draft: 'Taslak',
    scheduled: 'Planlanmış',
    active: 'Aktif',
    completed: 'Tamamlanmış',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Eğitmen Paneli</h1>
        <div className="flex gap-3">
          <Link to="/instructor/exams/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <Plus size={18} /> Sınav Oluştur
          </Link>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BookOpen size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
              <p className="text-sm text-gray-500">Ders</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><FileText size={20} className="text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{exams.length}</p>
              <p className="text-sm text-gray-500">Sınav</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg"><BarChart3 size={20} className="text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{exams.filter(e => e.status === 'active').length}</p>
              <p className="text-sm text-gray-500">Aktif Sınav</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Users size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{exams.filter(e => e.status === 'completed').length}</p>
              <p className="text-sm text-gray-500">Tamamlanan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sınav Listesi */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sınavlar</h2>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sınav</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Durum</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Süre</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sorular</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {exams.map((exam) => (
              <tr key={exam.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{exam.title}</p>
                  <p className="text-sm text-gray-500">{exam.description}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[exam.status]}`}>
                    {statusLabels[exam.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{exam.duration_minutes} dk</td>
                <td className="px-6 py-4 text-sm text-gray-600">{exam.question_count || 0}</td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/instructor/exams/${exam.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Düzenle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
