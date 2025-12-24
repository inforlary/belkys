/*
  # Departman Program Eşleştirme ve Çok Yıllı Bütçe Sistemi

  1. Yeni Tablolar
    - `department_program_mappings`
      - Departmanların program/alt program/faaliyet eşleştirmelerini tutar
      - Hiyerarşik yapıyı destekler (program -> alt program -> faaliyet)
      - Her seviyede eşleştirme yapılabilir
    
    - `multi_year_budget_entries`
      - Her eşleşme için ekonomik kod bazında çok yıllı bütçe verileri
      - Yıl bazında: geçmiş veriler (2024), mevcut yıl (2025), tahminler (2026-2028)
      - Her yıl için: bütçe türü (actual/current/budget/forecast), dönem (monthly), tutarlar
    
    - `budget_year_settings`
      - Organizasyon bazında yıl ayarları
      - Hangi yılların aktif olduğu, yıl türleri (past/current/future)

  2. Özellikler
    - Departmanlar birden fazla program/alt program/faaliyetle eşleştirilebilir
    - Her faaliyet için ekonomik kodlar seçilebilir
    - Her kod için çok yıllı bütçe girişi
    - Aylık/yıllık dönem desteği
    - Bütçe türü: actual (gerçekleşen), current (mevcut), budget (bütçe), forecast (tahmin)

  3. Güvenlik
    - RLS politikaları ile organizasyon bazlı erişim kontrolü
    - Sadece yetkili kullanıcılar eşleştirme yapabilir
    - Super admin tüm verilere erişebilir
*/

-- Department Program Mappings Table
CREATE TABLE IF NOT EXISTS department_program_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Hiyerarşik yapı - isteğe bağlı alanlar
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  sub_program_id uuid REFERENCES sub_programs(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES sub_program_activities(id) ON DELETE CASCADE,
  
  -- Metadata
  is_active boolean DEFAULT true,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  
  -- En az bir seviye seçilmeli
  CONSTRAINT at_least_one_level CHECK (
    program_id IS NOT NULL OR 
    sub_program_id IS NOT NULL OR 
    activity_id IS NOT NULL
  ),
  
  -- Aynı eşleştirme bir kez yapılabilir
  CONSTRAINT unique_mapping UNIQUE NULLS NOT DISTINCT (organization_id, department_id, program_id, sub_program_id, activity_id)
);

-- Budget Year Settings Table
CREATE TABLE IF NOT EXISTS budget_year_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  year integer NOT NULL,
  year_type text NOT NULL CHECK (year_type IN ('past', 'current', 'budget', 'forecast')),
  is_active boolean DEFAULT true,
  
  -- Yıl için özel ayarlar
  settings jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_org_year UNIQUE (organization_id, year)
);

-- Multi Year Budget Entries Table
CREATE TABLE IF NOT EXISTS multi_year_budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Eşleştirme referansı
  mapping_id uuid NOT NULL REFERENCES department_program_mappings(id) ON DELETE CASCADE,
  
  -- Ekonomik kod referansı
  economic_code_id uuid NOT NULL REFERENCES expense_economic_codes(id) ON DELETE CASCADE,
  
  -- Finansman türü
  financing_type_id uuid REFERENCES financing_types(id),
  
  -- Yıl ve dönem bilgisi
  fiscal_year integer NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_number integer, -- 1-12 for monthly, 1-4 for quarterly, NULL for yearly
  
  -- Bütçe türü
  budget_type text NOT NULL CHECK (budget_type IN ('actual', 'current', 'budget', 'forecast')),
  
  -- Tutarlar
  amount numeric(15,2) DEFAULT 0,
  
  -- Metadata
  notes text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  
  -- Onay bilgileri
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  rejection_reason text,
  
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  
  -- Aynı dönem için bir kayıt
  CONSTRAINT unique_budget_entry UNIQUE NULLS NOT DISTINCT (mapping_id, economic_code_id, financing_type_id, fiscal_year, period_type, period_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dept_prog_mappings_org ON department_program_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_dept_prog_mappings_dept ON department_program_mappings(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_prog_mappings_program ON department_program_mappings(program_id);
CREATE INDEX IF NOT EXISTS idx_dept_prog_mappings_sub_program ON department_program_mappings(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_dept_prog_mappings_activity ON department_program_mappings(activity_id);

CREATE INDEX IF NOT EXISTS idx_budget_year_settings_org ON budget_year_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_year_settings_year ON budget_year_settings(year);

CREATE INDEX IF NOT EXISTS idx_multi_year_entries_org ON multi_year_budget_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_multi_year_entries_mapping ON multi_year_budget_entries(mapping_id);
CREATE INDEX IF NOT EXISTS idx_multi_year_entries_year ON multi_year_budget_entries(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_multi_year_entries_economic ON multi_year_budget_entries(economic_code_id);
CREATE INDEX IF NOT EXISTS idx_multi_year_entries_financing ON multi_year_budget_entries(financing_type_id);

-- Enable RLS
ALTER TABLE department_program_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_year_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_year_budget_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for department_program_mappings
CREATE POLICY "Users can view mappings in their organization"
  ON department_program_mappings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all mappings"
  ON department_program_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can insert mappings"
  ON department_program_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = department_program_mappings.organization_id
      AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Super admins can insert mappings"
  ON department_program_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can update mappings"
  ON department_program_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = department_program_mappings.organization_id
      AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Super admins can update mappings"
  ON department_program_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can delete mappings"
  ON department_program_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = department_program_mappings.organization_id
      AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Super admins can delete mappings"
  ON department_program_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- RLS Policies for budget_year_settings
CREATE POLICY "Users can view year settings in their organization"
  ON budget_year_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all year settings"
  ON budget_year_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can manage year settings"
  ON budget_year_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_year_settings.organization_id
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_year_settings.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Super admins can manage year settings"
  ON budget_year_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- RLS Policies for multi_year_budget_entries
CREATE POLICY "Users can view budget entries in their organization"
  ON multi_year_budget_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all budget entries"
  ON multi_year_budget_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can insert budget entries in their organization"
  ON multi_year_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = multi_year_budget_entries.organization_id
      AND role IN ('admin', 'vice_president', 'manager')
    )
  );

CREATE POLICY "Super admins can insert budget entries"
  ON multi_year_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can update their budget entries"
  ON multi_year_budget_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = multi_year_budget_entries.organization_id
      AND role IN ('admin', 'vice_president', 'manager')
    )
  );

CREATE POLICY "Super admins can update budget entries"
  ON multi_year_budget_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Admins can delete budget entries"
  ON multi_year_budget_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = multi_year_budget_entries.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Super admins can delete budget entries"
  ON multi_year_budget_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Function to initialize year settings for an organization
CREATE OR REPLACE FUNCTION initialize_budget_years(org_id uuid, start_year integer DEFAULT 2024)
RETURNS void AS $$
BEGIN
  -- Insert default years (past 1, current 1, future 3)
  INSERT INTO budget_year_settings (organization_id, year, year_type, is_active)
  VALUES 
    (org_id, start_year, 'past', true),
    (org_id, start_year + 1, 'current', true),
    (org_id, start_year + 2, 'budget', true),
    (org_id, start_year + 3, 'forecast', true),
    (org_id, start_year + 4, 'forecast', true)
  ON CONFLICT (organization_id, year) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;