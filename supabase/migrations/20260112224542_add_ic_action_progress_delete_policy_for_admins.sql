/*
  # İlerleme kayıtları için silme yetkisi - Sadece Yöneticiler

  1. Değişiklikler
    - ic_action_progress tablosuna DELETE policy eklenir
    - Sadece yöneticiler (admin) ilerleme kayıtlarını silebilir
    - Kullanıcı ve müdürler ilerleme ekleyebilir ama silemez

  2. Güvenlik
    - Super adminler tüm kayıtları silebilir
    - Normal adminler kendi organizasyonlarındaki kayıtları silebilir
    - Kullanıcı ve müdürler silme yetkisi yok
*/

-- İlerleme kayıtlarını sadece adminler silebilir
CREATE POLICY "Only admins can delete progress entries"
  ON ic_action_progress
  FOR DELETE
  TO authenticated
  USING (
    -- Super adminler tüm kayıtları silebilir
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Normal adminler kendi organizasyonlarındaki kayıtları silebilir
    EXISTS (
      SELECT 1 FROM ic_actions a
      INNER JOIN profiles p ON p.organization_id = a.organization_id
      WHERE a.id = ic_action_progress.action_id
      AND p.id = auth.uid()
      AND p.role = 'admin'
    )
  );