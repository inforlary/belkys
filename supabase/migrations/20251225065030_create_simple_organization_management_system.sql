/*
  # Basit Organizasyon Yönetimi Sistemi

  ## Amaç
  İç Kontrol planından bağımsız, organizasyon bazlı basit bir ünvan ve görev yönetimi sistemi.

  ## Yeni Tablolar

  ### 1. organization_positions (Ünvan Tanımları)
  - `id` - Birincil anahtar
  - `organization_id` - Organizasyon
  - `code` - Ünvan kodu (otomatik)
  - `title` - Ünvan adı (örn: Müdür, Şef, Uzman)
  - `description` - Açıklama
  - `level` - Seviye (üst_yönetim, orta_kademe, alt_kademe, operasyonel)
  - `created_at`, `updated_at`

  ### 2. department_position_duties (Birim-Ünvan Görevleri)
  - `id` - Birincil anahtar
  - `organization_id` - Organizasyon
  - `department_id` - Birim
  - `position_id` - Ünvan
  - `duty_title` - Görev başlığı
  - `duty_description` - Görev açıklaması
  - `responsibility_area` - Sorumluluk alanı
  - `authority_level` - Yetki seviyesi
  - `display_order` - Sıralama
  - `created_at`, `updated_at`

  ### 3. user_position_assignments (Personel-Ünvan Atamaları)
  - `id` - Birincil anahtar
  - `organization_id` - Organizasyon
  - `user_id` - Personel
  - `department_id` - Atandığı birim
  - `position_id` - Ünvan
  - `start_date` - Başlangıç tarihi
  - `end_date` - Bitiş tarihi (null = aktif)
  - `is_active` - Aktif mi?
  - `assignment_type` - Atama türü (asıl, vekil, geçici)
  - `notes` - Notlar
  - `created_at`, `updated_at`

  ## Güvenlik
  - Tüm tablolar için RLS etkin
  - Admin ve super_admin tam erişim
  - Diğer kullanıcılar sadece kendi organizasyonlarını görür
*/

-- 1. Ünvan Tanımları
CREATE TABLE IF NOT EXISTS organization_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  level text NOT NULL CHECK (level IN ('üst_yönetim', 'orta_kademe', 'alt_kademe', 'operasyonel')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code),
  UNIQUE(organization_id, title)
);

CREATE INDEX IF NOT EXISTS idx_org_positions_org ON organization_positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_positions_level ON organization_positions(organization_id, level);

-- Otomatik kod üretimi
CREATE OR REPLACE FUNCTION generate_position_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'UNV-' || LPAD(
      (
        SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) + 1
        FROM organization_positions
        WHERE organization_id = NEW.organization_id
        AND code ~ '^UNV-[0-9]+$'
      )::text, 
      4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_generate_position_code
  BEFORE INSERT ON organization_positions
  FOR EACH ROW
  EXECUTE FUNCTION generate_position_code();

-- RLS Politikaları
ALTER TABLE organization_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin tam erişim - positions"
  ON organization_positions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Organizasyon kullanıcıları görüntüler - positions"
  ON organization_positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_positions.organization_id
    )
  );

CREATE POLICY "Admin ekler/günceller - positions"
  ON organization_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_positions.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin günceller - positions"
  ON organization_positions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_positions.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin siler - positions"
  ON organization_positions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_positions.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2. Birim-Ünvan Görevleri
CREATE TABLE IF NOT EXISTS department_position_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES organization_positions(id) ON DELETE CASCADE,
  duty_title text NOT NULL,
  duty_description text,
  responsibility_area text,
  authority_level text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_pos_duties_org ON department_position_duties(organization_id);
CREATE INDEX IF NOT EXISTS idx_dept_pos_duties_dept ON department_position_duties(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_pos_duties_pos ON department_position_duties(position_id);
CREATE INDEX IF NOT EXISTS idx_dept_pos_duties_combo ON department_position_duties(department_id, position_id);

ALTER TABLE department_position_duties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin tam erişim - duties"
  ON department_position_duties FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Organizasyon kullanıcıları görüntüler - duties"
  ON department_position_duties FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_position_duties.organization_id
    )
  );

CREATE POLICY "Admin ve birim müdürleri ekler - duties"
  ON department_position_duties FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_position_duties.organization_id
      AND (
        profiles.role IN ('admin', 'super_admin')
        OR (profiles.role = 'director' AND profiles.department_id = department_position_duties.department_id)
      )
    )
  );

CREATE POLICY "Admin ve birim müdürleri günceller - duties"
  ON department_position_duties FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_position_duties.organization_id
      AND (
        profiles.role IN ('admin', 'super_admin')
        OR (profiles.role = 'director' AND profiles.department_id = department_position_duties.department_id)
      )
    )
  );

CREATE POLICY "Admin ve birim müdürleri siler - duties"
  ON department_position_duties FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_position_duties.organization_id
      AND (
        profiles.role IN ('admin', 'super_admin')
        OR (profiles.role = 'director' AND profiles.department_id = department_position_duties.department_id)
      )
    )
  );

-- 3. Personel-Ünvan Atamaları
CREATE TABLE IF NOT EXISTS user_position_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES organization_positions(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  assignment_type text NOT NULL DEFAULT 'asıl' CHECK (assignment_type IN ('asıl', 'vekil', 'geçici')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_user_pos_assign_org ON user_position_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_pos_assign_user ON user_position_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pos_assign_dept ON user_position_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_pos_assign_pos ON user_position_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_user_pos_assign_active ON user_position_assignments(is_active) WHERE is_active = true;

ALTER TABLE user_position_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin tam erişim - assignments"
  ON user_position_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Organizasyon kullanıcıları görüntüler - assignments"
  ON user_position_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = user_position_assignments.organization_id
    )
  );

CREATE POLICY "Admin ekler/günceller - assignments"
  ON user_position_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = user_position_assignments.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin günceller - assignments"
  ON user_position_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = user_position_assignments.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin siler - assignments"
  ON user_position_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = user_position_assignments.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );
