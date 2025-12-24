/*
  # Bütçe Performans Programı Modülü
  
  Çok yıllı bütçe performans izleme ve program yönetimi sistemi.
  
  ## Yeni Tablolar
  
  ### 1. budget_performance_program_mappings
  Müdürlük-Program-Alt Program-Faaliyet eşleştirmeleri
  - `id` (uuid, primary key)
  - `organization_id` (uuid, organizations referansı)
  - `fiscal_year` (integer) - Mali yıl
  - `department_id` (uuid, departments referansı)
  - `program_id` (uuid, programs referansı)
  - `sub_program_id` (uuid, sub_programs referansı)
  - `activity_id` (uuid, activities referansı) - Opsiyonel
  - `status` (text) - draft, submitted, approved, rejected
  - `submitted_at` (timestamptz)
  - `submitted_by` (uuid)
  - `approved_at` (timestamptz)
  - `approved_by` (uuid)
  - `rejection_reason` (text)
  - `notes` (text)
  - `created_at`, `updated_at`
  
  ### 2. budget_performance_activity_justifications
  Faaliyet Gerekçesi Formları
  - `id` (uuid, primary key)
  - `organization_id` (uuid)
  - `fiscal_year` (integer)
  - `department_id` (uuid)
  - `mapping_id` (uuid, program_mappings referansı)
  - `form_data` (jsonb) - Form içeriği (sonra doldurulacak)
  - `status` (text) - draft, submitted, under_review, approved, rejected
  - `submitted_at`, `submitted_by`
  - `reviewed_at`, `reviewed_by`
  - `reviewer_notes` (text)
  - `created_at`, `updated_at`
  
  ### 3. budget_performance_program_information
  Program Performans Bilgisi Formları
  - `id` (uuid, primary key)
  - `organization_id` (uuid)
  - `fiscal_year` (integer)
  - `department_id` (uuid)
  - `mapping_id` (uuid)
  - `form_data` (jsonb) - Form içeriği
  - `status` (text)
  - `submitted_at`, `submitted_by`
  - `reviewed_at`, `reviewed_by`
  - `reviewer_notes` (text)
  - `created_at`, `updated_at`
  
  ### 4. budget_performance_historical_data
  Geçmiş yıl ekonomik kod verileri
  - `id` (uuid, primary key)
  - `organization_id` (uuid)
  - `fiscal_year` (integer) - Hangi yıla ait
  - `data_type` (text) - expense, revenue
  - `economic_code_id` (uuid) - Gider veya gelir kodu
  - `program_id` (uuid) - Opsiyonel
  - `sub_program_id` (uuid) - Opsiyonel
  - `department_id` (uuid) - Opsiyonel
  - `budget_amount` (decimal) - Bütçe tutarı
  - `actual_amount` (decimal) - Gerçekleşen tutar
  - `description` (text)
  - `created_at`, `updated_at`
  
  ## Güvenlik
  - Her tablo için RLS etkin
  - Organizasyon bazlı erişim kontrolü
  - Rol bazlı (user, manager, admin) yetkilendirme
  - Onaylanmış kayıtlar kilitli (sadece okuma)
  
  ## İndeksler
  - Organizasyon, mali yıl ve departman bazlı hızlı sorgular için
  - Status ve tarih bazlı filtreleme için
*/

-- 1. Müdürlük-Program Eşleştirmeleri
CREATE TABLE IF NOT EXISTS budget_performance_program_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  sub_program_id uuid NOT NULL REFERENCES sub_programs(id) ON DELETE RESTRICT,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  rejection_reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique index for mappings (allows multiple NULL activity_id values)
CREATE UNIQUE INDEX IF NOT EXISTS unique_mapping_with_activity 
  ON budget_performance_program_mappings(organization_id, fiscal_year, department_id, program_id, sub_program_id, activity_id)
  WHERE activity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_mapping_without_activity
  ON budget_performance_program_mappings(organization_id, fiscal_year, department_id, program_id, sub_program_id)
  WHERE activity_id IS NULL;

-- 2. Faaliyet Gerekçesi Formları
CREATE TABLE IF NOT EXISTS budget_performance_activity_justifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  mapping_id uuid NOT NULL REFERENCES budget_performance_program_mappings(id) ON DELETE CASCADE,
  form_data jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  reviewer_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(mapping_id, fiscal_year)
);

-- 3. Program Performans Bilgisi
CREATE TABLE IF NOT EXISTS budget_performance_program_information (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  mapping_id uuid NOT NULL REFERENCES budget_performance_program_mappings(id) ON DELETE CASCADE,
  form_data jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  reviewer_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(mapping_id, fiscal_year)
);

-- 4. Geçmiş Yıl Verileri
CREATE TABLE IF NOT EXISTS budget_performance_historical_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('expense', 'revenue')),
  economic_code_id uuid NOT NULL,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  sub_program_id uuid REFERENCES sub_programs(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  budget_amount decimal(15,2) DEFAULT 0,
  actual_amount decimal(15,2) DEFAULT 0,
  realization_rate decimal(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN budget_amount > 0 THEN (actual_amount / budget_amount * 100)
      ELSE 0 
    END
  ) STORED,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_bp_mappings_org_year ON budget_performance_program_mappings(organization_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_bp_mappings_dept ON budget_performance_program_mappings(department_id);
CREATE INDEX IF NOT EXISTS idx_bp_mappings_status ON budget_performance_program_mappings(status);
CREATE INDEX IF NOT EXISTS idx_bp_mappings_program ON budget_performance_program_mappings(program_id, sub_program_id);

CREATE INDEX IF NOT EXISTS idx_bp_justifications_org_year ON budget_performance_activity_justifications(organization_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_bp_justifications_dept ON budget_performance_activity_justifications(department_id);
CREATE INDEX IF NOT EXISTS idx_bp_justifications_status ON budget_performance_activity_justifications(status);

CREATE INDEX IF NOT EXISTS idx_bp_program_info_org_year ON budget_performance_program_information(organization_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_bp_program_info_dept ON budget_performance_program_information(department_id);
CREATE INDEX IF NOT EXISTS idx_bp_program_info_status ON budget_performance_program_information(status);

CREATE INDEX IF NOT EXISTS idx_bp_historical_org_year ON budget_performance_historical_data(organization_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_bp_historical_type ON budget_performance_historical_data(data_type);
CREATE INDEX IF NOT EXISTS idx_bp_historical_program ON budget_performance_historical_data(program_id, sub_program_id);
CREATE INDEX IF NOT EXISTS idx_bp_historical_dept ON budget_performance_historical_data(department_id);

-- RLS Politikaları

-- budget_performance_program_mappings
ALTER TABLE budget_performance_program_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization mappings"
  ON budget_performance_program_mappings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users and managers can insert mappings"
  ON budget_performance_program_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can update draft mappings"
  ON budget_performance_program_mappings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND status = 'draft'
    AND (
      department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update all mappings"
  ON budget_performance_program_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_program_mappings.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete mappings"
  ON budget_performance_program_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_program_mappings.organization_id
      AND role = 'admin'
    )
  );

-- budget_performance_activity_justifications
ALTER TABLE budget_performance_activity_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization justifications"
  ON budget_performance_activity_justifications FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert justifications"
  ON budget_performance_activity_justifications FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM departments WHERE id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can update draft justifications"
  ON budget_performance_activity_justifications FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND status IN ('draft', 'rejected')
  );

CREATE POLICY "Admins can update all justifications"
  ON budget_performance_activity_justifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_activity_justifications.organization_id
      AND role = 'admin'
    )
  );

-- budget_performance_program_information
ALTER TABLE budget_performance_program_information ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization program info"
  ON budget_performance_program_information FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert program info"
  ON budget_performance_program_information FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM departments WHERE id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can update draft program info"
  ON budget_performance_program_information FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND status IN ('draft', 'rejected')
  );

CREATE POLICY "Admins can update all program info"
  ON budget_performance_program_information FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_program_information.organization_id
      AND role = 'admin'
    )
  );

-- budget_performance_historical_data
ALTER TABLE budget_performance_historical_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization historical data"
  ON budget_performance_historical_data FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert historical data"
  ON budget_performance_historical_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_historical_data.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update historical data"
  ON budget_performance_historical_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_historical_data.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete historical data"
  ON budget_performance_historical_data FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_performance_historical_data.organization_id
      AND role = 'admin'
    )
  );

-- Güncelleme trigger'ları
CREATE OR REPLACE FUNCTION update_budget_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bp_mappings_updated_at
  BEFORE UPDATE ON budget_performance_program_mappings
  FOR EACH ROW EXECUTE FUNCTION update_budget_performance_updated_at();

CREATE TRIGGER update_bp_justifications_updated_at
  BEFORE UPDATE ON budget_performance_activity_justifications
  FOR EACH ROW EXECUTE FUNCTION update_budget_performance_updated_at();

CREATE TRIGGER update_bp_program_info_updated_at
  BEFORE UPDATE ON budget_performance_program_information
  FOR EACH ROW EXECUTE FUNCTION update_budget_performance_updated_at();

CREATE TRIGGER update_bp_historical_updated_at
  BEFORE UPDATE ON budget_performance_historical_data
  FOR EACH ROW EXECUTE FUNCTION update_budget_performance_updated_at();
