/*
  # Sistem Birimlerini Departments Tablosuna Ekle

  1. Değişiklikler
    - `organization_id` ve `code` nullable yapılır (sistem birimleri için)
    - `is_system_unit` boolean alanı eklenir
    - Sistem birimleri eklenir: İç Denetçi, Üst Yönetim, vb.
  
  2. Sistem Birimleri
    - İç Denetçi
    - Üst Yönetim
    - Kalite Yönetim Birimi
    - Strateji Geliştirme Dairesi Başkanlığı
  
  3. Notlar
    - Sistem birimleri organization_id NULL olarak kaydedilir
    - Sistem birimleri code ile de işaretlenir (SYS-001, SYS-002, vb.)
    - is_system_unit = true ile işaretlenir
    - Tüm organizasyonlar bu birimleri görebilir
*/

-- organization_id ve code'u nullable yap
ALTER TABLE departments ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE departments ALTER COLUMN code DROP NOT NULL;

-- is_system_unit alanını ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'departments' AND column_name = 'is_system_unit'
  ) THEN
    ALTER TABLE departments ADD COLUMN is_system_unit boolean DEFAULT false;
  END IF;
END $$;

-- Sistem birimlerini ekle
DO $$
BEGIN
  -- İç Denetçi
  IF NOT EXISTS (SELECT 1 FROM departments WHERE code = 'SYS-001') THEN
    INSERT INTO departments (id, name, code, organization_id, is_system_unit, created_at, updated_at)
    VALUES (gen_random_uuid(), 'İç Denetçi', 'SYS-001', NULL, true, now(), now());
  END IF;

  -- Üst Yönetim
  IF NOT EXISTS (SELECT 1 FROM departments WHERE code = 'SYS-002') THEN
    INSERT INTO departments (id, name, code, organization_id, is_system_unit, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Üst Yönetim', 'SYS-002', NULL, true, now(), now());
  END IF;

  -- Kalite Yönetim Birimi
  IF NOT EXISTS (SELECT 1 FROM departments WHERE code = 'SYS-003') THEN
    INSERT INTO departments (id, name, code, organization_id, is_system_unit, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Kalite Yönetim Birimi', 'SYS-003', NULL, true, now(), now());
  END IF;

  -- Strateji Geliştirme Dairesi Başkanlığı
  IF NOT EXISTS (SELECT 1 FROM departments WHERE code = 'SYS-004') THEN
    INSERT INTO departments (id, name, code, organization_id, is_system_unit, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Strateji Geliştirme Dairesi Başkanlığı', 'SYS-004', NULL, true, now(), now());
  END IF;
END $$;

-- RLS politikalarını güncelle
DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;

CREATE POLICY "Users can view departments in their organization"
  ON departments
  FOR SELECT
  TO authenticated
  USING (
    is_system_unit = true
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_departments_is_system_unit ON departments(is_system_unit) WHERE is_system_unit = true;
CREATE INDEX IF NOT EXISTS idx_departments_org_system ON departments(organization_id, is_system_unit);
