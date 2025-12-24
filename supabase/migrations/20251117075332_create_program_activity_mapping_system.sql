/*
  # Program-Faaliyet Eşleştirme ve Ekonomik Kod Sistemi

  1. Yeni Tablolar
    - `program_activity_mappings`
      - Müdürlüklerin program yapısını stratejik plandaki faaliyetlerle eşleştirme
      - Program, alt program ve faaliyet bilgileri
      - Stratejik plandaki faaliyet ile bağlantı
      - Her müdürlük için benzersiz eşleştirmeler
    
    - `mapped_economic_codes`
      - Eşleştirilen yapılara ekonomik kod girişleri
      - Kurumsal kod, ekonomik kod ve finansman tipi seçimi
      - Yıllara göre tutar girişi (2026, 2027, 2028)
      - Onay süreci için durum takibi

  2. Güvenlik
    - Her iki tablo için RLS aktif
    - Kullanıcılar kendi organizasyonlarının verilerini görebilir
    - Müdürlük yöneticileri kendi müdürlüklerinin kayıtlarını yönetebilir
    - Mali hizmetler ve yöneticiler tüm kayıtları görebilir

  3. İlişkiler
    - Organizations ile bağlantı
    - Departments ile bağlantı
    - Programs ve Sub_programs ile bağlantı
    - Strategic plan activities ile bağlantı
    - Budget codes ile bağlantı
*/

-- Program-Faaliyet Eşleştirme Tablosu
CREATE TABLE IF NOT EXISTS program_activity_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Program Yapısı
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  sub_program_id uuid NOT NULL REFERENCES sub_programs(id) ON DELETE CASCADE,
  activity_code text NOT NULL,
  activity_name text NOT NULL,
  
  -- Stratejik Plan Faaliyeti ile Eşleştirme
  strategic_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  
  -- Açıklama ve Notlar
  description text,
  notes text,
  
  -- Durum
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- Audit
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  
  -- Benzersizlik: Her müdürlük için aynı program-alt program-faaliyet kombinasyonu bir kez
  UNIQUE(organization_id, department_id, program_id, sub_program_id, activity_code)
);

-- Eşleştirilen Yapıya Ekonomik Kod Girişi Tablosu
CREATE TABLE IF NOT EXISTS mapped_economic_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mapping_id uuid NOT NULL REFERENCES program_activity_mappings(id) ON DELETE CASCADE,
  
  -- Kod Seçimleri
  institutional_code_id uuid REFERENCES budget_institutional_codes(id) ON DELETE RESTRICT,
  economic_code_id uuid REFERENCES expense_economic_codes(id) ON DELETE RESTRICT,
  financing_type_id uuid REFERENCES financing_types(id) ON DELETE RESTRICT,
  
  -- Açıklama
  description text NOT NULL,
  
  -- Yıllara Göre Tutarlar
  amount_2026 decimal(15,2) DEFAULT 0,
  amount_2027 decimal(15,2) DEFAULT 0,
  amount_2028 decimal(15,2) DEFAULT 0,
  
  -- Onay Süreci
  status text DEFAULT 'draft' CHECK (status IN (
    'draft',
    'submitted',
    'finance_review',
    'finance_approved',
    'finance_rejected',
    'approved',
    'rejected'
  )),
  
  -- Onay Notları
  finance_notes text,
  finance_reviewed_by uuid REFERENCES profiles(id),
  finance_reviewed_at timestamptz,
  
  final_notes text,
  final_approved_by uuid REFERENCES profiles(id),
  final_approved_at timestamptz,
  
  -- Audit
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_org ON program_activity_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_dept ON program_activity_mappings(department_id);
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_program ON program_activity_mappings(program_id);
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_sub_program ON program_activity_mappings(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_strategic ON program_activity_mappings(strategic_activity_id);
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_status ON program_activity_mappings(status);

CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_org ON mapped_economic_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_mapping ON mapped_economic_codes(mapping_id);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_status ON mapped_economic_codes(status);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_created_by ON mapped_economic_codes(created_by);

-- Triggers
DROP TRIGGER IF EXISTS update_program_activity_mappings_updated_at ON program_activity_mappings;
CREATE TRIGGER update_program_activity_mappings_updated_at
  BEFORE UPDATE ON program_activity_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mapped_economic_codes_updated_at ON mapped_economic_codes;
CREATE TRIGGER update_mapped_economic_codes_updated_at
  BEFORE UPDATE ON mapped_economic_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies

-- program_activity_mappings
ALTER TABLE program_activity_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mappings in their organization"
  ON program_activity_mappings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Department managers can insert mappings for their department"
  ON program_activity_mappings FOR INSERT
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
        AND role IN ('admin', 'finance_manager')
      )
    )
  );

CREATE POLICY "Department managers can update their mappings"
  ON program_activity_mappings FOR UPDATE
  TO authenticated
  USING (
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
        AND role IN ('admin', 'finance_manager')
      )
    )
  )
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
        AND role IN ('admin', 'finance_manager')
      )
    )
  );

CREATE POLICY "Admins can delete mappings"
  ON program_activity_mappings FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'finance_manager')
    )
  );

-- mapped_economic_codes
ALTER TABLE mapped_economic_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view economic codes in their organization"
  ON mapped_economic_codes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Department users can insert economic codes"
  ON mapped_economic_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND mapping_id IN (
      SELECT m.id FROM program_activity_mappings m
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE m.department_id = p.department_id
      OR p.role IN ('admin', 'finance_manager')
    )
  );

CREATE POLICY "Users can update their economic codes"
  ON mapped_economic_codes FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'finance_manager')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and creators can delete economic codes"
  ON mapped_economic_codes FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'finance_manager')
      )
    )
  );
