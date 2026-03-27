/**
 * SmartProctor - Öğrenci Sınav Geçmişi
 */

import { useState, useEffect } from 'react'
import { sessionAPI } from '../../services/api'
import { History, CheckCircle, XCircle, Clock } from 'lucide-react'

export default function StudentHistory() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sessionAPI.mySessions()
      .then((res) => setSessions(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  const statusLabels = {
    started: 'Başlatıldı', in_progress: 'Devam Ediyor',
    submitted: 'Tamamlandı', timed_out: 'Süre Doldu', terminated: 'Sonlandırıldı',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <History className="text-blue-600" /> Sınav Geçmişim
      </h1>

      {sessions.length === 0 ? (
        <p className="text-center py-20 text-gray-500">Henüz sınav geçmişiniz yok.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sınav</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sekme Değişimi</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.exam_title || `Sınav #${s.exam_id}`}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.status === 'submitted' ? 'bg-green-100 text-green-700' :
                      s.status === 'terminated' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {s.status === 'submitted' ? <CheckCircle size={12} /> :
                       s.status === 'terminated' ? <XCircle size={12} /> :
                       <Clock size={12} />}
                      {statusLabels[s.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.tab_switch_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(s.started_at).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
