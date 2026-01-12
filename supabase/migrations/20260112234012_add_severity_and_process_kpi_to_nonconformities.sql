/*
  # DÖF Tablosuna Severity ve Process KPI Ekle

  1. Değişiklikler
    - `qm_nonconformities` tablosuna `severity` kolonu ekleniyor
      - Kritiklik seviyesi: CRITICAL, HIGH, MEDIUM, LOW
    - `source` enum'una `PROCESS_KPI` değeri ekleniyor
      - Süreç KPI hedef altı durumlar için
    
  2. Güvenlik
    - Mevcut RLS politikaları geçerli kalıyor
*/

-- Source enum'una PROCESS_KPI ekle
ALTER TABLE qm_nonconformities 
DROP CONSTRAINT IF EXISTS qm_nonconformities_source_check;

ALTER TABLE qm_nonconformities
ADD CONSTRAINT qm_nonconformities_source_check CHECK (source IN (
  'INTERNAL_AUDIT',
  'EXTERNAL_AUDIT',
  'CUSTOMER_COMPLAINT',
  'PROCESS_ERROR',
  'EMPLOYEE_REPORT',
  'MANAGEMENT_REVIEW',
  'INSPECTION',
  'PROCESS_KPI',
  'OTHER'
));

-- Severity kolonu ekle
ALTER TABLE qm_nonconformities
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN (
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW'
));

-- Yorum ekle
COMMENT ON COLUMN qm_nonconformities.severity IS 'DÖF kritiklik seviyesi: CRITICAL (Kritik), HIGH (Yüksek), MEDIUM (Orta), LOW (Düşük)';
