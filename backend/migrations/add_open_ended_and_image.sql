-- Migration: open_ended soru tipi ve image_url alanı ekleme
-- Bu dosyayı çalıştırarak mevcut veritabanını güncelleyin:
-- psql -U postgres -d smartproctor -f migrations/add_open_ended_and_image.sql

SET search_path TO smartproctor;

-- 1. question_type enum'una 'open_ended' değerini ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'open_ended'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'question_type')
    ) THEN
        ALTER TYPE smartproctor.question_type ADD VALUE 'open_ended';
    END IF;
END$$;

-- 2. questions tablosuna image_url kolonu ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'smartproctor'
        AND table_name = 'questions'
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE smartproctor.questions ADD COLUMN image_url VARCHAR(512);
    END IF;
END$$;
