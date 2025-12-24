/*
  # Bütçe Kodlarını Global/Standart Hale Getirme
  
  ## Değişiklikler
  
  ### 1. Tablo Değişiklikleri
  - expense_economic_codes, revenue_economic_codes, financing_types, programs tablolarında
  - organization_id kolonunu NULLABLE yapıyoruz
  - organization_id = NULL → Global/Standart kodlar (tüm belediyeler için geçerli)
  - organization_id = <uuid> → Belediyeye özel kodlar
  
  ### 2. RLS Politikası Güncellemeleri
  - Herkes global kodları (organization_id IS NULL) görebilir
  - Authenticated kullanıcılar kendi belediyelerinin kodlarını görebilir
  - Sadece Super Admin'ler global kodları ekleyip düzenleyebilir
  - Belediye admin'leri kendi belediyelerinin özel kodlarını yönetebilir
  
  ### 3. Index Güncellemeleri
  - organization_id NULL değerler için de index optimizasyonu
  
  ## Notlar
  - Mevcut veriler korunur
  - Geriye dönük uyumlu
  - Yeni belediye oluşturulduğunda global kodlar otomatik görünür
*/

-- ========================================
-- EXPENSE ECONOMIC CODES
-- ========================================

-- organization_id'yi nullable yap
ALTER TABLE expense_economic_codes 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Mevcut politikaları kaldır
DROP POLICY IF EXISTS "Users can view expense economic codes in their organization" ON expense_economic_codes;
DROP POLICY IF EXISTS "Admins can insert expense economic codes" ON expense_economic_codes;
DROP POLICY IF EXISTS "Admins can update expense economic codes" ON expense_economic_codes;
DROP POLICY IF EXISTS "Admins can delete expense economic codes" ON expense_economic_codes;

-- Yeni politikalar oluştur
CREATE POLICY "Anyone can view global expense economic codes"
  ON expense_economic_codes FOR SELECT
  TO authenticated
  USING (organization_id IS NULL);

CREATE POLICY "Users can view expense economic codes in their organization"
  ON expense_economic_codes FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage global expense economic codes"
  ON expense_economic_codes FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Admins can manage organization expense economic codes"
  ON expense_economic_codes FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = expense_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = expense_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================
-- REVENUE ECONOMIC CODES
-- ========================================

ALTER TABLE revenue_economic_codes 
  ALTER COLUMN organization_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view revenue economic codes in their organization" ON revenue_economic_codes;
DROP POLICY IF EXISTS "Admins can insert revenue economic codes" ON revenue_economic_codes;
DROP POLICY IF EXISTS "Admins can update revenue economic codes" ON revenue_economic_codes;
DROP POLICY IF EXISTS "Admins can delete revenue economic codes" ON revenue_economic_codes;

CREATE POLICY "Anyone can view global revenue economic codes"
  ON revenue_economic_codes FOR SELECT
  TO authenticated
  USING (organization_id IS NULL);

CREATE POLICY "Users can view revenue economic codes in their organization"
  ON revenue_economic_codes FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage global revenue economic codes"
  ON revenue_economic_codes FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Admins can manage organization revenue economic codes"
  ON revenue_economic_codes FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = revenue_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = revenue_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================
-- FINANCING TYPES
-- ========================================

ALTER TABLE financing_types 
  ALTER COLUMN organization_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view financing types in their organization" ON financing_types;
DROP POLICY IF EXISTS "Admins can insert financing types" ON financing_types;
DROP POLICY IF EXISTS "Admins can update financing types" ON financing_types;
DROP POLICY IF EXISTS "Admins can delete financing types" ON financing_types;

CREATE POLICY "Anyone can view global financing types"
  ON financing_types FOR SELECT
  TO authenticated
  USING (organization_id IS NULL);

CREATE POLICY "Users can view financing types in their organization"
  ON financing_types FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage global financing types"
  ON financing_types FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Admins can manage organization financing types"
  ON financing_types FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = financing_types.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = financing_types.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================
-- PROGRAMS
-- ========================================

ALTER TABLE programs 
  ALTER COLUMN organization_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view programs in their organization" ON programs;
DROP POLICY IF EXISTS "Admins can insert programs" ON programs;
DROP POLICY IF EXISTS "Admins can update programs" ON programs;
DROP POLICY IF EXISTS "Admins can delete programs" ON programs;

CREATE POLICY "Anyone can view global programs"
  ON programs FOR SELECT
  TO authenticated
  USING (organization_id IS NULL);

CREATE POLICY "Users can view programs in their organization"
  ON programs FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage global programs"
  ON programs FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Admins can manage organization programs"
  ON programs FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = programs.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = programs.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================
-- UNIQUE CONSTRAINTS GÜNCELLEMESİ
-- ========================================

-- Mevcut unique constraint'leri kaldır ve yenilerini ekle
-- Global kodlar için (organization_id IS NULL) ayrı, belediyeye özel kodlar için ayrı unique olmalı

ALTER TABLE expense_economic_codes DROP CONSTRAINT IF EXISTS expense_economic_codes_organization_id_full_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_economic_codes_unique_global 
  ON expense_economic_codes(full_code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_economic_codes_unique_org 
  ON expense_economic_codes(organization_id, full_code) WHERE organization_id IS NOT NULL;

ALTER TABLE revenue_economic_codes DROP CONSTRAINT IF EXISTS revenue_economic_codes_organization_id_full_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_economic_codes_unique_global 
  ON revenue_economic_codes(full_code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_economic_codes_unique_org 
  ON revenue_economic_codes(organization_id, full_code) WHERE organization_id IS NOT NULL;

ALTER TABLE financing_types DROP CONSTRAINT IF EXISTS financing_types_organization_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_financing_types_unique_global 
  ON financing_types(code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_financing_types_unique_org 
  ON financing_types(organization_id, code) WHERE organization_id IS NOT NULL;

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_organization_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_unique_global 
  ON programs(code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_unique_org 
  ON programs(organization_id, code) WHERE organization_id IS NOT NULL;