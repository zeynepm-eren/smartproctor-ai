import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { examAPI } from '../../services/api'
import { ArrowLeft, Plus, Trash2, Save, CheckCircle, Play, Pause, BarChart3 } from 'lucide-react'

export default function ExamEdit() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newQuestion, setNewQuestion] = useState(null)

  useEffect(() => {
    Promise.all([examAPI.get(examId), examAPI.listQuestions(examId)])
      .then(([examRes, qRes]) => { setExam(examRes.data); setQuestions(qRes.data) })
      .finally(() => setLoading(false))
  }, [examId])

  const saveExam = async () => {
    setSaving(true)
    try {
      await examAPI.update(examId, {
        title: exam.title, description: exam.description,
        duration_minutes: exam.duration_minutes, pass_score: exam.pass_score,
        shuffle_questions: exam.shuffle_questions, shuffle_options: exam.shuffle_options,
      })
      alert('Sınav güncellendi!')
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
    finally { setSaving(false) }
  }

  const deleteExam = async () => {
    if (!confirm('Bu sınavı silmek istediğinize emin misiniz? Tüm sorular ve oturumlar da silinecek.')) return
    try {
      await examAPI.delete(examId)
      alert('Sınav silindi!')
      navigate('/instructor/exams')
    } catch (err) { alert(err.response?.data?.detail || 'Silinemedi') }
  }

  const changeStatus = async (status) => {
    try {
      const res = await examAPI.update(examId, { status })
      setExam({ ...exam, status: res.data.status })
    } catch (err) { alert(err.response?.data?.detail || 'Durum değiştirilemedi') }
  }

  const deleteQuestion = async (questionId) => {
    if (!confirm('Bu soruyu silmek istediğinize emin misiniz?')) return
    try {
      await examAPI.deleteQuestion(examId, questionId)
      setQuestions(questions.filter(q => q.id !== questionId))
    } catch (err) { alert(err.response?.data?.detail || 'Silinemedi') }
  }

  const initNewQuestion = () => setNewQuestion({
    question_type: 'multiple_choice', body: '', points: 10, sort_order: questions.length + 1, explanation: '',
    options: [{ body: '', is_correct: false, sort_order: 1 }, { body: '', is_correct: false, sort_order: 2 },
              { body: '', is_correct: true, sort_order: 3 }, { body: '', is_correct: false, sort_order: 4 }],
  })

  const saveNewQuestion = async () => {
    if (!newQuestion.body) return alert('Soru metni boş olamaz')
    try {
      const res = await examAPI.addQuestion(examId, newQuestion)
      setQuestions([...questions, res.data])
      setNewQuestion(null)
    } catch (err) { alert(err.response?.data?.detail || 'Soru eklenemedi') }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  if (!exam) return <p className="text-center py-20 text-gray-500">Sınav bulunamadı</p>

  const statusColors = { draft: 'bg-gray-100 text-gray-700', scheduled: 'bg-yellow-100 text-yellow-700', active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700' }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/instructor/exams')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"><ArrowLeft size={20} /> Sınavlara Dön</button>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sınav Bilgileri</h2>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[exam.status] || 'bg-gray-100'}`}>{exam.status}</span>
            {exam.status === 'draft' && <button onClick={() => changeStatus('active')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"><Play size={14} /> Aktif Yap</button>}
            {exam.status === 'active' && <button onClick={() => changeStatus('completed')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-medium hover:bg-gray-700"><Pause size={14} /> Tamamla</button>}
            <button onClick={() => navigate(`/instructor/exams/${examId}/stats`)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"><BarChart3 size={14} /> Sonuçlar</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label><input value={exam.title} onChange={(e) => setExam({...exam, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label><textarea value={exam.description || ''} onChange={(e) => setExam({...exam, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Süre (dk)</label><input type="number" value={exam.duration_minutes} onChange={(e) => setExam({...exam, duration_minutes: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Geçme Puanı (%)</label><input type="number" value={exam.pass_score || ''} onChange={(e) => setExam({...exam, pass_score: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={saveExam} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"><Save size={16} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          <button onClick={deleteExam} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"><Trash2 size={16} /> Sınavı Sil</button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sorular ({questions.length})</h2>
          <button onClick={initNewQuestion} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Plus size={18} /> Soru Ekle</button>
        </div>
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border p-5 mb-3">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-gray-900">Soru {idx + 1} ({q.points} puan)</h4>
              <button onClick={() => deleteQuestion(q.id)} className="text-red-400 hover:text-red-600" title="Soruyu sil"><Trash2 size={16} /></button>
            </div>
            <p className="text-gray-700 mb-3">{q.body}</p>
            <div className="space-y-1">
              {q.options?.map((opt) => (
                <div key={opt.id} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded ${opt.is_correct ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600'}`}>
                  {opt.is_correct ? <CheckCircle size={14} className="text-green-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                  {opt.body}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {newQuestion && (
        <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-4">Yeni Soru</h3>
          <textarea value={newQuestion.body} onChange={(e) => setNewQuestion({...newQuestion, body: e.target.value})} placeholder="Soru metni..." className="w-full px-3 py-2 border rounded-lg mb-3" rows={2} />
          <div className="space-y-2 mb-4">
            {newQuestion.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-3">
                <input type="radio" name="new-correct" checked={opt.is_correct} onChange={() => {
                  const opts = newQuestion.options.map((o, i) => ({...o, is_correct: i === oIdx}))
                  setNewQuestion({...newQuestion, options: opts})
                }} />
                <input value={opt.body} placeholder={`Seçenek ${String.fromCharCode(65+oIdx)}`} onChange={(e) => {
                  const opts = [...newQuestion.options]; opts[oIdx] = {...opts[oIdx], body: e.target.value}
                  setNewQuestion({...newQuestion, options: opts})
                }} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={saveNewQuestion} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Kaydet</button>
            <button onClick={() => setNewQuestion(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">İptal</button>
          </div>
        </div>
      )}
    </div>
  )
}
