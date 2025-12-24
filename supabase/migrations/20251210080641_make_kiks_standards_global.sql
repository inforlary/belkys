/*
  # KİKS Standartlarını Global/Super Admin Yönetimine Çevir

  1. Değişiklikler
    - Kategori, ana standart ve alt standart tablolarında organization_id'yi nullable yap
    - NULL organization_id = Super Admin tarafından tanımlanan global standartlar
    - NOT NULL organization_id = Belediyeye özel standartlar (gerekirse)
    - Eylemler her zaman organization_id'ye sahip olacak (belediyeye özel)

  2. RLS Politikaları
    - Global standartlar (organization_id IS NULL) herkes tarafından görülebilir
    - Belediyeye özel standartlar sadece o belediye tarafından görülebilir
    - Eylemler sadece kendi organizasyonuna aittir

  3. Mantık
    - Super admin global standartları yönetir
    - Belediyeler global standartları görür, sadece eylem ekler
*/

-- Kategoriler için organization_id nullable yap
ALTER TABLE ic_kiks_categories 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Ana standartlar için organization_id nullable yap
ALTER TABLE ic_kiks_main_standards 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Alt standartlar için organization_id nullable yap
ALTER TABLE ic_kiks_sub_standards 
  ALTER COLUMN organization_id DROP NOT NULL;

-- UNIQUE constraint'leri güncelle
ALTER TABLE ic_kiks_categories DROP CONSTRAINT IF EXISTS ic_kiks_categories_organization_id_code_key;
CREATE UNIQUE INDEX ic_kiks_categories_code_unique 
  ON ic_kiks_categories (COALESCE(organization_id::text, 'global'), code);

ALTER TABLE ic_kiks_main_standards DROP CONSTRAINT IF EXISTS ic_kiks_main_standards_organization_id_category_id_code_key;
CREATE UNIQUE INDEX ic_kiks_main_standards_code_unique 
  ON ic_kiks_main_standards (COALESCE(organization_id::text, 'global'), category_id, code);

ALTER TABLE ic_kiks_sub_standards DROP CONSTRAINT IF EXISTS ic_kiks_sub_standards_organization_id_main_standard_id_code_key;
CREATE UNIQUE INDEX ic_kiks_sub_standards_code_unique 
  ON ic_kiks_sub_standards (COALESCE(organization_id::text, 'global'), main_standard_id, code);

-- RLS Politikalarını Güncelle

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view KIKS categories in their org" ON ic_kiks_categories;
CREATE POLICY "Users can view KIKS categories"
  ON ic_kiks_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL -- Global standartlar herkese açık
    OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage KIKS categories" ON ic_kiks_categories;
CREATE POLICY "Super admins can manage global KIKS categories"
  ON ic_kiks_categories FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- MAIN STANDARDS
DROP POLICY IF EXISTS "Users can view KIKS main standards in their org" ON ic_kiks_main_standards;
CREATE POLICY "Users can view KIKS main standards"
  ON ic_kiks_main_standards FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL -- Global standartlar herkese açık
    OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage KIKS main standards" ON ic_kiks_main_standards;
CREATE POLICY "Super admins can manage global KIKS main standards"
  ON ic_kiks_main_standards FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- SUB STANDARDS
DROP POLICY IF EXISTS "Users can view KIKS sub standards in their org" ON ic_kiks_sub_standards;
CREATE POLICY "Users can view KIKS sub standards"
  ON ic_kiks_sub_standards FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL -- Global standartlar herkese açık
    OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage KIKS sub standards" ON ic_kiks_sub_standards;
CREATE POLICY "Super admins can manage global KIKS sub standards"
  ON ic_kiks_sub_standards FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    organization_id IS NULL 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- ACTIONS - Eylemler her zaman belediyeye özel
-- Mevcut politikalar yeterli, sadece super admin'in tüm eylemleri görmesine izin ver
DROP POLICY IF EXISTS "Users can view KIKS actions in their org" ON ic_kiks_actions;
CREATE POLICY "Users can view KIKS actions"
  ON ic_kiks_actions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );
