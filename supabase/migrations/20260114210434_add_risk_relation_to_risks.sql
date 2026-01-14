/*
  # Risk İlişki Türü Alanı Ekleme

  1. Değişiklikler
    - `risks` tablosuna `risk_relation` kolonu eklenir
    - Risk ilişki türü: Stratejik, Operasyonel, Proje veya Kurumsal
    - Varsayılan değer: 'OPERATIONAL' (Operasyonel)

  2. Amaç
    - Risklerin hangi tür aktivite veya yapıya bağlı olduğunu takip etmek
    - Risk sınıflandırma ve raporlama yeteneklerini artırmak
*/

ALTER TABLE risks
ADD COLUMN IF NOT EXISTS risk_relation VARCHAR(20) DEFAULT 'OPERATIONAL' 
CHECK (risk_relation IN ('STRATEGIC', 'OPERATIONAL', 'PROJECT', 'CORPORATE'));

COMMENT ON COLUMN risks.risk_relation IS 'Risk ilişki türü: STRATEGIC (Stratejik - Hedefe/faaliyete bağlı), OPERATIONAL (Operasyonel - Sürece bağlı), PROJECT (Proje - Projeye bağlı), CORPORATE (Kurumsal - Tüm kurumu etkiler, bağımsız)';
