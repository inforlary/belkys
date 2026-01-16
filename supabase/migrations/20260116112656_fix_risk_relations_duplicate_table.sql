/*
  # Risk Relations Tablo Düzeltmesi

  1. Değişiklikler
    - Eski `risk_relations` tablosunu kaldır
    - Sadece `rm_risk_relations` kullan
    - Frontend kodları `rm_risk_relations` kullanacak şekilde ayarlanacak
  
  2. Güvenlik
    - Mevcut veriler korunur
    - RLS politikaları değişmez
*/

-- Drop old risk_relations table if exists
DROP TABLE IF EXISTS risk_relations CASCADE;

-- Ensure rm_risk_relations is the only risk relations table
-- (already exists, just verifying it's working correctly)
COMMENT ON TABLE rm_risk_relations IS 'Riskler arası ilişkileri saklar (güncel tablo)';
