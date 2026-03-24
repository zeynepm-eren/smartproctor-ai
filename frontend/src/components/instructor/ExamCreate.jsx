import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseAPI, examAPI } from '../../services/api'
import { Plus, Trash2, Save, ArrowLeft, Calendar, Clock } from 'lucide-react'

export default function ExamCreate() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [examForm, setExamForm] = useState({
    course_id: '', title: '', description: '', duration_minutes: 60,
    pass_score: 50, shuffle_questions: false, shuffle_options: false,
    start_time: '', end_time: '',
  })
  const [questions, setQuestions] = useState([])

  useEffect(() => {
    courseAPI.list().then((res) => {
      setCourses(res.data)
      if (res.data.length > 0) setExamForm(f => ({ ...f, course_id: res.data[0].id }))
    })
  }, [])

  useEffect(() => {
    const now = new Date(); now.setHours(now.getHours() + 1); now.setMinutes(0, 0, 0)
    const end = new Date(now); end.setHours(end.getHours() + 2)
    const fmt = (d) => d.toISOString().slice(0, 16)
    setExamForm(f => ({ ...f, start_time: fmt(now), end_time: fmt(end) }))
  }, [])

  const addQuestion = () => setQuestions([...questions, {
    question_type: 'multiple_choice', body: '', points: 10, sort_order: questions.length + 1, explanation: '',
    options: [{ body: '', is_correct: false, sort_order: 1 }, { body: '', is_correct: false, sort_order: 2 },
              { body: '', is_correct: false, sort_order: 3 }, { body: '', is_correct: false, sort_order: 4 }],
  }])
  const removeQuestion = (idx) => setQuestions(questions.filter((_, i) => i !== idx))
  const updateQuestion = (idx, field, value) => { const u = [...questions]; u[idx][field] = value; setQuestions(u) }
  const updateOption = (qIdx, oIdx, field, value) => {
    const u = [...questions]
    if (field === 'is_correct') u[qIdx].options.forEach((o, i) => { o.is_correct = i === oIdx })
    else u[qIdx].options[oIdx][field] = value
    setQuestions(u)
  }

  const handleSubmit = async () => {
    if (!examForm.start_time || !examForm.end_time) { alert('Başlangıç/bitiş zamanı zorunlu!'); return }
    if (new Date(examForm.start_time) >= new Date(examForm.end_time)) { alert('Bitiş > başlangıç olmalı!'); return }
    if (questions.length === 0) { alert('En az bir soru ekleyin!'); return }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].options.some(o => o.is_correct)) { alert(`Soru ${i+1}: doğru cevap seçin!`); return }
      if (!questions[i].body.trim()) { alert(`Soru ${i+1} boş olamaz!`); return }
    }
    setLoading(true)
    try {
      const d = { ...examForm, course_id: Number(examForm.course_id), start_time: new Date(examForm.start_time).toISOString(), end_time: new Date(examForm.end_time).toISOString() }
      const r = await examAPI.create(d)
      for (const q of questions) await examAPI.addQuestion(r.data.id, q)
      alert('Sınav oluşturuldu! 2 gözetmen otomatik atandı.')
      navigate('/instructor/exams')
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"><ArrowLeft size={20} /> Geri</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Yeni Sınav Oluştur</h1>
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Sınav Bilgileri</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ders</label>
            <select value={examForm.course_id} onChange={(e) => setExamForm({...examForm, course_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg">{courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}</select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
            <input value={examForm.title} onChange={(e) => setExamForm({...examForm, title: e.target.value})} placeholder="Örn: Vize Sınavı" className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea value={examForm.description} onChange={(e) => setExamForm({...examForm, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1"><Calendar size={14} className="inline mr-1"/>Başlangıç</label><input type="datetime-local" value={examForm.start_time} onChange={(e) => setExamForm({...examForm, start_time: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1"><Calendar size={14} className="inline mr-1"/>Bitiş</label><input type="datetime-local" value={examForm.end_time} onChange={(e) => setExamForm({...examForm, end_time: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1"><Clock size={14} className="inline mr-1"/>Süre (dk)</label><input type="number" value={examForm.duration_minutes} min={1} onChange={(e) => setExamForm({...examForm, duration_minutes: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Geçme Puanı (%)</label><input type="number" value={examForm.pass_score} min={0} max={100} onChange={(e) => setExamForm({...examForm, pass_score: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={examForm.shuffle_questions} onChange={(e) => setExamForm({...examForm, shuffle_questions: e.target.checked})} className="rounded" /> Soruları Karıştır</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={examForm.shuffle_options} onChange={(e) => setExamForm({...examForm, shuffle_options: e.target.checked})} className="rounded" /> Seçenekleri Karıştır</label>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">Sınava otomatik olarak 2 rastgele gözetmen atanacaktır.</div>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sorular ({questions.length})</h2>
          <button onClick={addQuestion} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Plus size={18} /> Soru Ekle</button>
        </div>
        {questions.length === 0 && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-yellow-700">Henüz soru eklenmedi.</div>}
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="bg-white rounded-xl shadow-sm border p-6 mb-4">
            <div className="flex items-start justify-between mb-4"><h3 className="font-medium">Soru {qIdx + 1}</h3><button onClick={() => removeQuestion(qIdx)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button></div>
            <div className="flex gap-4 mb-4">
              <textarea value={q.body} onChange={(e) => updateQuestion(qIdx, 'body', e.target.value)} placeholder="Soru metni..." className="flex-1 px-3 py-2 border rounded-lg" rows={2} />
              <div className="w-24"><label className="block text-sm font-medium mb-1">Puan</label><input type="number" value={q.points} min={1} onChange={(e) => updateQuestion(qIdx, 'points', Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" /></div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Seçenekler</label>
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-3 mb-2">
                <input type="radio" name={`correct-${qIdx}`} checked={opt.is_correct} onChange={() => updateOption(qIdx, oIdx, 'is_correct', true)} className="w-4 h-4" />
                <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm font-medium">{String.fromCharCode(65+oIdx)}</span>
                <input value={opt.body} onChange={(e) => updateOption(qIdx, oIdx, 'body', e.target.value)} placeholder={`Seçenek ${String.fromCharCode(65+oIdx)}`} className={`flex-1 px-3 py-2 border rounded-lg text-sm ${opt.is_correct ? 'border-green-500 bg-green-50' : ''}`} />
                {opt.is_correct && <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded">Doğru</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={loading || !examForm.title || questions.length === 0} className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
        <Save size={20} /> {loading ? 'Kaydediliyor...' : 'Sınavı Oluştur'}
      </button>
    </div>
  )
}
