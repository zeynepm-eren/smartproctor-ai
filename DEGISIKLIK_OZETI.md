# SmartProctor — Değişiklik Özeti ve Uygulama Talimatları

## Yapılan Düzeltmeler (23 dosya)

### 1. VERİTABANI (init_schema.sql)
- `user_role` enum'a `admin` eklendi
- `violation_type` enum'a yeni tipler eklendi: NO_FACE, MULTIPLE_FACES, HEAD_TURN, KEYBOARD_SHORTCUT, CONNECTION_LOST
- `exam_sessions` tablosuna `last_heartbeat` kolonu eklendi
- `violations` tablosuna `is_ai_violation` kolonu eklendi (AI vs tarayıcı ayrımı)
- `exams` tablosundan `max_tab_switches` kaldırıldı
- `courses.instructor_id` artık NULL olabilir (SET NULL on delete)
- Admin seed kullanıcısı eklendi: admin@smartproctor.io
- Her sınava 2 gözetmen atanacak şekilde seed data güncellendi

### 2. BACKEND MODELLERİ
- **violation.py**: `is_ai_violation` alanı eklendi, `AI_VIOLATION_TYPES` ve `BROWSER_VIOLATION_TYPES` setleri tanımlandı
- **session.py**: `last_heartbeat` alanı eklendi
- **exam.py**: `max_tab_switches` kaldırıldı

### 3. BACKEND ROUTER'LAR
- **auth.py**: Eğitmen/Gözetmen kaydı için gizli anahtar kontrolü eklendi
  - Eğitmen anahtarı: `SMARTPROCTOR_INSTRUCTOR_2024`
  - Gözetmen anahtarı: `SMARTPROCTOR_PROCTOR_2024`
- **violations.py**: Tamamen yeniden yazıldı
  - AI ihlalleri → 2 rastgele gözetmene atanır
  - Tarayıcı ihlalleri → sadece kayıt edilir (rapor için)
  - İki gözetmen de kopya derse → eğitmene detaylı rapor
  - Oturum ihlal raporu endpoint'i eklendi
- **sessions.py**: Sekme değişimi artık sınavı sonlandırmaz
- **exams.py**: Sınav silme, soru silme/düzenleme endpoint'leri eklendi, otomatik 2 gözetmen atama
- **extras.py**: Kullanıcı silme endpoint'i eklendi, gözetmen atama kaldırıldı
- **main.py**: Temizlendi, heartbeat router ayrı dahil edilmedi

### 4. BACKEND SCHEMAS
- **auth.py**: `secret_key` alanı eklendi
- **exam.py**: `max_tab_switches` kaldırıldı, `QuestionUpdate` schema eklendi

### 5. FRONTEND
- **api.js**: `violationApi.js` uyumluluk fonksiyonları eklendi, silme endpoint'leri eklendi
- **violationApi.js**: Yeni uyumluluk dosyası oluşturuldu (hook'lar bunu import ediyor)
- **Register.jsx**: Eğitmen/Gözetmen için gizli anahtar alanı eklendi
- **AdminUsers.jsx**: Kullanıcı silme butonu eklendi
- **App.jsx**: Gözetmen ata rotası kaldırıldı
- **Navbar.jsx**: Gözetmen ata linki kaldırıldı
- **StudentDashboard.jsx**: Bitirilen sınavda "devam et" yerine "tamamlandı" gösterilir
- **ExamCreate.jsx**: max_tab_switches ve durum seçeneği kaldırıldı
- **ExamEdit.jsx**: Sınav silme ve soru silme butonları eklendi
- **ExamInterface.jsx**: İlk tıkta başlatma hatası düzeltildi (retry), bitirme sonrası geri dönüş engeli
- **vite.config.js**: Proxy zaten doğru (8000)

### 6. KALDIRILMASI GEREKENLER
- `backend/package-lock.json` — gereksiz (Python projesi)
- `backend/alembic/` klasörü — bozuk migration, init_schema.sql kullanılıyor
- `backend/migrations/002_heartbeat_violations.sql` — init_schema.sql'e entegre edildi
- `backend/app/routers/heartbeat.py` — violations.py içine entegre edildi
- `backend/app/services/zombie_hunter.py` — heartbeat.py servisi yeterli
- `frontend/src/components/instructor/ProctorAssign.jsx` — kaldırıldı (otomatik atama)
- `docker-compose.yml` — Docker kullanılmıyor

---

## Uygulama Adımları

### 1. Veritabanını sıfırla ve yeni şemayı yükle
```bash
psql -U postgres -c "DROP DATABASE IF EXISTS smartproctor;"
psql -U postgres -c "CREATE DATABASE smartproctor;"
psql -U postgres -d smartproctor -f backend/migrations/init_schema.sql
```

### 2. Değiştirilmiş dosyaları kopyala
Çıktıdaki dosyaları projenizin ilgili klasörlerine kopyalayın.

### 3. Gereksiz dosyaları silin
```bash
rm -f backend/package-lock.json
rm -rf backend/alembic/
rm -f backend/migrations/002_heartbeat_violations.sql
rm -f backend/app/routers/heartbeat.py
rm -f backend/app/services/zombie_hunter.py
rm -f frontend/src/components/instructor/ProctorAssign.jsx
rm -f docker-compose.yml
```

### 4. Backend'i başlatın
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Frontend'i başlatın
```bash
cd frontend
npm run dev
```

### 6. Demo Hesaplar (Şifre: Password1!)
| Rol      | Email                          |
|----------|--------------------------------|
| Admin    | admin@smartproctor.io          |
| Eğitmen  | instructor@smartproctor.io     |
| Gözetmen | proctor1@smartproctor.io       |
| Gözetmen | proctor2@smartproctor.io       |
| Öğrenci  | student1@smartproctor.io       |
| Öğrenci  | student2@smartproctor.io       |
| Öğrenci  | student3@smartproctor.io       |
