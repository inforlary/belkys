/*
  # Goals Tablosu Update RLS Politikasını Düzelt

  1. Değişiklikler
    - Mevcut kısıtlayıcı update_goals politikasını kaldır
    - Yeni politika ekle:
      - Super admin: tüm hedefler için update
      - Admin: kendi organizasyonunun hedefleri için update
      - Director: kendi departmanının hedefleri için update
    
  2. Amaç
    - İşbirliği planı oluştururken director'ların risk iştahı belirleyebilmesini sağlamak
    - Güvenlik: Sadece yetkili kişiler kendi sorumlu oldukları hedefleri güncelleyebilir
*/

-- Mevcut politikayı kaldır
DROP POLICY IF EXISTS "update_goals" ON goals;

-- Yeni, daha esnek politika ekle
CREATE POLICY "update_goals" ON goals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = goals.organization_id
      AND (
        profiles.role = 'super_admin'
        OR profiles.role = 'admin'
        OR (
          profiles.role = 'director' 
          AND profiles.department_id = goals.department_id
        )
      )
    )
  );
