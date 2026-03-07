/**
 * SmartProctor - Proctoring Hook
 * Kamera erişimi, Web Worker iletişimi ve ihlal tetikleme.
 * Sliding Buffer ile 5 saniyelik video kanıtı toplama.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { violationAPI } from '../services/api'

/**
 * @param {number} sessionId - Aktif sınav oturum ID'si
 * @param {boolean} enabled - Proctoring aktif mi
 */
export function useProctoring(sessionId, enabled = true) {
  const [isReady, setIsReady] = useState(false)
  const [violations, setViolations] = useState([])
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const workerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const blobBufferRef = useRef([])
  const streamRef = useRef(null)

  // --- Web Worker Başlat ---
  useEffect(() => {
    if (!enabled) return

    const worker = new Worker(
      new URL('../workers/proctoring.worker.js', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { type, violations: detectedViolations } = event.data

      switch (type) {
        case 'READY':
          setIsReady(true)
          break

        case 'VIOLATIONS':
          if (detectedViolations) {
            detectedViolations.forEach((v) => {
              setViolations((prev) => [...prev, v])
              // Backend'e ihlal bildir
              violationAPI.log({
                session_id: sessionId,
                violation_type: v.type,
                confidence: v.confidence,
                metadata: v.metadata,
              }).then((res) => {
                // Kanıt videosunu gönder
                sendEvidenceVideo(res.data.id)
              }).catch(() => {})
            })
          }
          break
      }
    }

    worker.postMessage({ type: 'INIT' })
    workerRef.current = worker

    return () => {
      worker.postMessage({ type: 'CLEANUP' })
      worker.terminate()
    }
  }, [enabled, sessionId])

  // --- Kamera Başlat ---
  useEffect(() => {
    if (!enabled) return

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Sliding Buffer: MediaRecorder ile sürekli kayıt
        startSlidingBuffer(stream)

        // Kare yakalama döngüsü (5 FPS)
        startFrameCapture()
      } catch (err) {
        console.error('Kamera erişimi reddedildi:', err)
      }
    }

    startCamera()

    return () => {
      // Kamerayı kapat
      streamRef.current?.getTracks().forEach((t) => t.stop())
      mediaRecorderRef.current?.stop()
    }
  }, [enabled])

  // --- Sliding Buffer (5 saniyelik döngüsel video belleği) ---
  const startSlidingBuffer = useCallback((stream) => {
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 500000, // 500kbps
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          blobBufferRef.current.push(event.data)
          // Son 5 saniyelik veriyi tut (her parça ~1 saniye)
          if (blobBufferRef.current.length > 5) {
            blobBufferRef.current.shift()
          }
        }
      }

      recorder.start(1000) // Her 1 saniyede bir chunk
      mediaRecorderRef.current = recorder
    } catch (err) {
      console.error('MediaRecorder başlatılamadı:', err)
    }
  }, [])

  // --- Kare Yakalama (Canvas → Worker) ---
  const startFrameCapture = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320 // Düşük çözünürlük (performans)
    canvas.height = 240
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')

    const captureFrame = () => {
      if (!videoRef.current || !workerRef.current) return

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      workerRef.current.postMessage({
        type: 'ANALYZE_FRAME',
        data: { imageData },
      })
    }

    // 5 FPS (200ms aralık)
    const intervalId = setInterval(captureFrame, 200)
    return () => clearInterval(intervalId)
  }, [])

  // --- Kanıt Videosu Gönder ---
  const sendEvidenceVideo = useCallback(async (violationId) => {
    if (blobBufferRef.current.length === 0) return

    try {
      const blob = new Blob(blobBufferRef.current, { type: 'video/webm' })
      const formData = new FormData()
      formData.append('video', blob, `violation_${violationId}.webm`)
      await violationAPI.uploadEvidence(violationId, formData)
    } catch (err) {
      console.error('Video yüklenemedi:', err)
    }
  }, [])

  return {
    videoRef,
    isReady,
    violations,
  }
}
