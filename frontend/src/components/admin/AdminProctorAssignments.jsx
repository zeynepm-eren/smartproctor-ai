import { useState, useEffect } from 'react'
import { adminAPI, authAPI } from '../../services/api'
import { Shield, BookOpen, RefreshCw, AlertTriangle, Plus, Trash2, X, ArrowRightLeft } from 'lucide-react'

export default function AdminProctorAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Ekleme modalı
  const [showAddModal, setShowAddModal] = useState(false)
  const [addExamId, setAddExamId] = useState(null)
  const [addProctors, setAddProctors] = useState([])
  const [addSelectedId, setAddSelectedId] = useState('')
  const [adding, setAdding] = useState(false)

  // Değiştirme modalı
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapExamId, setSwapExamId] = useState(null)
  const [swapOldProctor, setSwapOldProctor] = useState(null)
  const [swapProctors, setSwapProctors] = useState([])
  const [swapSelectedId, setSwapSelectedId] = useState('')
  const [swapping, setSwapping] = useState(false)

  const fetchAssignments = () => {
    setLoading(true)
    setError(null)
    adminAPI.getProctorAssignments()
      .then(res => setAssignments(res.data))
      .catch(() => setError('Veriler yüklenirken hata oluştu'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssignments() }, [])

  const grouped = assignments.reduce((acc, a) => {
    const key = a.exam_id
    if (!acc[key]) {
      acc[key] = { exam_id: a.exam_id, exam_title: a.exam_title, course_name: a.course_name, course_code: a.course_code, proctors: [] }
    }
    acc[key].proctors.push({ id: a.proctor_id, name: a.proctor_name, email: a.proctor_email, assigned_at: a.assigned_at })
    return acc
  }, {})

  // Gözetmen Ekleme
  const openAddModal = (examId) => {
    setAddExamId(examId)
    setAddSelectedId('')
    setShowAddModal(true)
    authAPI.getProctors().then(res => {
      const assignedIds = (grouped[examId]?.proctors || []).map(p => p.id)
      setAddProctors(res.data.filter(p => !assignedIds.includes(p.id)))
    })
  }

  const handleAdd = async () => {
    if (!addSelectedId) return
    setAdding(true)
    try {
      await adminAPI.addProctorAssignment(addExamId, Number(addSelectedId))
      setShowAddModal(false)
      fetchAssignments()
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
    finally { setAdding(false) }
  }

  // Gözetmen Çıkarma
  const handleRemove = async (examId, proctorId, proctorName) => {
    if (!confirm(`${proctorName} gözetmenini bu sınavdan çıkarmak istediğinize emin misiniz?\n\nDikkat: Bekleyen ihlal incelemeleri kaybolabilir. "Değiştir" seçeneğini kullanarak incelemeleri aktarabilirsiniz.`)) return
    try {
      await adminAPI.removeProctorAssignment(examId, proctorId)
      fetchAssignments()
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
  }

  // Gözetmen Değiştirme (ihlal incelemeleri aktarılır)
  const openSwapModal = (examId, proctor) => {
    setSwapExamId(examId)
    setSwapOldProctor(proctor)
    setSwapSelectedId('')
    setShowSwapModal(true)
    authAPI.getProctors().then(res => {
      const assignedIds = (grouped[examId]?.proctors || []).map(p => p.id)
      setSwapProctors(res.data.filter(p => !assignedIds.includes(p.id)))
    })
  }

  const handleSwap = async () => {
    if (!swapSelectedId) return
    setSwapping(true)
    try {
      const res = await adminAPI.swapProctor(swapExamId, swapOldProctor.id, Number(swapSelectedId))
      setShowSwapModal(false)
      fetchAssignments()
      const msg = res.data.transferred_reviews > 0
        ? `Gözetmen değiştirildi! ${res.data.transferred_reviews} bekleyen inceleme yeni gözetmene aktarıldı.`
        : 'Gözetmen değiştirildi! Aktarılacak bekleyen inceleme yoktu.'
      alert(msg)
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
    finally { setSwapping(false) }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gözetmen Atamaları</h1>
          <p className="text-gray-500 mt-1">Gözetmen ekleyin, çıkarın veya değiştirin — incelemeler otomatik aktarılır</p>
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
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {exam.proctors.length} gözetmen
                  </span>
                  <button onClick={() => openAddModal(exam.exam_id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium">
                    <Plus size={14} /> Ekle
                  </button>
                </div>
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
                      <p className="text-xs text-gray-400">{new Date(p.assigned_at).toLocaleDateString('tr-TR')}</p>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => openSwapModal(exam.exam_id, p)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-xs font-medium"
                        title="Gözetmeni değiştir (incelemeler aktarılır)"
                      >
                        <ArrowRightLeft size={14} /> Değiştir
                      </button>
                      <button
                        onClick={() => handleRemove(exam.exam_id, p.id, p.name)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-medium"
                      >
                        <Trash2 size={14} /> Çıkar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gözetmen Ekleme Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Gözetmen Ekle</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Sınava atanacak gözetmeni seçin</p>
            {addProctors.length === 0 ? (
              <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">Atanabilecek gözetmen bulunmuyor.</p>
            ) : (
              <>
                <select value={addSelectedId} onChange={(e) => setAddSelectedId(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-4">
                  <option value="">Gözetmen seçin...</option>
                  {addProctors.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.email}</option>)}
                </select>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">İptal</button>
                  <button onClick={handleAdd} disabled={!addSelectedId || adding} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
                    {adding ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Gözetmen Değiştirme Modalı */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Gözetmen Değiştir</h3>
              <button onClick={() => setShowSwapModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>{swapOldProctor?.name}</strong> gözetmeninin bekleyen ihlal incelemeleri seçeceğiniz yeni gözetmene otomatik olarak aktarılacaktır.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mevcut Gözetmen</label>
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-semibold text-sm">
                  {swapOldProctor?.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{swapOldProctor?.name}</p>
                  <p className="text-xs text-gray-500">{swapOldProctor?.email}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-4">
              <ArrowRightLeft size={20} className="text-amber-500" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Yeni Gözetmen</label>
              {swapProctors.length === 0 ? (
                <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">Atanabilecek başka gözetmen bulunmuyor.</p>
              ) : (
                <select value={swapSelectedId} onChange={(e) => setSwapSelectedId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Yeni gözetmen seçin...</option>
                  {swapProctors.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.email}</option>)}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSwapModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">İptal</button>
              <button
                onClick={handleSwap}
                disabled={!swapSelectedId || swapping}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
              >
                {swapping ? 'Değiştiriliyor...' : 'Değiştir ve Aktar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
