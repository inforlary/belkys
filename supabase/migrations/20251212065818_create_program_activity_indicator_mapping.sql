/*
  # Performans Programı Faaliyet-Gösterge Eşleştirme Sistemi

  1. Yeni Tablolar
    - `program_activity_indicator_mappings`
      - Departmanların performans programı faaliyetlerini stratejik plan göstergeleriyle eşleştirme
      - Her gösterge sadece bir kez kullanılabilir (unique constraint)
      - Hiyerarşik yapı: Birim -> Program -> Alt Program -> Faaliyet -> Göstergeler
      - Bir faaliyet için birden fazla gösterge eklenebilir
      - Her birime birden fazla program eklenebilir

  2. İş Mantığı
    - Yönetici önce birim seçer
    - Seçilen birime program/alt program/faaliyet atar
    - Faaliyet seçildikten sonra ilgili birimin göstergelerini ekleyebilir
    - Her gösterge sadece bir kez kullanılabilir (başka programa eklenemez)
    - Aynı faaliyet için aynı gösterge tekrar eklenemez

  3. Güvenlik
    - RLS politikaları ile organizasyon bazlı erişim kontrolü
    - Sadece yetkili kullanıcılar eşleştirme yapabilir
    - Super admin tüm verilere erişebilir
*/

-- Program Activity Indicator Mappings Table
CREATE TABLE IF NOT EXISTS program_activity_indicator_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Birim
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,

  -- Performans Programı Hiyerarşisi
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  sub_program_id uuid NOT NULL REFERENCES sub_programs(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES sub_program_activities(id) ON DELETE CASCADE,

  -- Stratejik Plan Göstergesi
  indicator_id uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,

  -- Metadata
  is_active boolean DEFAULT true,
  notes text,

  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Her gösterge sadece bir kez kullanılabilir
  CONSTRAINT unique_indicator_usage UNIQUE (indicator_id),

  -- Aynı faaliyet için aynı gösterge tekrar eklenemez (ek kontrol)
  CONSTRAINT unique_activity_indicator UNIQUE (activity_id, indicator_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pai_mappings_org ON program_activity_indicator_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_pai_mappings_dept ON program_activity_indicator_mappings(department_id);
CREATE INDEX IF NOT EXISTS idx_pai_mappings_program ON program_activity_indicator_mappings(program_id);
CREATE INDEX IF NOT EXISTS idx_pai_mappings_sub_program ON program_activity_indicator_mappings(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_pai_mappings_activity ON program_activity_indicator_mappings(activity_id);
CREATE INDEX IF NOT EXISTS idx_pai_mappings_indicator ON program_activity_indicator_mappings(indicator_id);
CREATE INDEX IF NOT EXISTS idx_pai_mappings_active ON program_activity_indicator_mappings(is_active);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_pai_mappings_updated_at ON program_activity_indicator_mappings;
CREATE TRIGGER update_pai_mappings_updated_at
  BEFORE UPDATE ON program_activity_indicator_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE program_activity_indicator_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: Users can view mappings in their organization
CREATE POLICY "Users can view indicator mappings in their organization"
  ON program_activity_indicator_mappings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- SELECT: Super admins can view all mappings
CREATE POLICY "Super admins can view all indicator mappings"
  ON program_activity_indicator_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- INSERT: Admins and managers can insert mappings
CREATE POLICY "Admins can insert indicator mappings"
  ON program_activity_indicator_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = program_activity_indicator_mappings.organization_id
      AND role IN ('admin', 'vice_president', 'manager')
    )
  );

-- INSERT: Super admins can insert mappings
CREATE POLICY "Super admins can insert indicator mappings"
  ON program_activity_indicator_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- UPDATE: Admins and managers can update mappings
CREATE POLICY "Admins can update indicator mappings"
  ON program_activity_indicator_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = program_activity_indicator_mappings.organization_id
      AND role IN ('admin', 'vice_president', 'manager')
    )
  );

-- UPDATE: Super admins can update mappings
CREATE POLICY "Super admins can update indicator mappings"
  ON program_activity_indicator_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- DELETE: Admins can delete mappings
CREATE POLICY "Admins can delete indicator mappings"
  ON program_activity_indicator_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = program_activity_indicator_mappings.organization_id
      AND role IN ('admin', 'vice_president')
    )
  );

-- DELETE: Super admins can delete mappings
CREATE POLICY "Super admins can delete indicator mappings"
  ON program_activity_indicator_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );
