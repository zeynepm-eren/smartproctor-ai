/**
 * SmartProctor - Sınav Oluşturma Formu
 * Eğitmen sınav ve soru ekler.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseAPI, examAPI } from '../../services/api'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'

export default function ExamCreate() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)

  const [examForm, setExamForm] = useState({
    course_id: '', title: '', description: '',
    duration_minutes: 60, pass_score: 50,
    shuffle_questions: false, shuffle_options: false, max_tab_switches: 3,
  })

  const [questions, setQuestions] = useState([])

  useEffect(() => {
    courseAPI.list().then((res) => {
      setCourses(res.data)
      if (res.data.length > 0) setExamForm(f => ({ ...f, course_id: res.data[0].id }))
    })
  }, [])

  const addQuestion = () => {
    setQuestions([...questions, {
      question_type: 'multiple_choice', body: '', points: 10, sort_order: questions.length + 1,
      explanation: '',
      options: [
        { body: '', is_correct: false, sort_order: 1 },
        { body: '', is_correct: false, sort_order: 2 },
        { body: '', is_correct: false, sort_order: 3 },
        { body: '', is_correct: false, sort_order: 4 },
      ],
    }])
  }

  const removeQuestion = (idx) => setQuestions(questions.filter((_, i) => i !== idx))

  const updateQuestion = (idx, field, value) => {
    const updated = [...questions]
    updated[idx][field] = value
    setQuestions(updated)
  }

  const updateOption = (qIdx, oIdx, field, value) => {
    const updated = [...questions]
    if (field === 'is_correct') {
      // Sadece bir doğru cevap olabilir
      updated[qIdx].options.forEach((o, i) => { o.is_correct = i === oIdx })
    } else {
      updated[qIdx].options[oIdx][field] = value
    }
    setQuestions(updated)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Sınavı oluştur
      const examRes = await examAPI.create({
        ...examForm,
        course_id: Number(examForm.course_id),
      })
      const examId = examRes.data.id

      // Soruları ekle
      for (const q of questions) {
        await examAPI.addQuestion(examId, q)
      }

      navigate('/instructor/exams')
    } catch (err) {
      alert(err.response?.data?.detail || 'Hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft size={20} /> Geri
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Yeni Sınav Oluştur</h1>

      {/* Sınav Bilgileri */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Sınav Bilgileri</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ders</label>
            <select value={examForm.course_id} onChange={(e) => setExamForm({ ...examForm, course_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
            <input value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Süre (dk)</label>
            <input type="number" value={examForm.duration_minutes} min={1}
              onChange={(e) => setExamForm({ ...examForm, duration_minutes: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geçme Puanı (%)</label>
            <input type="number" value={examForm.pass_score} min={0} max={100}
              onChange={(e) => setExamForm({ ...examForm, pass_score: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maks. Sekme Değişimi</label>
            <input type="number" value={examForm.max_tab_switches} min={0}
              onChange={(e) => setExamForm({ ...examForm, max_tab_switches: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={examForm.shuffle_questions}
                onChange={(e) => setExamForm({ ...examForm, shuffle_questions: e.target.checked })}
                className="rounded border-gray-300" />
              Soruları Karıştır
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={examForm.shuffle_options}
                onChange={(e) => setExamForm({ ...examForm, shuffle_options: e.target.checked })}
                className="rounded border-gray-300" />
              Seçenekleri Karıştır
            </label>
          </div>
        </div>
      </div>

      {/* Sorular */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sorular ({questions.length})</h2>
          <button onClick={addQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Plus size={18} /> Soru Ekle
          </button>
        </div>

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="bg-white rounded-xl shadow-sm border p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-medium text-gray-900">Soru {qIdx + 1}</h3>
              <button onClick={() => removeQuestion(qIdx)} className="text-red-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni</label>
                  <textarea value={q.body} onChange={(e) => updateQuestion(qIdx, 'body', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={2} />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puan</label>
                  <input type="number" value={q.points} min={1}
                    onChange={(e) => updateQuestion(qIdx, 'points', Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Seçenekler</label>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-3 mb-2">
                    <input
                      type="radio"
                      name={`correct-${qIdx}`}
                      checked={opt.is_correct}
                      onChange={() => updateOption(qIdx, oIdx, 'is_correct', true)}
                      className="text-blue-600"
                    />
                    <input
                      value={opt.body}
                      onChange={(e) => updateOption(qIdx, oIdx, 'body', e.target.value)}
                      placeholder={`Seçenek ${String.fromCharCode(65 + oIdx)}`}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                    {opt.is_correct && (
                      <span className="text-xs text-green-600 font-medium">Doğru</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Kaydet */}
      <button onClick={handleSubmit} disabled={loading || !examForm.title}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
        <Save size={20} /> {loading ? 'Kaydediliyor...' : 'Sınavı Oluştur'}
      </button>
    </div>
  )
}
