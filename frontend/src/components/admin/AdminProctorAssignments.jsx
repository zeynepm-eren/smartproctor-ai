import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import { Shield, BookOpen, RefreshCw, AlertTriangle } from 'lucide-react'

export default function AdminProctorAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAssignments = () => {
    setLoading(true)
    setError(null)
    adminAPI.getProctorAssignments()
      .then(res => setAssignments(res.data))
      .catch(() => setError('Veriler yüklenirken hata oluştu'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssignments() }, [])

  // Sınav bazlı gruplandır
  const grouped = assignments.reduce((acc, a) => {
    const key = a.exam_id
    if (!acc[key]) {
      acc[key] = {
        exam_id: a.exam_id,
        exam_title: a.exam_title,
        course_name: a.course_name,
        course_code: a.course_code,
        proctors: [],
      }
    }
    acc[key].proctors.push({
      id: a.proctor_id,
      name: a.proctor_name,
      email: a.proctor_email,
      assigned_at: a.assigned_at,
    })
    return acc
  }, {})

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gözetmen Atamaları</h1>
          <p className="text-gray-500 mt-1">Sınavlara atanan gözetmenler</p>
        </div>
        <button onClick={fetchAssignments} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
          <RefreshCw size={16} /> Yenile
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-white rounded-xl border">
          <Shield className="mx-auto mb-4 text-gray-300" size={48} />
          <p>Henüz gözetmen ataması yok.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(grouped).map((exam) => (
            <div key={exam.exam_id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{exam.exam_title}</h2>
                  <p className="text-sm text-gray-500">{exam.course_code} - {exam.course_name}</p>
                </div>
                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {exam.proctors.length} gözetmen
                </span>
              </div>
              <div className="divide-y">
                {exam.proctors.map((p) => (
                  <div key={p.id} className="p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.email}</p>
                    </div>
                    {p.assigned_at && (
                      <p className="ml-auto text-xs text-gray-400">
                        {new Date(p.assigned_at).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
