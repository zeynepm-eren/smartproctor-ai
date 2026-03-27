import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { examAPI, sessionAPI, violationAPI } from '../../services/api'
import { useProctoring } from '../../hooks/useProctoring'
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, Send, Shield, Camera, CameraOff } from 'lucide-react'

export default function ExamInterface() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [browserViolations, setBrowserViolations] = useState([])
  const [loading, setLoading] = useState(false)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [showConfirmFinish, setShowConfirmFinish] = useState(false)
  const [initError, setInitError] = useState(null)
  const [finishError, setFinishError] = useState(null)
  const [cameraPermission, setCameraPermission] = useState(null)
  const debounceTimer = useRef(null)
  const finishingRef = useRef(false)

  const { videoRef, isReady: proctoringReady, violations: aiViolations } = useProctoring(session?.session_id, !!session && !finished)
  const totalViolations = browserViolations.length + aiViolations.length

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => navigate('/student', { replace: true, state: { refresh: Date.now() } }), 3000)
    return () => clearTimeout(t)
  }, [result, navigate])

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setCameraPermission('granted')
    } catch {
      setCameraPermission('denied')
    }
  }

  useEffect(() => {
    if (cameraPermission !== 'granted') return
    let retries = 0
    setLoading(true)
    const initExam = async () => {
      try {
        setInitError(null)
        const sr = await sessionAPI.start(examId)
        if (['submitted','timed_out','terminated'].includes(sr.data.status)) {
          navigate('/student', { replace: true, state: { refresh: Date.now() } })
          return
        }
        setSession(sr.data)
        const elapsed = Math.floor((Date.now() - new Date(sr.data.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, sr.data.duration_minutes * 60 - elapsed))
        const qr = await examAPI.listQuestionsStudent(examId)
        setQuestions(qr.data)
      } catch (err) {
        const d = err.response?.data?.detail || err.message
        if (retries < 2) { retries++; await new Promise(r => setTimeout(r, 500)); return initExam() }
        setInitError(d)
      } finally { setLoading(false) }
    }
    initExam()
  }, [examId, navigate, cameraPermission])

  useEffect(() => {
    if (!session || finished) return
    const enterFS = () => { document.documentElement.requestFullscreen?.().catch(() => {}) }
    enterFS()
    const h = () => { if (!document.fullscreenElement && !finished) { logBV('FULLSCREEN_EXIT'); setTimeout(enterFS, 500) } }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [session, finished])

  useEffect(() => {
    if (!session || finished) return
    const ctx = (e) => { e.preventDefault(); logBV('RIGHT_CLICK') }
    const cp = (e) => { e.preventDefault(); logBV('COPY_PASTE') }
    const key = (e) => { if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) { e.preventDefault(); logBV('DEVTOOLS') } }
    const vis = () => { if (document.hidden) { logBV('TAB_SWITCH'); sessionAPI.logTabSwitch(session.session_id).catch(() => {}) } }
    document.addEventListener('contextmenu', ctx)
    document.addEventListener('copy', cp)
    document.addEventListener('paste', cp)
    document.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('contextmenu', ctx); document.removeEventListener('copy', cp); document.removeEventListener('paste', cp); document.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', vis) }
  }, [session, finished])

  useEffect(() => {
    if (timeLeft <= 0 || finished) return
    const t = setInterval(() => { setTimeLeft(p => { if (p <= 1) { clearInterval(t); handleFinish(); return 0 } return p - 1 }) }, 1000)
    return () => clearInterval(t)
  }, [timeLeft, finished])

  const logBV = useCallback((type) => {
    if (!session) return
    setBrowserViolations(p => [...p, { type, time: new Date().toISOString() }])
    violationAPI.log({ session_id: session.session_id, violation_type: type }).catch(() => {})
  }, [session])

  const saveAnswer = useCallback((qid, oid) => {
    setAnswers(p => ({ ...p, [qid]: oid }))
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => { sessionAPI.submitAnswer({ question_id: qid, selected_option_id: oid }).catch(() => {}) }, 500)
  }, [])

  const handleFinish = async () => {
    if (finished || finishingRef.current) return
    finishingRef.current = true
    setFinished(true)
    setShowConfirmFinish(false)
    setFinishError(null)
    document.exitFullscreen?.().catch(() => {})
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await sessionAPI.finish(session.session_id)
        setResult(r.data)
        return
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Bilinmeyen hata'
        setFinishError(`Hata (deneme ${attempt + 1}/3): ${msg}`)
        if (attempt < 2) await new Promise(res => setTimeout(res, 800))
      }
    }
    // 3 denemeden sonra da başarısız — hatayı göster, kullanıcı tekrar deneyebilir
    finishingRef.current = false
    setFinished(false)
  }

  const goHome = () => {
    navigate('/student', { replace: true, state: { refresh: Date.now() } })
  }

  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
  const ac = Object.keys(answers).length

  if (cameraPermission === null) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <Camera className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Kamera İzni Gerekli</h2>
        <p className="text-gray-500 mb-6">Sınava girebilmek için kameranıza erişim izni vermeniz gerekmektedir.</p>
        <button onClick={requestCamera} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium">Kamera İznini Ver</button>
      </div>
    </div>
  )

  if (cameraPermission === 'denied') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <CameraOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Kamera Erişimi Reddedildi</h2>
        <p className="text-gray-500 mb-6">Sınava girebilmek için kamera izni zorunludur. Tarayıcı ayarlarından kamera iznini açın ve tekrar deneyin.</p>
        <button onClick={requestCamera} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium">Tekrar Dene</button>
        <button onClick={goHome} className="ml-3 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium">Ana Sayfaya Dön</button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
        <p className="text-white text-lg">Sinav hazirlaniyor...</p>
      </div>
    </div>
  )

  if (initError) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Sinav Baslatilamadi</h2>
        <p className="text-gray-500 mb-4">{initError}</p>
        <button onClick={goHome} className="px-6 py-3 bg-blue-600 text-white rounded-lg">Ana Sayfaya Don</button>
      </div>
    </div>
  )

  if (result) {
    const passed = result.score >= 50
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`text-3xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>{Math.round(result.score)}</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Sinav {passed ? 'Basarili' : 'Tamamlandi'}</h2>
          <p className="text-gray-400 text-sm mt-2">Ana sayfaya yonlendiriliyor...</p>
          <button onClick={goHome} className="px-6 py-3 bg-blue-600 text-white rounded-lg mt-4">Ana Sayfaya Don</button>
        </div>
      </div>
    )
  }

  const cq = questions[currentIdx]
  return (
    <div className="min-h-screen bg-gray-900 exam-mode-enter select-none">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <span className="text-white font-medium">SmartProctor</span>
          {proctoringReady ? <span className="flex items-center gap-1 text-green-400 text-xs"><Camera size={14}/> AI Aktif</span> : <span className="flex items-center gap-1 text-yellow-400 text-xs"><CameraOff size={14}/> Bekleniyor</span>}
        </div>
        <div className="flex items-center gap-6">
          <span className="text-gray-400 text-sm">{ac}/{questions.length}</span>
          {totalViolations > 0 && <div className="flex items-center gap-2 text-yellow-400"><AlertTriangle size={16}/><span className="text-sm">{totalViolations}</span></div>}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg ${timeLeft < 300 ? 'bg-red-900 text-red-300 animate-pulse' : timeLeft < 600 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-200'}`}><Clock size={16}/><span className="font-mono text-lg font-bold">{fmt(timeLeft)}</span></div>
          <button onClick={() => setShowConfirmFinish(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"><Send size={16}/> Bitir</button>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 z-50 w-40 h-30 bg-black rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{transform:'scaleX(-1)'}}/>
        {proctoringReady && <div className="absolute top-1 left-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"/>}
      </div>
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="flex gap-2 mb-8 flex-wrap">
          {questions.map((q, i) => (<button key={q.id} onClick={() => setCurrentIdx(i)} className={`w-10 h-10 rounded-lg font-medium text-sm transition ${i === currentIdx ? 'bg-blue-600 text-white' : answers[q.id] ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>{i+1}</button>))}
        </div>
        {cq && (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
            <div className="flex items-center justify-between mb-6"><span className="text-gray-400 text-sm">Soru {currentIdx+1} / {questions.length}</span><span className="text-gray-400 text-sm">{cq.points} puan</span></div>
            <h3 className="text-white text-xl mb-8 leading-relaxed">{cq.body}</h3>
            <div className="space-y-3">{cq.options.map(o => (
              <button key={o.id} onClick={() => saveAnswer(cq.id, o.id)} className={`w-full text-left p-4 rounded-lg border transition ${answers[cq.id] === o.id ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-400'}`}>
                <div className="flex items-center gap-3"><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${answers[cq.id] === o.id ? 'border-blue-500 bg-blue-500' : 'border-gray-500'}`}>{answers[cq.id] === o.id && <div className="w-2.5 h-2.5 rounded-full bg-white"/>}</div><span>{o.body}</span></div>
              </button>
            ))}</div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setCurrentIdx(Math.max(0,currentIdx-1))} disabled={currentIdx===0} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg disabled:opacity-30"><ChevronLeft size={18}/> Onceki</button>
              <button onClick={() => setCurrentIdx(Math.min(questions.length-1,currentIdx+1))} disabled={currentIdx===questions.length-1} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg disabled:opacity-30">Sonraki <ChevronRight size={18}/></button>
            </div>
          </div>
        )}
      </div>
      {finishError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-500 text-red-200 px-6 py-3 rounded-xl text-sm max-w-lg text-center shadow-xl">
          <AlertTriangle size={16} className="inline mr-2" />
          {finishError}
          <button onClick={() => { setFinishError(null); setShowConfirmFinish(true) }} className="ml-3 underline text-red-300">Tekrar Dene</button>
        </div>
      )}
      {showConfirmFinish && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4 border border-gray-600">
            <h3 className="text-white text-lg font-bold mb-3">Sinavi Bitir</h3>
            <p className="text-gray-400 text-sm mb-2">{ac} / {questions.length} soru cevaplanmis.</p>
            {ac < questions.length && <p className="text-yellow-400 text-sm mb-4">{questions.length - ac} soru cevaplanmamis!</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowConfirmFinish(false)} className="flex-1 py-2.5 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium">Devam Et</button>
              <button onClick={handleFinish} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium">Evet, Bitir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}