/**
 * SmartProctor - Güvenli Sınav Arayüzü (Güncellenmiş)
 * + AI Proctoring entegrasyonu (kamera, Web Worker)
 * + Bitirme onay modalı
 * + Kamera önizleme penceresi
 * + Cevaplanmamış soru uyarısı
 */

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
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [showConfirmFinish, setShowConfirmFinish] = useState(false)

  const debounceTimer = useRef(null)

  // --- AI Proctoring Hook ---
  const { videoRef, isReady: proctoringReady, violations: aiViolations } = useProctoring(
    session?.session_id,
    !!session && !finished
  )

  const totalViolations = browserViolations.length + aiViolations.length

  // --- Sınav Başlat ---
  useEffect(() => {
    const initExam = async () => {
      try {
        const sessionRes = await sessionAPI.start(examId)
        setSession(sessionRes.data)
        setTimeLeft(sessionRes.data.duration_minutes * 60)
        const questionsRes = await examAPI.listQuestionsStudent(examId)
        setQuestions(questionsRes.data)
      } catch (err) {
        alert(err.response?.data?.detail || 'Sınav başlatılamadı')
        navigate('/student')
      } finally {
        setLoading(false)
      }
    }
    initExam()
  }, [examId, navigate])

  // --- Tam Ekran ---
  useEffect(() => {
    const enterFullscreen = () => {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
    enterFullscreen()
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && session && !finished) {
        logBrowserViolation('FULLSCREEN_EXIT')
        setTimeout(enterFullscreen, 500)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [session, finished])

  // --- Anti-Cheat ---
  useEffect(() => {
    const handleContextMenu = (e) => { e.preventDefault(); logBrowserViolation('RIGHT_CLICK') }
    const handleCopyPaste = (e) => { e.preventDefault(); logBrowserViolation('COPY_PASTE') }
    const handleKeyDown = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault()
        logBrowserViolation('DEVTOOLS')
      }
    }
    const handleVisibility = () => {
      if (document.hidden && session && !finished) {
        logBrowserViolation('TAB_SWITCH')
        sessionAPI.logTabSwitch(session.session_id).then((res) => {
          if (res.data.terminated) {
            setFinished(true)
            alert('Çok fazla sekme değişikliği! Sınavınız sonlandırıldı.')
            document.exitFullscreen?.().catch(() => {})
            navigate('/student')
          }
        })
      }
    }
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleCopyPaste)
    document.addEventListener('paste', handleCopyPaste)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleCopyPaste)
      document.removeEventListener('paste', handleCopyPaste)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [session, finished, navigate])

  // --- Geri Sayım ---
  useEffect(() => {
    if (timeLeft <= 0 || finished) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); handleFinish(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, finished])

  const logBrowserViolation = useCallback((type) => {
    if (!session) return
    setBrowserViolations((prev) => [...prev, { type, time: new Date().toISOString() }])
    violationAPI.log({ session_id: session.session_id, violation_type: type }).catch(() => {})
  }, [session])

  const saveAnswer = useCallback((questionId, optionId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      sessionAPI.submitAnswer({ question_id: questionId, selected_option_id: optionId }).catch(() => {})
    }, 500)
  }, [])

  const handleFinish = async () => {
    if (finished) return
    setFinished(true)
    setShowConfirmFinish(false)
    try {
      document.exitFullscreen?.().catch(() => {})
      const res = await sessionAPI.finish(session.session_id)
      setResult(res.data)
    } catch { navigate('/student') }
  }

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
  const answeredCount = Object.keys(answers).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-lg">Sınav hazırlanıyor...</p>
          <p className="text-gray-400 text-sm mt-2">Kamera izni istenecektir</p>
        </div>
      </div>
    )
  }

  if (result) {
    const passed = result.score >= 50
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`text-3xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>{Math.round(result.score)}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sınav {passed ? 'Başarılı' : 'Tamamlandı'}</h2>
          <p className="text-gray-500 mb-2">{result.correct_answers} / {result.total_questions} doğru cevap</p>
          {totalViolations > 0 && <p className="text-yellow-600 text-sm mb-4">{totalViolations} ihlal tespit edildi</p>}
          <button onClick={() => navigate('/student')} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">Ana Sayfaya Dön</button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIdx]

  return (
    <div className="min-h-screen bg-gray-900 exam-mode-enter select-none">
      {/* Üst Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <span className="text-white font-medium">SmartProctor</span>
          {proctoringReady
            ? <span className="flex items-center gap-1 text-green-400 text-xs"><Camera size={14} /> AI Aktif</span>
            : <span className="flex items-center gap-1 text-yellow-400 text-xs"><CameraOff size={14} /> Bekleniyor</span>
          }
        </div>
        <div className="flex items-center gap-6">
          <span className="text-gray-400 text-sm">{answeredCount}/{questions.length} cevaplanmış</span>
          {totalViolations > 0 && (
            <div className="flex items-center gap-2 text-yellow-400"><AlertTriangle size={16} /><span className="text-sm">{totalViolations} ihlal</span></div>
          )}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg ${timeLeft < 300 ? 'bg-red-900 text-red-300 animate-pulse' : timeLeft < 600 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-200'}`}>
            <Clock size={16} /><span className="font-mono text-lg font-bold">{formatTime(timeLeft)}</span>
          </div>
          <button onClick={() => setShowConfirmFinish(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
            <Send size={16} /> Bitir
          </button>
        </div>
      </div>

      {/* Kamera Önizleme */}
      <div className="fixed bottom-4 right-4 z-50 w-40 h-30 bg-black rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        {proctoringReady && <div className="absolute top-1 left-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
      </div>

      {/* Sorular */}
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="flex gap-2 mb-8 flex-wrap">
          {questions.map((q, idx) => (
            <button key={q.id} onClick={() => setCurrentIdx(idx)}
              className={`w-10 h-10 rounded-lg font-medium text-sm transition ${idx === currentIdx ? 'bg-blue-600 text-white' : answers[q.id] ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'}`}>
              {idx + 1}
            </button>
          ))}
        </div>

        {currentQuestion && (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-400 text-sm">Soru {currentIdx + 1} / {questions.length}</span>
              <span className="text-gray-400 text-sm">{currentQuestion.points} puan</span>
            </div>
            <h3 className="text-white text-xl mb-8 leading-relaxed">{currentQuestion.body}</h3>
            <div className="space-y-3">
              {currentQuestion.options.map((opt) => (
                <button key={opt.id} onClick={() => saveAnswer(currentQuestion.id, opt.id)}
                  className={`w-full text-left p-4 rounded-lg border transition ${answers[currentQuestion.id] === opt.id ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-400 hover:bg-gray-700'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${answers[currentQuestion.id] === opt.id ? 'border-blue-500 bg-blue-500' : 'border-gray-500'}`}>
                      {answers[currentQuestion.id] === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>
                    <span>{opt.body}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-30 transition">
                <ChevronLeft size={18} /> Önceki
              </button>
              <button onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))} disabled={currentIdx === questions.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-30 transition">
                Sonraki <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bitirme Onay Modalı */}
      {showConfirmFinish && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4 border border-gray-600">
            <h3 className="text-white text-lg font-bold mb-3">Sınavı Bitir</h3>
            <p className="text-gray-400 text-sm mb-2">{answeredCount} / {questions.length} soru cevaplanmış.</p>
            {answeredCount < questions.length && (
              <p className="text-yellow-400 text-sm mb-4">{questions.length - answeredCount} soru cevaplanmamış!</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowConfirmFinish(false)} className="flex-1 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm font-medium">Devam Et</button>
              <button onClick={handleFinish} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Evet, Bitir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
