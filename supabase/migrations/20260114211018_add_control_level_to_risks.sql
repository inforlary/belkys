/*
  # Risk Kontrol Düzeyi Alanı Ekleme

  1. Değişiklikler
    - `risks` tablosuna `control_level` kolonu eklenir
    - Kontrol düzeyi: Kontrol Edilebilir, Kısmen Kontrol Edilebilir veya Kontrol Dışı
    - Varsayılan değer: 'CONTROLLABLE' (Kontrol Edilebilir)

  2. Amaç
    - Risklerin ne ölçüde kurum tarafından kontrol edilebildiğini takip etmek
    - Risk yönetim stratejilerinin belirlenmesine yardımcı olmak
*/

ALTER TABLE risks
ADD COLUMN IF NOT EXISTS control_level VARCHAR(20) DEFAULT 'CONTROLLABLE' 
CHECK (control_level IN ('CONTROLLABLE', 'PARTIAL', 'UNCONTROLLABLE'));

COMMENT ON COLUMN risks.control_level IS 'Risk kontrol düzeyi: CONTROLLABLE (Tamamen kontrol edilebilir), PARTIAL (Kısmen kontrol edilebilir), UNCONTROLLABLE (Kontrol dışı)';
