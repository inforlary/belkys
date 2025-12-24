/*
  # İç Kontrol RLS Politikaları Güncelleme

  ## Genel Bakış
  Bu migration, mevcut iç kontrol tablolarının RLS politikalarını yeni IC rol sistemi
  (ic_coordinator, ic_responsible, ic_auditor, process_owner) ile entegre eder.

  ## Güncellenen Tablolar
    - ic_processes
    - ic_risks
    - ic_controls
    - ic_control_tests
    - ic_findings
    - ic_capas

  ## Yeni Erişim Kuralları

  ### IC Koordinatör (ic_coordinator)
    - Tüm IC verilerine tam erişim
    - Tüm CRUD işlemlerini yapabilir
    - Organizasyon genelinde yetki

  ### IC Sorumlu (ic_responsible)
    - Kendi müdürlüğünün IC verilerine tam erişim
    - Kendi müdürlüğü için CRUD işlemleri yapabilir
    - Müdürlük bazlı yetki

  ### IC Denetçi (ic_auditor)
    - Tüm IC verilerini okuyabilir
    - Test ve değerlendirme yapabilir
    - Bulgu oluşturabilir

  ### Süreç Sahibi (process_owner)
    - Kendi süreçlerine tam erişim
    - Süreç bazlı CRUD işlemleri yapabilir
*/

-- ============================================================================
-- 1. IC_PROCESSES TABLOSU
-- ============================================================================

DROP POLICY IF EXISTS "Users can view processes in their org" ON ic_processes;
DROP POLICY IF EXISTS "Admins can manage processes" ON ic_processes;
DROP POLICY IF EXISTS "department_managers_can_view_processes" ON ic_processes;
DROP POLICY IF EXISTS "department_managers_can_manage_processes" ON ic_processes;

CREATE POLICY "Users can view IC processes in their org"
  ON ic_processes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "IC Coordinators can manage all processes"
  ON ic_processes FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      AND (role IN ('admin', 'super_admin') OR is_ic_coordinator())
    )
  );

CREATE POLICY "IC Responsibles can manage department processes"
  ON ic_processes FOR ALL TO authenticated
  USING (can_manage_department_ic(department_id));

CREATE POLICY "Process owners can manage their processes"
  ON ic_processes FOR ALL TO authenticated
  USING (can_manage_process(id));

-- ============================================================================
-- 2. IC_RISKS TABLOSU
-- ============================================================================

DROP POLICY IF EXISTS "Users can view risks in their org" ON ic_risks;
DROP POLICY IF EXISTS "Admins can manage risks" ON ic_risks;
DROP POLICY IF EXISTS "department_users_can_view_risks" ON ic_risks;
DROP POLICY IF EXISTS "department_managers_can_manage_risks" ON ic_risks;

CREATE POLICY "Users can view IC risks in their org"
  ON ic_risks FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "IC Coordinators can manage all risks"
  ON ic_risks FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      AND (role IN ('admin', 'super_admin') OR is_ic_coordinator())
    )
  );

CREATE POLICY "IC Responsibles can manage risks via process"
  ON ic_risks FOR ALL TO authenticated
  USING (
    process_id IN (SELECT id FROM ic_processes WHERE can_manage_department_ic(department_id))
  );

CREATE POLICY "Process owners can manage process risks"
  ON ic_risks FOR ALL TO authenticated
  USING (process_id IS NOT NULL AND can_manage_process(process_id));

-- ============================================================================
-- 3. IC_CONTROLS TABLOSU
-- ============================================================================

DROP POLICY IF EXISTS "Users can view controls in their org" ON ic_controls;
DROP POLICY IF EXISTS "Admins can manage controls" ON ic_controls;
DROP POLICY IF EXISTS "department_users_can_view_controls" ON ic_controls;
DROP POLICY IF EXISTS "department_managers_can_manage_controls" ON ic_controls;

CREATE POLICY "Users can view IC controls in their org"
  ON ic_controls FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "IC Coordinators can manage all controls"
  ON ic_controls FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      AND (role IN ('admin', 'super_admin') OR is_ic_coordinator())
    )
  );

CREATE POLICY "IC Responsibles can manage controls via process"
  ON ic_controls FOR ALL TO authenticated
  USING (
    risk_id IN (
      SELECT r.id FROM ic_risks r
      INNER JOIN ic_processes p ON p.id = r.process_id
      WHERE can_manage_department_ic(p.department_id)
    )
  );

CREATE POLICY "Process owners can manage process controls"
  ON ic_controls FOR ALL TO authenticated
  USING (
    risk_id IN (SELECT id FROM ic_risks WHERE process_id IS NOT NULL AND can_manage_process(process_id))
  );

-- ============================================================================
-- 4. IC_CONTROL_TESTS TABLOSU
-- ============================================================================

DROP POLICY IF EXISTS "Users can view control tests in their org" ON ic_control_tests;
DROP POLICY IF EXISTS "Admins can manage control tests" ON ic_control_tests;
DROP POLICY IF EXISTS "department_users_can_view_tests" ON ic_control_tests;
DROP POLICY IF EXISTS "department_managers_can_manage_tests" ON ic_control_tests;

CREATE POLICY "Users can view IC control tests in their org"
  ON ic_control_tests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "IC Coordinators and Auditors can create tests"
  ON ic_control_tests FOR INSERT TO authenticated
  WITH CHECK (
    is_ic_coordinator() OR has_ic_role('ic_auditor')
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'vice_president')
    )
  );

CREATE POLICY "IC Coordinators and Auditors can update tests"
  ON ic_control_tests FOR UPDATE TO authenticated
  USING (tester_id = auth.uid() OR is_ic_coordinator() OR has_ic_role('ic_auditor'));

CREATE POLICY "IC Coordinators can delete tests"
  ON ic_control_tests FOR DELETE TO authenticated
  USING (
    is_ic_coordinator()
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 5. IC_FINDINGS TABLOSU
-- ============================================================================

DROP POLICY IF EXISTS "Users can view findings in their org" ON ic_findings;
DROP POLICY IF EXISTS "Admins can manage findings" ON ic_findings;
DROP POLICY IF EXISTS "department_users_can_view_findings" ON ic_findings;

CREATE POLICY "Users can view IC findings in their org"
  ON ic_findings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "IC Coordinators and Auditors can create findings"
  ON ic_findings FOR INSERT TO authenticated
  WITH CHECK (
    is_ic_coordinator() OR has_ic_role('ic_auditor')
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "IC Coordinators and Auditors can update findings"
  ON ic_findings FOR UPDATE TO authenticated
  USING (identified_by = auth.uid() OR is_ic_coordinator() OR has_ic_role('ic_auditor'));

CREATE POLICY "IC Coordinators can delete findings"
  ON ic_findings FOR DELETE TO authenticated
  USING (
    is_ic_coordinator()
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 6. IC_CAPAS TABLOSU
-- ============================================================================

DROP POLICY IF EXISTS "Users can view CAPAs in their org" ON ic_capas;
DROP POLICY IF EXISTS "Admins can manage CAPAs" ON ic_capas;
DROP POLICY IF EXISTS "department_users_can_view_capas" ON ic_capas;
DROP POLICY IF EXISTS "department_managers_can_manage_capas" ON ic_capas;

CREATE POLICY "Users can view IC CAPAs in their org"
  ON ic_capas FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Authorized users can create CAPAs"
  ON ic_capas FOR INSERT TO authenticated
  WITH CHECK (
    is_ic_coordinator() OR has_ic_role('ic_auditor')
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'vice_president')
    )
  );

CREATE POLICY "Authorized users can update CAPAs"
  ON ic_capas FOR UPDATE TO authenticated
  USING (responsible_user_id = auth.uid() OR is_ic_coordinator());

CREATE POLICY "IC Coordinators can delete CAPAs"
  ON ic_capas FOR DELETE TO authenticated
  USING (
    is_ic_coordinator()
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 7. HELPER VİEW
-- ============================================================================

CREATE OR REPLACE VIEW user_ic_permissions AS
WITH user_processes AS (
  SELECT 
    icr.user_id,
    unnest(icr.process_ids) as process_id
  FROM ic_user_roles icr
  WHERE icr.is_active = true
)
SELECT
  auth.uid() as user_id,
  p.organization_id,
  p.department_id,
  p.role as system_role,
  COALESCE(array_agg(DISTINCT icr.role) FILTER (WHERE icr.role IS NOT NULL), ARRAY[]::text[]) as ic_roles,
  is_ic_coordinator() as is_coordinator,
  COALESCE(array_agg(DISTINCT icr.department_id) FILTER (WHERE icr.department_id IS NOT NULL), ARRAY[]::uuid[]) as authorized_departments,
  COALESCE(array_agg(DISTINCT up.process_id) FILTER (WHERE up.process_id IS NOT NULL), ARRAY[]::uuid[]) as authorized_processes
FROM profiles p
LEFT JOIN ic_user_roles icr ON icr.user_id = p.id AND icr.is_active = true
LEFT JOIN user_processes up ON up.user_id = p.id
WHERE p.id = auth.uid()
GROUP BY p.id, p.organization_id, p.department_id, p.role;

COMMENT ON VIEW user_ic_permissions IS 'Kullanıcının iç kontrol sistemindeki tüm yetkileri ve erişim kapsamı';
