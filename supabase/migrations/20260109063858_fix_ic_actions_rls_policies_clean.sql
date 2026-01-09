/*
  # ic_actions RLS politikalarını temizle ve düzelt
  
  1. Changes
    - Eski, çakışan policy'leri sil
    - Sadece organization_id bazlı temiz policy'ler bırak
    - DELETE policy ekle
*/

-- Eski policy'leri temizle
DROP POLICY IF EXISTS "Users can view ic actions" ON ic_actions;
DROP POLICY IF EXISTS "Admins can manage ic actions" ON ic_actions;

-- Mevcut policy'leri kontrol et ve gerekirse yeniden oluştur
DROP POLICY IF EXISTS "Users view own org actions" ON ic_actions;
DROP POLICY IF EXISTS "Users insert own org actions" ON ic_actions;
DROP POLICY IF EXISTS "Users update own org actions" ON ic_actions;

-- SELECT policy
CREATE POLICY "Users view own org actions"
  ON ic_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
    )
  );

-- INSERT policy
CREATE POLICY "Users insert own org actions"
  ON ic_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
      AND profiles.role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
    )
  );

-- UPDATE policy
CREATE POLICY "Users update own org actions"
  ON ic_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
      AND profiles.role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
    )
  );

-- DELETE policy
CREATE POLICY "Users delete own org actions"
  ON ic_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
      AND profiles.role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
    )
  );