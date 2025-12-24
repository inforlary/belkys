/*
  # KİKS Standartlarına Mevcut Durum ve Tüm Birimler Özellikleri Ekle

  1. Değişiklikler
    - `ic_kiks_main_standards` tablosuna `current_status` (mevcut durum) alanı eklenir
    - `ic_kiks_sub_standards` tablosuna `current_status` (mevcut durum) alanı eklenir
    - `ic_kiks_actions` tablosuna `current_status` (mevcut durum) alanı eklenir
    - `ic_kiks_main_standards` tablosuna `all_departments_responsible` (tüm birimler sorumlu) boolean alanı eklenir
    - `ic_kiks_main_standards` tablosuna `all_departments_collaboration` (tüm birimlerle işbirliği) boolean alanı eklenir
    - `ic_kiks_sub_standards` tablosuna `all_departments_responsible` (tüm birimler sorumlu) boolean alanı eklenir
    - `ic_kiks_sub_standards` tablosuna `all_departments_collaboration` (tüm birimlerle işbirliği) boolean alanı eklenir
    - `ic_kiks_actions` tablosuna `all_departments_responsible` (tüm birimler sorumlu) boolean alanı eklenir
    - `ic_kiks_actions` tablosuna `all_departments_collaboration` (tüm birimlerle işbirliği) boolean alanı eklenir
*/

-- Ana Standartlar için mevcut durum ve tüm birimler alanları
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_main_standards' AND column_name = 'current_status'
  ) THEN
    ALTER TABLE ic_kiks_main_standards ADD COLUMN current_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_main_standards' AND column_name = 'all_departments_responsible'
  ) THEN
    ALTER TABLE ic_kiks_main_standards ADD COLUMN all_departments_responsible boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_main_standards' AND column_name = 'all_departments_collaboration'
  ) THEN
    ALTER TABLE ic_kiks_main_standards ADD COLUMN all_departments_collaboration boolean DEFAULT false;
  END IF;
END $$;

-- Alt Standartlar için mevcut durum ve tüm birimler alanları
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_sub_standards' AND column_name = 'current_status'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards ADD COLUMN current_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_sub_standards' AND column_name = 'all_departments_responsible'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards ADD COLUMN all_departments_responsible boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_sub_standards' AND column_name = 'all_departments_collaboration'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards ADD COLUMN all_departments_collaboration boolean DEFAULT false;
  END IF;
END $$;

-- Eylemler için mevcut durum ve tüm birimler alanları
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_actions' AND column_name = 'current_status'
  ) THEN
    ALTER TABLE ic_kiks_actions ADD COLUMN current_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_actions' AND column_name = 'all_departments_responsible'
  ) THEN
    ALTER TABLE ic_kiks_actions ADD COLUMN all_departments_responsible boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_actions' AND column_name = 'all_departments_collaboration'
  ) THEN
    ALTER TABLE ic_kiks_actions ADD COLUMN all_departments_collaboration boolean DEFAULT false;
  END IF;
END $$;