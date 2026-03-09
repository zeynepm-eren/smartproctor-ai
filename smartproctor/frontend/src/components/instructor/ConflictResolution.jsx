/**
 * SmartProctor - Uyuşmazlık Çözümü Sayfası
 * İki gözetmen uyuşamadığında eğitmen nihai kararı verir.
 */

import { useState, useEffect } from 'react'
import { violationAPI } from '../../services/api'
import { Scale, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function ConflictResolution() {
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchConflicts = () => {
    setLoading(true)
    violationAPI.listConflicts()
      .then((res) => setConflicts(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchConflicts() }, [])

  const handleResolve = async (violationId, decision) => {
    setSubmitting(true)
    try {
      await violationAPI.resolveConflict(violationId, {
        final_decision: decision,
        comment,
      })
      setComment('')
      fetchConflicts()
    } catch (err) {
      alert(err.response?.data?.detail || 'Hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Scale className="text-purple-600" /> Uyuşmazlık Çözümü
        </h1>
        <p className="text-gray-500 mt-1">Gözetmenler arasında uyuşmazlık olan ihlaller</p>
      </div>

      {conflicts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <CheckCircle className="mx-auto mb-4 text-green-300" size={48} />
          <p>Bekleyen uyuşmazlık yok.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-yellow-500" size={20} />
                <span className="font-medium text-gray-900">İhlal #{c.violation_id}</span>
                <span className="text-sm text-gray-500">
                  Gözetmenler uyuşamadı - Nihai karar sizden bekleniyor
                </span>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Kararınızın gerekçesi (opsiyonel)"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                rows={2}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => handleResolve(c.violation_id, 'violation_confirmed')}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  <XCircle size={16} /> İhlal Onaylandı
                </button>
                <button
                  onClick={() => handleResolve(c.violation_id, 'no_violation')}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                >
                  <CheckCircle size={16} /> İhlal Yok
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
