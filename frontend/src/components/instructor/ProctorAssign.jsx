/**
 * SmartProctor - Gözetmen Atama Sayfası
 * Eğitmen sınavlara gözetmen atar.
 */

import { useState, useEffect } from 'react'
import { examAPI } from '../../services/api'
import api from '../../services/api'
import { UserPlus, Shield, Check } from 'lucide-react'

export default function ProctorAssign() {
  const [exams, setExams] = useState([])
  const [proctors, setProctors] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedProctor, setSelectedProctor] = useState('')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      examAPI.list(),
      api.get('/auth/users?role=proctor').catch(() => ({ data: [] })),
    ]).then(([examRes, proctorRes]) => {
      setExams(examRes.data)
      setProctors(proctorRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleAssign = async () => {
    if (!selectedExam || !selectedProctor) return
    try {
      await api.post(`/exams/${selectedExam}/assign-proctor`, { proctor_id: Number(selectedProctor) })
      setMessage('Gözetmen başarıyla atandı!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Atama başarısız')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <Shield className="text-purple-600" /> Gözetmen Atama
      </h1>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('başarı') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sınav Seçin</label>
            <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">-- Sınav Seçin --</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.status})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gözetmen Seçin</label>
            <select value={selectedProctor} onChange={(e) => setSelectedProctor(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">-- Gözetmen Seçin --</option>
              {proctors.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.email})</option>)}
            </select>
          </div>

          <button onClick={handleAssign} disabled={!selectedExam || !selectedProctor}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 transition">
            <UserPlus size={18} /> Gözetmen Ata
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">
            Mevcut gözetmen atamaları veritabanında (proctor_assignments) kayıtlıdır.
            Her sınava en fazla 2 gözetmen atanması önerilir (çift kör doğrulama için).
          </p>
        </div>
      </div>
    </div>
  )
}
