/**
 * SmartProctor - AI Gözetim Web Worker
 * Ana UI thread'i dondurmadan arka planda çalışır.
 *
 * Görevleri:
 * 1. MediaPipe Face Mesh ile yüz takibi (bakış yönü - Yaw/Pitch)
 * 2. YOLOv8n ile nesne tespiti (telefon, birden fazla kişi)
 * 3. İhlal tespitinde ana thread'e mesaj gönderme
 *
 * NOT: Bu dosya Web Worker olarak çalışır.
 * MediaPipe ve ONNX/TFJS modelleri CDN'den yüklenecektir.
 * Production'da model dosyaları lokale indirilmeli.
 */

// ============================================================================
// YAPILANDIRMA
// ============================================================================

const CONFIG = {
  // Yüz analizi eşik değerleri (derece cinsinden)
  GAZE_YAW_THRESHOLD: 30,     // Sağ/Sol bakış eşiği
  GAZE_PITCH_THRESHOLD: 25,   // Yukarı/Aşağı bakış eşiği
  GAZE_DURATION_MS: 2000,     // Ne kadar süre bakmalı (ms)

  // Nesne tespiti
  PHONE_CONFIDENCE: 0.6,       // Telefon tespit güven eşiği
  PERSON_CONFIDENCE: 0.5,      // Kişi tespit güven eşiği

  // Genel
  FPS: 5,                      // Saniyede işlenen kare sayısı
  COOLDOWN_MS: 10000,          // İhlal arası minimum bekleme (ms)
}

// İhlal cooldown takibi
const lastViolation = {}

function canReport(type) {
  const now = Date.now()
  if (lastViolation[type] && now - lastViolation[type] < CONFIG.COOLDOWN_MS) {
    return false
  }
  lastViolation[type] = now
  return true
}

// ============================================================================
// YÜZ ANALİZİ (MediaPipe Face Mesh Simülasyonu)
// ============================================================================

// Gerçek projede MediaPipe Face Mesh entegrasyonu yapılır.
// Burada matematiksel model verilmiştir.

/**
 * Yüz landmark'larından baş pozu açılarını hesaplar.
 * @param {Array} landmarks - Yüz noktaları [x, y, z] dizisi
 * @returns {{ yaw: number, pitch: number, roll: number }}
 */
function calculateHeadPose(landmarks) {
  if (!landmarks || landmarks.length < 468) return null

  // Burun ucu (landmark 1) ve yüz kenarları ile açı hesabı
  const noseTip = landmarks[1]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  const chin = landmarks[152]
  const forehead = landmarks[10]

  // Yaw (sağ-sol) hesabı: burun ile göz arası mesafe oranı
  const leftDist = Math.sqrt(
    Math.pow(noseTip[0] - leftEye[0], 2) + Math.pow(noseTip[1] - leftEye[1], 2)
  )
  const rightDist = Math.sqrt(
    Math.pow(noseTip[0] - rightEye[0], 2) + Math.pow(noseTip[1] - rightEye[1], 2)
  )
  const yaw = Math.atan2(leftDist - rightDist, leftDist + rightDist) * (180 / Math.PI) * 4

  // Pitch (yukarı-aşağı) hesabı
  const faceHeight = Math.sqrt(
    Math.pow(forehead[0] - chin[0], 2) + Math.pow(forehead[1] - chin[1], 2)
  )
  const noseToForehead = Math.sqrt(
    Math.pow(noseTip[0] - forehead[0], 2) + Math.pow(noseTip[1] - forehead[1], 2)
  )
  const pitch = (noseToForehead / faceHeight - 0.5) * 90

  return { yaw, pitch, roll: 0 }
}

/**
 * Baş pozu açılarını analiz eder ve ihlal tespiti yapar.
 */
function analyzeGaze(headPose) {
  if (!headPose) return null

  const { yaw, pitch } = headPose

  if (Math.abs(yaw) > CONFIG.GAZE_YAW_THRESHOLD) {
    const direction = yaw < 0 ? 'GAZE_LEFT' : 'GAZE_RIGHT'
    if (canReport(direction)) {
      return {
        type: direction,
        confidence: Math.min(Math.abs(yaw) / 60, 1),
        metadata: { yaw: parseFloat(yaw.toFixed(1)), pitch: parseFloat(pitch.toFixed(1)) },
      }
    }
  }

  return null
}

// ============================================================================
// NESNE TESPİTİ (YOLOv8n Simülasyonu)
// ============================================================================

/**
 * Gerçek projede YOLOv8n ONNX modeli yüklenir:
 * - onnxruntime-web veya TensorFlow.js ile
 * - Model: yolov8n.onnx (yaklaşık 6MB)
 *
 * Bu stub, frame analiz akışını gösterir.
 */
function analyzeFrame(imageData) {
  // Production'da burada model inference yapılır:
  // 1. ImageData'yı tensor'a çevir
  // 2. Model üzerinden inference yap
  // 3. Bounding box'ları decode et
  // 4. NMS (Non-Maximum Suppression) uygula
  // 5. Sonuçları döndür

  return {
    detections: [],  // [{ class: 'cell phone', confidence: 0.87, bbox: [x, y, w, h] }]
    personCount: 1,  // Tespit edilen kişi sayısı
  }
}

/**
 * YOLO sonuçlarını analiz eder ve ihlal tespiti yapar.
 */
function analyzeDetections(results) {
  const violations = []

  for (const det of results.detections) {
    // Telefon tespiti
    if (det.class === 'cell phone' && det.confidence >= CONFIG.PHONE_CONFIDENCE) {
      if (canReport('PHONE_DETECTED')) {
        violations.push({
          type: 'PHONE_DETECTED',
          confidence: det.confidence,
          metadata: { model: 'yolov8n', bbox: det.bbox },
        })
      }
    }
  }

  // Birden fazla kişi tespiti
  if (results.personCount > 1) {
    if (canReport('MULTIPLE_PERSONS')) {
      violations.push({
        type: 'MULTIPLE_PERSONS',
        confidence: 0.8,
        metadata: { personCount: results.personCount },
      })
    }
  }

  return violations
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

self.onmessage = function (event) {
  const { type, data } = event.data

  switch (type) {
    case 'INIT':
      // Model yükleme (production'da burada gerçek model yüklenir)
      self.postMessage({ type: 'READY' })
      break

    case 'ANALYZE_FRAME':
      try {
        const violations = []

        // 1. Yüz analizi (landmarks geldiyse)
        if (data.landmarks) {
          const headPose = calculateHeadPose(data.landmarks)
          const gazeViolation = analyzeGaze(headPose)
          if (gazeViolation) violations.push(gazeViolation)
        }

        // 2. Nesne tespiti (imageData geldiyse)
        if (data.imageData) {
          const detections = analyzeFrame(data.imageData)
          const detViolations = analyzeDetections(detections)
          violations.push(...detViolations)
        }

        // İhlal varsa ana thread'e bildir
        if (violations.length > 0) {
          self.postMessage({ type: 'VIOLATIONS', violations })
        }

        self.postMessage({ type: 'FRAME_PROCESSED' })
      } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message })
      }
      break

    case 'CLEANUP':
      // Tensor temizliği (memory leak önleme)
      self.postMessage({ type: 'CLEANED_UP' })
      break

    default:
      break
  }
}
