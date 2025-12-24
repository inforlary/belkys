/*
  # Sub Program Faaliyetleri RLS - Super Admin Erişimi Düzeltmesi

  1. Değişiklikler
    - Mevcut SELECT politikasını güncelle
    - Super admin tüm faaliyetleri görebilsin
    - Super admin standart faaliyetleri ekleyip düzenleyebilsin
    - Standart faaliyetler (organization_id = NULL olanlar) herkes tarafından görülebilsin

  2. Güvenlik
    - Normal kullanıcılar sadece kendi org'larındaki faaliyetleri görür
    - Super admin tüm faaliyetleri görür ve yönetir
    - Standart faaliyetler herkese açık (sadece okuma)
*/

-- Mevcut politikaları kaldır
DROP POLICY IF EXISTS "Users can view activities in their organization" ON sub_program_activities;
DROP POLICY IF EXISTS "Admins can insert activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Admins can update activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Admins can delete activities" ON sub_program_activities;

-- SELECT: Standart faaliyetler herkese açık, super admin hepsini görür, kullanıcılar sadece kendi org'larını görür
CREATE POLICY "Users can view activities"
  ON sub_program_activities FOR SELECT
  TO authenticated
  USING (
    -- Super admin hepsini görebilir
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
    OR
    -- Standart faaliyetler (organization_id NULL) herkese açık
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      WHERE p.organization_id IS NULL
    )
    OR
    -- Kullanıcılar kendi organizasyonlarındaki faaliyetleri görebilir
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid()
    )
  );

-- INSERT: Super admin standart faaliyetler ekleyebilir, org admin'leri kendi org'larına ekleyebilir
CREATE POLICY "Super admin and org admins can insert activities"
  ON sub_program_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin standart faaliyetler ekleyebilir
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
      AND sub_program_id IN (
        SELECT sp.id FROM sub_programs sp
        INNER JOIN programs p ON p.id = sp.program_id
        WHERE p.organization_id IS NULL
      )
    )
    OR
    -- Organization admin'leri kendi org'larına ekleyebilir
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  );

-- UPDATE: Super admin standart faaliyetleri güncelleyebilir, org admin'leri kendi org'larını güncelleyebilir
CREATE POLICY "Super admin and org admins can update activities"
  ON sub_program_activities FOR UPDATE
  TO authenticated
  USING (
    -- Super admin standart faaliyetleri güncelleyebilir
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
      AND sub_program_id IN (
        SELECT sp.id FROM sub_programs sp
        INNER JOIN programs p ON p.id = sp.program_id
        WHERE p.organization_id IS NULL
      )
    )
    OR
    -- Organization admin'leri kendi org'larını güncelleyebilir
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  )
  WITH CHECK (
    -- Super admin standart faaliyetleri güncelleyebilir
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
      AND sub_program_id IN (
        SELECT sp.id FROM sub_programs sp
        INNER JOIN programs p ON p.id = sp.program_id
        WHERE p.organization_id IS NULL
      )
    )
    OR
    -- Organization admin'leri kendi org'larını güncelleyebilir
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  );

-- DELETE: Super admin standart faaliyetleri silebilir, org admin'leri kendi org'larını silebilir
CREATE POLICY "Super admin and org admins can delete activities"
  ON sub_program_activities FOR DELETE
  TO authenticated
  USING (
    -- Super admin standart faaliyetleri silebilir
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
      AND sub_program_id IN (
        SELECT sp.id FROM sub_programs sp
        INNER JOIN programs p ON p.id = sp.program_id
        WHERE p.organization_id IS NULL
      )
    )
    OR
    -- Organization admin'leri kendi org'larını silebilir
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  );