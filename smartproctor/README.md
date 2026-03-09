# SmartProctor — AI Destekli Online Sınav Gözetim Sistemi

## Proje Açıklaması

SmartProctor, web tabanlı bir online sınav gözetim sistemidir. Yapay zeka destekli kopya tespiti (yüz takibi, nesne algılama), güvenli sınav tarayıcısı ve çift kör doğrulama sistemi ile adil sınav deneyimi sunar.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy (Async), PostgreSQL |
| **Frontend** | React 18, Vite, Tailwind CSS, Axios |
| **Güvenlik** | JWT (Access + Refresh), bcrypt, RBAC |
| **AI** | MediaPipe Face Mesh, YOLOv8n (ONNX/TFJS), Web Workers |
| **Altyapı** | Docker Compose |

---

## Dosya Yapısı

```
smartproctor/
├── docker-compose.yml
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env
│   ├── migrations/
│   │   └── init_schema.sql              # Veritabanı şeması + seed data
│   ├── static/evidence/                 # İhlal videoları
│   └── app/
│       ├── main.py                      # FastAPI giriş noktası
│       ├── core/
│       │   ├── config.py                # Ortam değişkenleri
│       │   ├── database.py              # Async SQLAlchemy engine
│       │   ├── security.py              # JWT + bcrypt
│       │   └── deps.py                  # Auth & RBAC dependency injection
│       ├── models/
│       │   ├── __init__.py              # Tüm modelleri dışa aktarır
│       │   ├── user.py                  # Kullanıcı (student/instructor/proctor)
│       │   ├── refresh_token.py         # JWT refresh token
│       │   ├── course.py                # Ders + Kayıt (CourseEnrollment)
│       │   ├── exam.py                  # Sınav + Soru + Seçenek
│       │   ├── session.py               # Sınav Oturumu + Öğrenci Cevabı
│       │   ├── violation.py             # İhlal + İnceleme + Uyuşmazlık
│       │   └── proctor.py               # Gözetmen Ataması + Log + Bildirim
│       ├── schemas/
│       │   ├── auth.py                  # Register/Login/Token DTO
│       │   ├── course.py                # Ders DTO
│       │   ├── exam.py                  # Sınav/Soru DTO
│       │   ├── session.py               # Oturum/Cevap DTO
│       │   └── violation.py             # İhlal/İnceleme DTO
│       └── routers/
│           ├── auth.py                  # /register, /login, /refresh, /me
│           ├── courses.py               # Ders CRUD + Öğrenci Kayıt
│           ├── exams.py                 # Sınav CRUD + Soru ekleme
│           ├── sessions.py              # Sınav başlat/cevapla/bitir
│           └── violations.py            # İhlal log + İnceleme + Uyuşmazlık
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx                     # React giriş noktası
        ├── App.jsx                      # Router yapılandırması
        ├── index.css                    # Tailwind CSS
        ├── context/
        │   └── AuthContext.jsx          # Global auth state yönetimi
        ├── services/
        │   └── api.js                   # Axios API katmanı + interceptor
        ├── hooks/
        │   └── useProctoring.js         # Kamera + Worker + Sliding Buffer
        ├── workers/
        │   └── proctoring.worker.js     # AI analiz Web Worker
        └── components/
            ├── auth/
            │   ├── Login.jsx            # Giriş sayfası
            │   └── Register.jsx         # Kayıt sayfası
            ├── layout/
            │   ├── Layout.jsx           # ProtectedRoute + DashboardLayout
            │   └── Navbar.jsx           # Rol bazlı navigasyon + bildirim
            ├── dashboard/
            │   ├── StudentDashboard.jsx # Öğrenci ana sayfa
            │   ├── StudentHistory.jsx   # Sınav geçmişi
            │   └── InstructorDashboard.jsx # Eğitmen ana sayfa
            ├── exam/
            │   └── ExamInterface.jsx    # Güvenli sınav arayüzü (anti-cheat)
            ├── instructor/
            │   ├── ExamCreate.jsx       # Sınav + soru oluşturma formu
            │   ├── InstructorExams.jsx  # Sınav listesi
            │   └── ConflictResolution.jsx # Uyuşmazlık çözümü
            └── proctor/
                └── ProctorDashboard.jsx # Çift kör ihlal inceleme paneli
```

---

## Kurulum ve Çalıştırma

### Yöntem 1: Docker Compose (Önerilen)

```bash
# 1. Projeyi klonla
git clone <repo-url>
cd smartproctor

# 2. Docker ile başlat (DB + Backend + Frontend hep birlikte)
docker-compose up --build

# 3. Tarayıcıda aç
#    Frontend : http://localhost:5173
#    API Docs : http://localhost:8000/docs
#    ReDoc    : http://localhost:8000/redoc
```

### Yöntem 2: Manuel Kurulum

#### Ön Gereksinimler

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

#### 1. Veritabanı

```bash
# PostgreSQL'de veritabanı oluştur
createdb smartproctor

# Şemayı ve örnek verileri yükle
psql -d smartproctor -f backend/migrations/init_schema.sql
```

#### 2. Backend

```bash
cd backend

# Sanal ortam oluştur ve aktive et
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# Evidence klasörünü oluştur
mkdir -p static/evidence

# .env dosyasını kontrol et (gerekirse DATABASE_URL'yi düzenle)

# Sunucuyu başlat
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Frontend

```bash
cd frontend

# Bağımlılıkları yükle
npm install

# Dev sunucusunu başlat
npm run dev
```

Tarayıcıda `http://localhost:5173` adresine gidin.

---

## Demo Hesaplar

Tüm hesapların şifresi: **`Password1!`**

| Rol | Email | Panel |
|-----|-------|-------|
| Eğitmen | `instructor@smartproctor.io` | `/instructor` |
| Gözetmen 1 | `proctor1@smartproctor.io` | `/proctor` |
| Gözetmen 2 | `proctor2@smartproctor.io` | `/proctor` |
| Öğrenci 1 | `student1@smartproctor.io` | `/student` |
| Öğrenci 2 | `student2@smartproctor.io` | `/student` |
| Öğrenci 3 | `student3@smartproctor.io` | `/student` |

---

## API Endpoint'leri Özeti

### Kimlik Doğrulama (`/api/auth`)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/register` | Yeni kullanıcı kaydı |
| POST | `/login` | JWT token ile giriş |
| POST | `/refresh` | Refresh token ile yenileme |
| GET | `/me` | Mevcut kullanıcı bilgisi |

### Dersler (`/api/courses`)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/` | Rol bazlı ders listesi |
| POST | `/` | Yeni ders oluştur (eğitmen) |
| GET | `/{id}` | Ders detayı |
| PUT | `/{id}` | Ders güncelle (eğitmen) |
| POST | `/{id}/enroll` | Öğrenci kaydet |
| GET | `/{id}/students` | Kayıtlı öğrenciler |

### Sınavlar (`/api/exams`)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/` | Rol bazlı sınav listesi |
| POST | `/` | Yeni sınav oluştur (eğitmen) |
| GET | `/{id}` | Sınav detayı |
| PUT | `/{id}` | Sınav güncelle |
| POST | `/{id}/questions` | Soru ekle |
| GET | `/{id}/questions` | Soru listesi (tam) |
| GET | `/{id}/questions/student` | Soru listesi (cevaplar gizli) |

### Sınav Oturumları (`/api/sessions`)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/start/{exam_id}` | Sınava başla |
| POST | `/answer` | Cevap kaydet (debounce/upsert) |
| POST | `/finish/{session_id}` | Sınavı bitir + otomatik puanla |
| POST | `/tab-switch/{session_id}` | Sekme değişimi logla |
| GET | `/my-sessions` | Öğrencinin oturumları |

### İhlaller (`/api/violations`)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/log` | İhlal kaydet (AI/tarayıcı) |
| POST | `/upload-evidence/{id}` | 5sn video kanıtı yükle |
| GET | `/pending-reviews` | Bekleyen incelemeler (gözetmen) |
| POST | `/review/{id}` | İnceleme kararı (çift kör) |
| GET | `/conflicts` | Uyuşmazlıklar (eğitmen) |
| POST | `/conflicts/{id}/resolve` | Nihai karar (eğitmen) |

### Bildirimler (`/api/notifications`)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/` | Bildirim listesi |
| PUT | `/{id}/read` | Okundu işaretle |

Tüm endpoint'lerin detaylı dökümantasyonu: `http://localhost:8000/docs` (Swagger UI)

---

## Veritabanı Tabloları (15 Tablo)

| # | Tablo | Açıklama |
|---|-------|----------|
| 1 | `users` | Kullanıcılar (öğrenci, eğitmen, gözetmen) |
| 2 | `refresh_tokens` | JWT refresh token yönetimi |
| 3 | `courses` | Dersler |
| 4 | `course_enrollments` | Öğrenci ↔ Ders (M:N) |
| 5 | `exams` | Sınavlar (bir derse bağlı) |
| 6 | `questions` | Sınav soruları |
| 7 | `options` | Soru seçenekleri |
| 8 | `exam_sessions` | Öğrencinin sınav oturumu |
| 9 | `student_answers` | Öğrenci cevapları (debounce kayıt) |
| 10 | `violations` | AI/tarayıcı ihlalleri + video kanıtı |
| 11 | `proctor_assignments` | Gözetmen ↔ Sınav ataması |
| 12 | `violation_reviews` | Çift kör gözetmen değerlendirmesi |
| 13 | `conflict_resolutions` | Uyuşmazlık → Eğitmen nihai kararı |
| 14 | `audit_logs` | Sistem olay kayıtları |
| 15 | `notifications` | Kullanıcı bildirimleri |

---

## Güvenlik Özellikleri (Anti-Cheat)

### Tarayıcı Tarafı
- **Tam Ekran Zorlama**: `requestFullscreen` API — çıkış algılandığında log + tekrar zorlama
- **Sekme Takibi**: `visibilitychange` API — her değişiklik `TAB_SWITCH` ihlali
- **Sağ Tık Engeli**: `contextmenu` event engelleme
- **Kopyala/Yapıştır Engeli**: `copy`/`paste` event engelleme
- **DevTools Engeli**: F12 ve Ctrl+Shift+I kısayolları engelleme
- **Otomatik Kayıt (Debounce)**: Cevaplar 500ms gecikme ile arka planda kaydedilir — elektrik/internet kesintisine karşı koruma

### AI Gözetim (Web Worker)
- **MediaPipe Face Mesh**: Yüz noktalarından Yaw/Pitch açı hesabı — sağa/sola bakış tespiti
- **YOLOv8n Nesne Tespiti**: Telefon (`cell phone`) ve ikinci kişi (`person`) algılama
- **Sliding Buffer**: MediaRecorder ile 5 saniyelik döngüsel video belleği — ihlal anında öncesi+sonrasını içeren kanıt videosu
- **Web Worker İzolasyonu**: AI analiz ana thread'i dondurmadan arka planda 5 FPS çalışır
- **Cooldown Mekanizması**: Aynı tür ihlal için 10 saniye bekleme (spam önleme)

### Çift Kör Doğrulama (Double-Blind Verification)
1. AI ihlal tespit eder → otomatik olarak 2 gözetmene atanır
2. Gözetmenler öğrenci ismini görmez (anonimleştirme) — sadece oturum ID ve video
3. Her gözetmen bağımsız karar verir: "İhlal Var" / "İhlal Yok"
4. İki karar uyuşursa → sonuç kesinleşir
5. Uyuşmazlık varsa → eğitmenin paneline düşer, nihai kararı eğitmen verir

---

## Uçtan Uca Demo Akışı

```
Eğitmen: Sınav oluştur → Soruları ekle → Durumu "active" yap
                                    ↓
Öğrenci: Giriş yap → Sınava başla → Tam ekran + Kamera açılır
                                    ↓
         Soruları cevapla (her tık auto-save) → [arka plan: AI analiz]
                                    ↓
         Telefona bak / Sekme değiştir → İHLAL TESPİTİ
                                    ↓
         5sn video kanıtı sunucuya gönderilir → 2 gözetmene atanır
                                    ↓
Gözetmen 1: Video izle → "İhlal Var" → Gözetmen 2: Video izle → "İhlal Var"
                                    ↓
                            KARAR: İhlal Onaylandı ✓
                                    
         (veya) Gözetmen 1: "Var" ↔ Gözetmen 2: "Yok" → UYUŞMAZLIK
                                    ↓
Eğitmen: Uyuşmazlık paneli → Video izle → Nihai kararı ver
```

---

## Ortam Değişkenleri (.env)

```env
# Veritabanı
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/smartproctor
DATABASE_URL_SYNC=postgresql+psycopg2://postgres:postgres@localhost:5432/smartproctor

# JWT
SECRET_KEY=super-secret-key-change-in-production-2024
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# Uygulama
APP_NAME=SmartProctor
DEBUG=True

# Dosya Yükleme
UPLOAD_DIR=./static/evidence
MAX_UPLOAD_SIZE=52428800
```

> **ÖNEMLİ**: Production ortamında `SECRET_KEY` mutlaka değiştirilmeli ve `DEBUG=False` yapılmalıdır.

---

## Kütüphane Listesi

### Backend (Python)

| Kütüphane | Versiyon | Kullanım |
|-----------|----------|----------|
| fastapi | 0.115.0 | Web framework |
| uvicorn | 0.30.6 | ASGI sunucu |
| sqlalchemy | 2.0.35 | ORM (async) |
| asyncpg | 0.29.0 | PostgreSQL async driver |
| psycopg2-binary | 2.9.9 | PostgreSQL sync driver |
| alembic | 1.13.2 | Veritabanı migrasyon |
| python-jose | 3.3.0 | JWT token |
| passlib + bcrypt | 1.7.4 / 4.0.1 | Şifre hashleme |
| python-multipart | 0.0.9 | Dosya yükleme |
| pydantic | 2.9.2 | Veri doğrulama |
| pydantic-settings | 2.5.2 | Ortam değişkenleri |
| python-dotenv | 1.0.1 | .env dosya okuma |
| aiofiles | 24.1.0 | Async dosya işlemleri |

### Frontend (JavaScript)

| Kütüphane | Versiyon | Kullanım |
|-----------|----------|----------|
| react | 18.3.1 | UI framework |
| react-dom | 18.3.1 | DOM render |
| react-router-dom | 6.26.2 | Sayfa yönlendirme |
| axios | 1.7.7 | HTTP istemci |
| lucide-react | 0.441.0 | İkonlar |
| vite | 5.4.4 | Build tool |
| tailwindcss | 3.4.10 | CSS framework |

---

## Lisans

Bu proje akademik amaçlı geliştirilmiştir.
