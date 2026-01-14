/*
  # Risk Kaynağı Alanı Ekleme

  1. Değişiklikler
    - `risks` tablosuna `risk_source` kolonu eklenir
    - Risk kaynağı: İç (INTERNAL) veya Dış (EXTERNAL) olarak tanımlanır
    - Varsayılan değer: 'INTERNAL' (İç Risk)

  2. Amaç
    - Risklerin kurum içi mi yoksa dış faktörlerden mi kaynaklandığını takip etmek
    - Risk raporlama ve analiz yeteneklerini artırmak
*/

ALTER TABLE risks
ADD COLUMN IF NOT EXISTS risk_source VARCHAR(20) DEFAULT 'INTERNAL' CHECK (risk_source IN ('INTERNAL', 'EXTERNAL'));

COMMENT ON COLUMN risks.risk_source IS 'Risk kaynağı: INTERNAL (İç Risk - Kurum içinden kaynaklanan), EXTERNAL (Dış Risk - Kurum dışından kaynaklanan)';
