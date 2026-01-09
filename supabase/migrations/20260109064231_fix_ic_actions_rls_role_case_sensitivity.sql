/*
  # ic_actions RLS role kontrolünü düzelt
  
  1. Changes
    - Role kontrollerinde büyük/küçük harf uyumunu düzelt
    - Roles: 'admin', 'director', 'super_admin' (küçük harf)
*/

-- Mevcut policy'leri sil
DROP POLICY IF EXISTS "Users view own org actions" ON ic_actions;
DROP POLICY IF EXISTS "Users insert own org actions" ON ic_actions;
DROP POLICY IF EXISTS "Users update own org actions" ON ic_actions;
DROP POLICY IF EXISTS "Users delete own org actions" ON ic_actions;

-- SELECT policy (herkese)
CREATE POLICY "Users view own org actions"
  ON ic_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'super_admin'
      )
    )
  );

-- INSERT policy (admin, director, super_admin)
CREATE POLICY "Users insert own org actions"
  ON ic_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'super_admin'
      )
      AND profiles.role IN ('super_admin', 'admin', 'director')
    )
  );

-- UPDATE policy (admin, director, super_admin)
CREATE POLICY "Users update own org actions"
  ON ic_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'super_admin'
      )
      AND profiles.role IN ('super_admin', 'admin', 'director')
    )
  );

-- DELETE policy (admin, director, super_admin)
CREATE POLICY "Users delete own org actions"
  ON ic_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'super_admin'
      )
      AND profiles.role IN ('super_admin', 'admin', 'director')
    )
  );