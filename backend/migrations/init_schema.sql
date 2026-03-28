-- ============================================================================
-- SmartProctor — Online Sınav Gözetim Sistemi
-- Veritabanı Şeması (PostgreSQL) — GÜNCELLENMIŞ
-- ============================================================================

DROP SCHEMA IF EXISTS smartproctor CASCADE;
CREATE SCHEMA smartproctor;
SET search_path TO smartproctor;

-- 0. ENUM TİPLERİ
CREATE TYPE user_role AS ENUM ('student', 'instructor', 'proctor', 'admin');
CREATE TYPE exam_status AS ENUM ('draft', 'scheduled', 'active', 'completed', 'cancelled');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'open_ended');
CREATE TYPE session_status AS ENUM ('started', 'in_progress', 'submitted', 'timed_out', 'terminated');
CREATE TYPE violation_type AS ENUM (
    'TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'RIGHT_CLICK',
    'DEVTOOLS', 'KEYBOARD_SHORTCUT',
    'GAZE_LEFT', 'GAZE_RIGHT', 'HEAD_TURN',
    'NO_FACE', 'MULTIPLE_FACES', 'PHONE_DETECTED', 'MULTIPLE_PERSONS',
    'CONNECTION_LOST', 'OTHER'
);
CREATE TYPE verification_decision AS ENUM ('violation_confirmed', 'no_violation', 'pending');
CREATE TYPE conflict_resolution AS ENUM ('pending', 'violation_confirmed', 'no_violation');

-- 1. USERS
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            user_role NOT NULL DEFAULT 'student',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- 2. REFRESH TOKENS
CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(512) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_refresh_token UNIQUE (token)
);

-- 3. COURSES
CREATE TABLE courses (
    id            BIGSERIAL PRIMARY KEY,
    instructor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    code          VARCHAR(20) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_courses_code UNIQUE (code)
);

-- 4. COURSE ENROLLMENTS
CREATE TABLE course_enrollments (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment UNIQUE (course_id, student_id)
);

-- 5. EXAMS
CREATE TABLE exams (
    id                BIGSERIAL PRIMARY KEY,
    course_id         BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    status            exam_status NOT NULL DEFAULT 'draft',
    duration_minutes  INT NOT NULL,
    pass_score        NUMERIC(5,2),
    shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
    shuffle_options   BOOLEAN NOT NULL DEFAULT FALSE,
    start_time        TIMESTAMPTZ,
    end_time          TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. QUESTIONS
CREATE TABLE questions (
    id            BIGSERIAL PRIMARY KEY,
    exam_id       BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_type question_type NOT NULL DEFAULT 'multiple_choice',
    body          TEXT NOT NULL,
    image_url     VARCHAR(512),
    points        NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    sort_order    INT NOT NULL DEFAULT 0,
    explanation   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. OPTIONS
CREATE TABLE options (
    id          BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EXAM SESSIONS
CREATE TABLE exam_sessions (
    id               BIGSERIAL PRIMARY KEY,
    exam_id          BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           session_status NOT NULL DEFAULT 'started',
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at      TIMESTAMPTZ,
    ip_address       INET,
    user_agent       TEXT,
    tab_switch_count INT NOT NULL DEFAULT 0,
    score            NUMERIC(5,2),
    last_heartbeat   TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_per_exam UNIQUE (exam_id, student_id)
);

-- 9. STUDENT ANSWERS
CREATE TABLE student_answers (
    id                 BIGSERIAL PRIMARY KEY,
    session_id         BIGINT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id        BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option_id BIGINT REFERENCES options(id) ON DELETE SET NULL,
    is_correct         BOOLEAN,
    answered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_answer_per_question UNIQUE (session_id, question_id)
);

-- 10. VIOLATIONS
CREATE TABLE violations (
    id             BIGSERIAL PRIMARY KEY,
    session_id     BIGINT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    violation_type violation_type NOT NULL,
    confidence     NUMERIC(4,3),
    metadata       JSONB,
    video_path     VARCHAR(512),
    thumbnail_path VARCHAR(512),
    is_ai_violation BOOLEAN NOT NULL DEFAULT FALSE,
    detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PROCTOR ASSIGNMENTS
CREATE TABLE proctor_assignments (
    id          BIGSERIAL PRIMARY KEY,
    exam_id     BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    proctor_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_proctor_exam UNIQUE (exam_id, proctor_id)
);

-- 12. VIOLATION REVIEWS
CREATE TABLE violation_reviews (
    id           BIGSERIAL PRIMARY KEY,
    violation_id BIGINT NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
    proctor_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    decision     verification_decision NOT NULL DEFAULT 'pending',
    comment      TEXT,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_per_proctor UNIQUE (violation_id, proctor_id)
);

-- 13. CONFLICT RESOLUTIONS
CREATE TABLE conflict_resolutions (
    id             BIGSERIAL PRIMARY KEY,
    violation_id   BIGINT NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
    instructor_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    final_decision conflict_resolution NOT NULL DEFAULT 'pending',
    comment        TEXT,
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conflict_per_violation UNIQUE (violation_id)
);

-- 14. AUDIT LOGS
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   BIGINT,
    ip_address  INET,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. NOTIFICATIONS
CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    link       VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_enrollments_student ON course_enrollments(student_id);
CREATE INDEX idx_exams_course ON exams(course_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_questions_exam ON questions(exam_id, sort_order);
CREATE INDEX idx_options_question ON options(question_id, sort_order);
CREATE INDEX idx_sessions_student ON exam_sessions(student_id);
CREATE INDEX idx_sessions_status ON exam_sessions(status);
CREATE INDEX idx_sessions_heartbeat ON exam_sessions(last_heartbeat) WHERE status IN ('started', 'in_progress');
CREATE INDEX idx_answers_session ON student_answers(session_id);
CREATE INDEX idx_violations_session ON violations(session_id);
CREATE INDEX idx_violations_type ON violations(violation_type);
CREATE INDEX idx_violations_ai ON violations(is_ai_violation) WHERE is_ai_violation = TRUE;
CREATE INDEX idx_reviews_violation ON violation_reviews(violation_id);
CREATE INDEX idx_reviews_decision ON violation_reviews(decision);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION smartproctor.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'smartproctor' AND column_name = 'updated_at'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON smartproctor.%I
             FOR EACH ROW EXECUTE FUNCTION smartproctor.fn_set_updated_at();', t, t
        );
    END LOOP;
END;
$$;

-- SEED DATA (Password1! icin bcrypt hash)
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
('admin@smartproctor.io',      '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Admin',  'System',  'admin'),
('instructor@smartproctor.io', '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Ahmet',  'Yilmaz',  'instructor'),
('proctor1@smartproctor.io',   '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Ayse',   'Demir',   'proctor'),
('proctor2@smartproctor.io',   '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Fatma',  'Kaya',    'proctor'),
('student1@smartproctor.io',   '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Mehmet', 'Celik',   'student'),
('student2@smartproctor.io',   '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Elif',   'Ozturk',  'student'),
('student3@smartproctor.io',   '$2b$12$LJ3m5ZQxKOGe0MSDvJiSaOZ8G6YkBStJKrNaM5ZQqF1f6gKfiWHMa', 'Can',    'Arslan',  'student');

INSERT INTO courses (instructor_id, code, name, description) VALUES
(2, 'CS101', 'Bilgisayar Bilimine Giris', 'Temel programlama ve algoritmalar'),
(2, 'CS201', 'Veri Yapilari', 'Agaclar, grafikler ve hash tablolari');

INSERT INTO course_enrollments (course_id, student_id) VALUES
(1, 5), (1, 6), (1, 7), (2, 5), (2, 6);

INSERT INTO exams (course_id, title, description, status, duration_minutes, pass_score, start_time, end_time) VALUES
(1, 'Ara Sinav 1', 'Ilk 5 haftanin konulari', 'scheduled', 60, 50.00, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour'),
(1, 'Final Sinavi', 'Tum donem konulari', 'draft', 90, 60.00, NULL, NULL),
(2, 'Quiz 1', 'Bagli listeler ve yiginlar', 'active', 30, 40.00, NOW() - INTERVAL '10 min', NOW() + INTERVAL '20 min');

INSERT INTO questions (exam_id, question_type, body, points, sort_order) VALUES
(1, 'multiple_choice', 'Python''da bir degisken tanimlamak icin hangi anahtar kelime kullanilir?', 10, 1),
(1, 'multiple_choice', 'Hangisi bir dongu yapisi degildir?', 10, 2),
(1, 'true_false', 'Python yorumlanan (interpreted) bir dildir.', 5, 3);

INSERT INTO options (question_id, body, is_correct, sort_order) VALUES
(1, 'var', FALSE, 1), (1, 'let', FALSE, 2),
(1, 'Gerek yok, dogrudan yazilir', TRUE, 3), (1, 'dim', FALSE, 4),
(2, 'for', FALSE, 1), (2, 'while', FALSE, 2),
(2, 'loop', TRUE, 3), (2, 'do-while (C benzeri)', FALSE, 4),
(3, 'Dogru', TRUE, 1), (3, 'Yanlis', FALSE, 2);

INSERT INTO proctor_assignments (exam_id, proctor_id) VALUES (1, 3), (1, 4), (3, 3), (3, 4);
