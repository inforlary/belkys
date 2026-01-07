/*
  # Update IC Standards Code with Component Prefix

  1. Changes
    - Update ic_standards to include component code prefix
    - KOS.01 -> KOS1.01, KOS.02 -> KOS1.02, etc.
    - This creates the full KIKS hierarchy: KOS1 > KOS1.01 > KOS1.01.1

  2. Notes
    - Standards 1-4 belong to KOS1 (Kontrol Ortamı)
    - Standards 5-6 belong to RDS2 (Risk Değerlendirme)
    - Standards 7-12 belong to KAS3 (Kontrol Faaliyetleri)
    - Standards 13-16 belong to BIS4 (Bilgi ve İletişim)
    - Standards 17-18 belong to IS5 (İzleme)
*/

-- Kontrol Ortamı Standardı (KOS1)
UPDATE ic_standards SET code = 'KOS1.01' WHERE code = 'KOS.01';
UPDATE ic_standards SET code = 'KOS1.02' WHERE code = 'KOS.02';
UPDATE ic_standards SET code = 'KOS1.03' WHERE code = 'KOS.03';
UPDATE ic_standards SET code = 'KOS1.04' WHERE code = 'KOS.04';

-- Risk Değerlendirme Standardı (RDS2)
UPDATE ic_standards SET code = 'RDS2.05' WHERE code = 'KOS.05';
UPDATE ic_standards SET code = 'RDS2.06' WHERE code = 'KOS.06';

-- Kontrol Faaliyetleri Standardı (KAS3)
UPDATE ic_standards SET code = 'KAS3.07' WHERE code = 'KOS.07';
UPDATE ic_standards SET code = 'KAS3.08' WHERE code = 'KOS.08';
UPDATE ic_standards SET code = 'KAS3.09' WHERE code = 'KOS.09';
UPDATE ic_standards SET code = 'KAS3.10' WHERE code = 'KOS.10';
UPDATE ic_standards SET code = 'KAS3.11' WHERE code = 'KOS.11';
UPDATE ic_standards SET code = 'KAS3.12' WHERE code = 'KOS.12';

-- Bilgi ve İletişim Standardı (BIS4)
UPDATE ic_standards SET code = 'BIS4.13' WHERE code = 'KOS.13';
UPDATE ic_standards SET code = 'BIS4.14' WHERE code = 'KOS.14';
UPDATE ic_standards SET code = 'BIS4.15' WHERE code = 'KOS.15';
UPDATE ic_standards SET code = 'BIS4.16' WHERE code = 'KOS.16';

-- İzleme Standardı (IS5)
UPDATE ic_standards SET code = 'IS5.17' WHERE code = 'KOS.17';
UPDATE ic_standards SET code = 'IS5.18' WHERE code = 'KOS.18';
