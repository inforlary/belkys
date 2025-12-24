/*
  # İç Kontrol Rol Yönetimi Sistemi

  ## Genel Bakış
  Bu migration, iç kontrol sistemi için özel rol yönetimi ve yetkilendirme
  mekanizmasını oluşturur.

  ## 1. Yeni Tablolar

  ### ic_user_roles
    - `id` (uuid, primary key) - Kayıt kimliği
    - `user_id` (uuid) - Kullanıcı referansı
    - `organization_id` (uuid) - Organizasyon referansı
    - `role` (text) - İç kontrol rolü
      * `ic_coordinator` - İç Kontrol Koordinatörü (tüm sistemi yönetir)
      * `ic_responsible` - İç Kontrol Sorumlusu (kendi biriminin IC işlemlerini yapar)
      * `ic_auditor` - İç Kontrol Denetçisi (değerlendirme ve test yapar)
      * `process_owner` - Süreç Sahibi (süreçleri yönetir)
    - `department_id` (uuid) - Yetkili olduğu müdürlük (opsiyonel)
    - `process_ids` (uuid[]) - Yetkili olduğu süreçler (process_owner için)
    - `granted_by` (uuid) - Yetkiyi veren kullanıcı
    - `granted_at` (timestamptz) - Yetki veriliş tarihi
    - `expires_at` (timestamptz) - Yetki bitiş tarihi (opsiyonel)
    - `is_active` (boolean) - Aktif mi?

  ## 2. Helper Fonksiyonlar
    - `has_ic_role(role, dept_id)` - Kullanıcının belirli IC rolü var mı?
    - `get_user_ic_roles()` - Kullanıcının tüm IC rollerini döndürür
    - `is_ic_coordinator()` - Kullanıcı IC koordinatörü mü?
    - `can_manage_department_ic(dept_id)` - Kullanıcı bu müdürlüğün IC'sini yönetebilir mi?

  ## 3. Güvenlik
    - RLS tüm tablolarda aktif
    - IC Koordinatör: Tüm verilere erişim
    - IC Sorumlu: Kendi müdürlüğüne erişim
    - IC Denetçi: Okuma ve değerlendirme yetkisi
    - Süreç Sahibi: Kendi süreçlerine erişim

  ## 4. Özellikler
    - Çoklu rol desteği (bir kullanıcı birden fazla IC rolü alabilir)
    - Müdürlük bazlı yetkilendirme
    - Süreç bazlı yetkilendirme
    - Yetki süresi yönetimi
    - Audit trail (kim, ne zaman, kime yetki verdi)
*/

-- ============================================================================
-- 1. İÇ KONTROL ROL TABLOSU
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ic_coordinator', 'ic_responsible', 'ic_auditor', 'process_owner')),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  process_ids uuid[] DEFAULT ARRAY[]::uuid[],
  granted_by uuid REFERENCES profiles(id),
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id, role, department_id)
);

CREATE INDEX idx_ic_user_roles_user ON ic_user_roles(user_id);
CREATE INDEX idx_ic_user_roles_org ON ic_user_roles(organization_id);
CREATE INDEX idx_ic_user_roles_role ON ic_user_roles(role);
CREATE INDEX idx_ic_user_roles_dept ON ic_user_roles(department_id);
CREATE INDEX idx_ic_user_roles_active ON ic_user_roles(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. HELPER FONKSIYONLAR
-- ============================================================================

-- Kullanıcının belirli IC rolü var mı?
CREATE OR REPLACE FUNCTION has_ic_role(check_role text, dept_id uuid DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ic_user_roles
    WHERE user_id = auth.uid()
    AND role = check_role
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (dept_id IS NULL OR department_id = dept_id OR department_id IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcının tüm IC rollerini döndürür
CREATE OR REPLACE FUNCTION get_user_ic_roles()
RETURNS TABLE (
  role text,
  department_id uuid,
  process_ids uuid[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic_user_roles.role,
    ic_user_roles.department_id,
    ic_user_roles.process_ids
  FROM ic_user_roles
  WHERE ic_user_roles.user_id = auth.uid()
  AND ic_user_roles.is_active = true
  AND (ic_user_roles.expires_at IS NULL OR ic_user_roles.expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcı IC koordinatörü mü?
CREATE OR REPLACE FUNCTION is_ic_coordinator()
RETURNS boolean AS $$
BEGIN
  RETURN has_ic_role('ic_coordinator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcı bu müdürlüğün IC'sini yönetebilir mi?
CREATE OR REPLACE FUNCTION can_manage_department_ic(dept_id uuid)
RETURNS boolean AS $$
BEGIN
  -- IC Koordinatör her yeri yönetebilir
  IF is_ic_coordinator() THEN
    RETURN true;
  END IF;

  -- IC Sorumlu sadece kendi müdürlüğünü yönetebilir
  RETURN has_ic_role('ic_responsible', dept_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcı bu süreci yönetebilir mi?
CREATE OR REPLACE FUNCTION can_manage_process(proc_id uuid)
RETURNS boolean AS $$
BEGIN
  -- IC Koordinatör her süreci yönetebilir
  IF is_ic_coordinator() THEN
    RETURN true;
  END IF;

  -- Süreç sahibi sadece kendi süreçlerini yönetebilir
  RETURN EXISTS (
    SELECT 1 FROM ic_user_roles
    WHERE user_id = auth.uid()
    AND role = 'process_owner'
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND proc_id = ANY(process_ids)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. RLS POLİTİKALARI
-- ============================================================================

ALTER TABLE ic_user_roles ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi IC rollerini görebilir
CREATE POLICY "Users can view their IC roles"
  ON ic_user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
    OR is_ic_coordinator()
  );

-- Admin ve IC Koordinatör rol atayabilir
CREATE POLICY "Admins and IC Coordinators can assign roles"
  ON ic_user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
    OR is_ic_coordinator()
  );

-- Admin ve IC Koordinatör rolleri güncelleyebilir
CREATE POLICY "Admins and IC Coordinators can update roles"
  ON ic_user_roles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
    OR is_ic_coordinator()
  );

-- Admin ve IC Koordinatör rolleri silebilir
CREATE POLICY "Admins and IC Coordinators can delete roles"
  ON ic_user_roles FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
    OR is_ic_coordinator()
  );

-- ============================================================================
-- 4. UPDATED_AT TRİGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ic_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ic_user_roles_updated_at
  BEFORE UPDATE ON ic_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_user_roles_updated_at();

-- ============================================================================
-- 5. İNDEKSLER VE PERFORMANS
-- ============================================================================

-- Aktif rolleri hızlı sorgulama için
CREATE INDEX idx_ic_user_roles_user_active
  ON ic_user_roles(user_id, is_active)
  WHERE is_active = true;

-- Süre geçmiş rolleri temizleme için
CREATE INDEX idx_ic_user_roles_expired
  ON ic_user_roles(expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 6. YORUM VE AÇIKLAMALAR
-- ============================================================================

COMMENT ON TABLE ic_user_roles IS 'İç kontrol sistemi kullanıcı rolleri ve yetkileri';
COMMENT ON COLUMN ic_user_roles.role IS 'ic_coordinator, ic_responsible, ic_auditor, process_owner';
COMMENT ON COLUMN ic_user_roles.department_id IS 'Yetkili olduğu müdürlük (ic_responsible için zorunlu)';
COMMENT ON COLUMN ic_user_roles.process_ids IS 'Yetkili olduğu süreçler (process_owner için)';
COMMENT ON COLUMN ic_user_roles.expires_at IS 'Yetki bitiş tarihi (NULL ise süresiz)';

COMMENT ON FUNCTION has_ic_role IS 'Kullanıcının belirli IC rolü var mı kontrol eder';
COMMENT ON FUNCTION get_user_ic_roles IS 'Kullanıcının tüm aktif IC rollerini döndürür';
COMMENT ON FUNCTION is_ic_coordinator IS 'Kullanıcı IC koordinatörü mü kontrol eder';
COMMENT ON FUNCTION can_manage_department_ic IS 'Kullanıcı belirli müdürlüğün IC işlemlerini yönetebilir mi kontrol eder';
COMMENT ON FUNCTION can_manage_process IS 'Kullanıcı belirli süreci yönetebilir mi kontrol eder';
