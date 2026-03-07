/**
 * SmartProctor - Gözetmen İnceleme Paneli
 * Çift kör doğrulama: Öğrenci isimleri gizli, sadece ID ve ihlal videosu gösterilir.
 */

import { useState, useEffect } from 'react'
import { violationAPI } from '../../services/api'
import { Eye, CheckCircle, XCircle, AlertTriangle, Video, RefreshCw } from 'lucide-react'

export default function ProctorDashboard() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeReview, setActiveReview] = useState(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReviews = () => {
    setLoading(true)
    violationAPI.pendingReviews()
      .then((res) => setReviews(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReviews() }, [])

  const handleDecision = async (violationId, decision) => {
    setSubmitting(true)
    try {
      await violationAPI.submitReview(violationId, { decision, comment })
      setActiveReview(null)
      setComment('')
      fetchReviews()
    } catch (err) {
      alert(err.response?.data?.detail || 'Hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  const violationLabels = {
    TAB_SWITCH: 'Sekme Değişikliği',
    FULLSCREEN_EXIT: 'Tam Ekran Çıkışı',
    COPY_PASTE: 'Kopyala/Yapıştır',
    RIGHT_CLICK: 'Sağ Tık',
    DEVTOOLS: 'Geliştirici Araçları',
    GAZE_LEFT: 'Sola Bakış',
    GAZE_RIGHT: 'Sağa Bakış',
    PHONE_DETECTED: 'Telefon Tespiti',
    MULTIPLE_PERSONS: 'Birden Fazla Kişi',
    OTHER: 'Diğer',
  }

  const violationColors = {
    TAB_SWITCH: 'bg-yellow-100 text-yellow-800',
    PHONE_DETECTED: 'bg-red-100 text-red-800',
    MULTIPLE_PERSONS: 'bg-red-100 text-red-800',
    GAZE_LEFT: 'bg-orange-100 text-orange-800',
    GAZE_RIGHT: 'bg-orange-100 text-orange-800',
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İhlal İncelemeleri</h1>
          <p className="text-gray-500 mt-1">Çift kör doğrulama - Öğrenci kimlikleri gizlidir</p>
        </div>
        <button onClick={fetchReviews}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
          <RefreshCw size={16} /> Yenile
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <CheckCircle className="mx-auto mb-4 text-green-300" size={48} />
          <p>Bekleyen inceleme yok. Tebrikler!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((v) => (
            <div key={v.id} className={`bg-white rounded-xl shadow-sm border p-6 transition ${
              activeReview === v.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                    violationColors[v.violation_type] || 'bg-gray-100 text-gray-700'
                  }`}>
                    {violationLabels[v.violation_type] || v.violation_type}
                  </span>
                  <p className="text-sm text-gray-500 mt-2">
                    İhlal ID: #{v.id} | Oturum: #{v.session_id}
                  </p>
                </div>
                {v.confidence && (
                  <span className="text-sm font-mono text-gray-500">
                    %{(v.confidence * 100).toFixed(0)} güven
                  </span>
                )}
              </div>

              {/* Video Kanıtı */}
              {v.video_path ? (
                <div className="mb-4 bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    src={v.video_path}
                    controls
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              ) : (
                <div className="mb-4 bg-gray-100 rounded-lg p-6 text-center text-gray-400">
                  <Video className="mx-auto mb-2" size={24} />
                  <p className="text-sm">Video kanıtı yok</p>
                </div>
              )}

              <p className="text-xs text-gray-400 mb-4">
                Tespit: {new Date(v.detected_at).toLocaleString('tr-TR')}
              </p>

              {activeReview === v.id ? (
                <div className="space-y-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Yorum (opsiyonel)"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={2}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDecision(v.id, 'violation_confirmed')}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                    >
                      <AlertTriangle size={16} /> İhlal Var
                    </button>
                    <button
                      onClick={() => handleDecision(v.id, 'no_violation')}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                    >
                      <CheckCircle size={16} /> İhlal Yok
                    </button>
                  </div>
                  <button onClick={() => { setActiveReview(null); setComment('') }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700">
                    İptal
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveReview(v.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Eye size={16} /> İncele ve Karar Ver
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
