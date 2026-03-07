/**
 * SmartProctor - Eğitmen Sınav Listesi
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { examAPI } from '../../services/api'
import { Plus, FileText } from 'lucide-react'

export default function InstructorExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    examAPI.list().then((res) => setExams(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sınavlar</h1>
        <Link to="/instructor/exams/create"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={18} /> Yeni Sınav
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FileText className="mx-auto mb-4 text-gray-300" size={48} />
          <p>Henüz sınav oluşturmadınız.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition">
              <h3 className="font-semibold text-gray-900 mb-1">{exam.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{exam.description}</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Süre: {exam.duration_minutes} dk | Soru: {exam.question_count || 0}</p>
                <p>Durum: {exam.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
