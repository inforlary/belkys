/*
  # Organizations Tablosu - Genel Erişim Düzeltmesi

  1. Değişiklikler
    - Anonymous kullanıcıların aktif organizasyonları görmesine izin ver
    - Login sayfasında organizasyon listesi görüntülenebilsin
    
  2. Güvenlik
    - Sadece SELECT izni (okuma)
    - Sadece aktif organizasyonlar görünür
    - INSERT, UPDATE, DELETE hala sadece yetkili kullanıcılarda
*/

-- Eğer varsa önceki politikayı sil
DROP POLICY IF EXISTS "Anonymous users can view active organizations" ON organizations;

-- Anonymous kullanıcılar için SELECT politikası ekle
CREATE POLICY "Anonymous users can view active organizations"
  ON organizations
  FOR SELECT
  TO anon
  USING (is_active = true);
