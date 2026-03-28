import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseAPI, examAPI } from '../../services/api'
import { Plus, Trash2, Save, ArrowLeft, Calendar, Clock, Upload, FileText, Image, Download } from 'lucide-react'

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Test (Çoktan Seçmeli)' },
  { value: 'open_ended', label: 'Klasik (Açık Uçlu)' },
]

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
  const [xmlUploading, setXmlUploading] = useState(false)
  const xmlInputRef = useRef(null)
  const imageInputRefs = useRef({})

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

  const addQuestion = (type = 'multiple_choice') => {
    const base = {
      question_type: type, body: '', points: 10, sort_order: questions.length + 1,
      explanation: '', image_url: null, image_preview: null,
    }
    if (type === 'open_ended') {
      setQuestions([...questions, { ...base, options: [] }])
    } else {
      setQuestions([...questions, {
        ...base,
        options: [
          { body: '', is_correct: false, sort_order: 1 }, { body: '', is_correct: false, sort_order: 2 },
          { body: '', is_correct: false, sort_order: 3 }, { body: '', is_correct: false, sort_order: 4 },
        ],
      }])
    }
  }

  const removeQuestion = (idx) => setQuestions(questions.filter((_, i) => i !== idx))

  const updateQuestion = (idx, field, value) => {
    const u = [...questions]
    if (field === 'question_type') {
      u[idx].question_type = value
      if (value === 'open_ended') {
        u[idx].options = []
      } else if (u[idx].options.length === 0) {
        u[idx].options = [
          { body: '', is_correct: false, sort_order: 1 }, { body: '', is_correct: false, sort_order: 2 },
          { body: '', is_correct: false, sort_order: 3 }, { body: '', is_correct: false, sort_order: 4 },
        ]
      }
    } else {
      u[idx][field] = value
    }
    setQuestions(u)
  }

  const updateOption = (qIdx, oIdx, field, value) => {
    const u = [...questions]
    if (field === 'is_correct') u[qIdx].options.forEach((o, i) => { o.is_correct = i === oIdx })
    else u[qIdx].options[oIdx][field] = value
    setQuestions(u)
  }

  const handleImageSelect = (qIdx, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const u = [...questions]
    u[qIdx].image_file = file
    u[qIdx].image_preview = URL.createObjectURL(file)
    setQuestions(u)
    e.target.value = ''
  }

  const removeImage = (qIdx) => {
    const u = [...questions]
    u[qIdx].image_file = null
    u[qIdx].image_preview = null
    u[qIdx].image_url = null
    setQuestions(u)
  }

  // XML'den soruları yükle
  const handleXmlUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xml')) { alert('Sadece .xml dosyası yüklenebilir!'); return }
    setXmlUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parser = new DOMParser()
        const xml = parser.parseFromString(ev.target.result, 'text/xml')
        const parseError = xml.querySelector('parsererror')
        if (parseError) { alert('XML parse hatası: ' + parseError.textContent); return }
        const qElems = xml.querySelectorAll('question')
        if (qElems.length === 0) { alert('XML dosyasında soru bulunamadı!'); return }
        const newQuestions = []
        qElems.forEach((qEl, idx) => {
          const qType = qEl.getAttribute('type') || 'multiple_choice'
          const body = qEl.querySelector('body')?.textContent?.trim() || ''
          const points = parseFloat(qEl.getAttribute('points') || '10')
          const explanation = qEl.querySelector('explanation')?.textContent?.trim() || ''

          // Görsel
          let image_url = null
          let image_preview = null
          const imageEl = qEl.querySelector('image')
          if (imageEl?.textContent?.trim()) {
            const imgData = imageEl.textContent.trim()
            image_url = imgData
            image_preview = imgData  // base64 veya URL doğrudan preview olarak gösterilir
          }

          const optElems = qEl.querySelectorAll('options > option')
          const options = []
          optElems.forEach((optEl, oIdx) => {
            options.push({
              body: optEl.textContent?.trim() || '',
              is_correct: optEl.getAttribute('correct') === 'true',
              sort_order: oIdx + 1,
            })
          })

          // Test soruları için en az 4 seçenek
          if (qType !== 'open_ended') {
            while (options.length < 4) options.push({ body: '', is_correct: false, sort_order: options.length + 1 })
          }

          newQuestions.push({
            question_type: qType, body, points, sort_order: questions.length + idx + 1,
            explanation, options, image_url, image_preview, image_file: null,
          })
        })
        setQuestions(prev => [...prev, ...newQuestions])
        alert(`${newQuestions.length} soru XML'den başarıyla yüklendi!`)
      } catch (err) { alert('XML işleme hatası: ' + err.message) }
      finally { setXmlUploading(false) }
    }
    reader.onerror = () => { alert('Dosya okunamadı!'); setXmlUploading(false) }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Mevcut soruları XML olarak indir
  const handleXmlExport = () => {
    if (questions.length === 0) { alert('İndirilecek soru yok!'); return }
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<questions>\n'
    questions.forEach(q => {
      xml += `  <question type="${q.question_type}" points="${q.points}">\n`
      xml += `    <body>${escapeXml(q.body)}</body>\n`
      if (q.image_url || q.image_preview) {
        xml += `    <image>${escapeXml(q.image_url || q.image_preview)}</image>\n`
      }
      if (q.explanation) xml += `    <explanation>${escapeXml(q.explanation)}</explanation>\n`
      if (q.options.length > 0) {
        xml += '    <options>\n'
        q.options.forEach(o => {
          xml += `      <option${o.is_correct ? ' correct="true"' : ''}>${escapeXml(o.body)}</option>\n`
        })
        xml += '    </options>\n'
      }
      xml += '  </question>\n'
    })
    xml += '</questions>'

    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${examForm.title || 'sorular'}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const escapeXml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const handleSubmit = async () => {
    if (!examForm.start_time || !examForm.end_time) { alert('Başlangıç/bitiş zamanı zorunlu!'); return }
    if (new Date(examForm.start_time) >= new Date(examForm.end_time)) { alert('Bitiş > başlangıç olmalı!'); return }
    if (questions.length === 0) { alert('En az bir soru ekleyin!'); return }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].body.trim()) { alert(`Soru ${i+1} boş olamaz!`); return }
      if (questions[i].question_type !== 'open_ended') {
        if (!questions[i].options.some(o => o.is_correct)) { alert(`Soru ${i+1}: doğru cevap seçin!`); return }
      }
    }
    setLoading(true)
    try {
      const d = { ...examForm, course_id: Number(examForm.course_id), start_time: new Date(examForm.start_time).toISOString(), end_time: new Date(examForm.end_time).toISOString() }
      const r = await examAPI.create(d)
      const examId = r.data.id

      // Her soru için önce görseli yükle, sonra soruyu ekle
      for (const q of questions) {
        let image_url = q.image_url
        if (q.image_file) {
          const imgRes = await examAPI.uploadQuestionImage(examId, q.image_file)
          image_url = imgRes.data.image_url
        }
        const qData = {
          question_type: q.question_type, body: q.body, points: q.points,
          sort_order: q.sort_order, explanation: q.explanation || null,
          image_url: image_url || null, options: q.options,
        }
        await examAPI.addQuestion(examId, qData)
      }
      alert('Sınav oluşturuldu! 2 gözetmen otomatik atandı.')
      navigate('/instructor/exams')
    } catch (err) {
      console.error('Sınav oluşturma hatası:', err.response?.data || err.message || err)
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message || 'Hata')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"><ArrowLeft size={20} /> Geri</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Yeni Sınav Oluştur</h1>

      {/* Sınav Bilgileri */}
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

        <details className="mt-3">
          <summary className="text-sm text-purple-700 cursor-pointer font-medium flex items-center gap-1"><FileText size={14} /> XML Dosya Formatı</summary>
          <pre className="mt-2 p-3 bg-gray-50 border rounded-lg text-xs text-gray-700 overflow-x-auto">{`<questions>
  <!-- Test Sorusu -->
  <question type="multiple_choice" points="10">
    <body>Soru metni</body>
    <image>data:image/png;base64,... veya URL</image>
    <explanation>Açıklama (opsiyonel)</explanation>
    <options>
      <option correct="true">Doğru cevap</option>
      <option>Yanlış cevap 1</option>
      <option>Yanlış cevap 2</option>
      <option>Yanlış cevap 3</option>
    </options>
  </question>

  <!-- Klasik (Açık Uçlu) Soru -->
  <question type="open_ended" points="20">
    <body>Açık uçlu soru metni</body>
    <explanation>Beklenen cevap (opsiyonel)</explanation>
  </question>

  <!-- Görselli Test Sorusu -->
  <question type="multiple_choice" points="15">
    <body>Görsele bakarak cevaplayın</body>
    <image>data:image/png;base64,...</image>
    <options>
      <option correct="true">Doğru cevap</option>
      <option>Yanlış cevap</option>
    </options>
  </question>
</questions>`}</pre>
        </details>
      </div>

      {/* Sorular */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sorular ({questions.length})</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => xmlInputRef.current?.click()} disabled={xmlUploading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50">
              <Upload size={18} /> {xmlUploading ? 'Yükleniyor...' : "XML'den Yükle"}
            </button>
            <input ref={xmlInputRef} type="file" accept=".xml" onChange={handleXmlUpload} className="hidden" />
            {questions.length > 0 && (
              <button onClick={handleXmlExport} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                <Download size={18} /> XML İndir
              </button>
            )}
            <button onClick={() => addQuestion('multiple_choice')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Plus size={18} /> Test Sorusu</button>
            <button onClick={() => addQuestion('open_ended')} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"><Plus size={18} /> Klasik Soru</button>
          </div>
        </div>

        {questions.length === 0 && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-yellow-700">Henüz soru eklenmedi. Manuel ekleyin veya XML dosyasından yükleyin.</div>}

        {questions.map((q, qIdx) => (
          <div key={qIdx} className={`bg-white rounded-xl shadow-sm border p-6 mb-4 ${q.question_type === 'open_ended' ? 'border-l-4 border-l-orange-400' : 'border-l-4 border-l-green-400'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-medium">Soru {qIdx + 1}</h3>
                <select
                  value={q.question_type}
                  onChange={(e) => updateQuestion(qIdx, 'question_type', e.target.value)}
                  className="text-xs px-2 py-1 border rounded-lg bg-gray-50"
                >
                  {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.question_type === 'open_ended' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {q.question_type === 'open_ended' ? 'Klasik' : 'Test'}
                </span>
              </div>
              <button onClick={() => removeQuestion(qIdx)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
            </div>

            {/* Soru metni ve puan */}
            <div className="flex gap-4 mb-4">
              <textarea value={q.body} onChange={(e) => updateQuestion(qIdx, 'body', e.target.value)} placeholder="Soru metni..." className="flex-1 px-3 py-2 border rounded-lg" rows={2} />
              <div className="w-24">
                <label className="block text-sm font-medium mb-1">Puan</label>
                <input type="number" value={q.points} min={1} onChange={(e) => updateQuestion(qIdx, 'points', Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>

            {/* Görsel ekleme */}
            <div className="mb-4">
              {(q.image_preview || q.image_url) ? (
                <div className="relative inline-block">
                  <img src={q.image_preview || q.image_url} alt="Soru görseli" className="max-h-40 rounded-lg border" />
                  <button onClick={() => removeImage(qIdx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!imageInputRefs.current[qIdx]) {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = (e) => handleImageSelect(qIdx, e)
                      imageInputRefs.current[qIdx] = input
                    }
                    imageInputRefs.current[qIdx].click()
                  }}
                  className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 text-sm"
                >
                  <Image size={16} /> Görsel Ekle
                </button>
              )}
            </div>

            {/* Açıklama */}
            {q.question_type === 'open_ended' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Beklenen Cevap / Açıklama</label>
                <textarea value={q.explanation || ''} onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)} placeholder="Beklenen cevabı yazın..." className="w-full px-3 py-2 border rounded-lg" rows={3} />
              </div>
            )}

            {/* Seçenekler (sadece test soruları) */}
            {q.question_type !== 'open_ended' && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">Seçenekler</label>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-3 mb-2">
                    <input type="radio" name={`correct-${qIdx}`} checked={opt.is_correct} onChange={() => updateOption(qIdx, oIdx, 'is_correct', true)} className="w-4 h-4" />
                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm font-medium">{String.fromCharCode(65+oIdx)}</span>
                    <input value={opt.body} onChange={(e) => updateOption(qIdx, oIdx, 'body', e.target.value)} placeholder={`Seçenek ${String.fromCharCode(65+oIdx)}`} className={`flex-1 px-3 py-2 border rounded-lg text-sm ${opt.is_correct ? 'border-green-500 bg-green-50' : ''}`} />
                    {opt.is_correct && <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded">Doğru</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading || !examForm.title || questions.length === 0} className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
        <Save size={20} /> {loading ? 'Kaydediliyor...' : 'Sınavı Oluştur'}
      </button>
    </div>
  )
}
