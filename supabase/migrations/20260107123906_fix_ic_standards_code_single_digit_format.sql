/*
  # Fix IC Standards Code to Single Digit Format

  1. Changes
    - Update ic_standards codes to use single digit format
    - KOS1.01 -> KOS1.1, KOS1.02 -> KOS1.2, etc.
    - This creates format: KOS1 > KOS1.1 > KOS1.1.1

  2. Notes
    - Matches user request for KOS1.1.1 format
*/

-- Kontrol Ortamı Standardı (KOS1)
UPDATE ic_standards SET code = 'KOS1.1' WHERE code = 'KOS1.01';
UPDATE ic_standards SET code = 'KOS1.2' WHERE code = 'KOS1.02';
UPDATE ic_standards SET code = 'KOS1.3' WHERE code = 'KOS1.03';
UPDATE ic_standards SET code = 'KOS1.4' WHERE code = 'KOS1.04';

-- Risk Değerlendirme Standardı (RDS2)
UPDATE ic_standards SET code = 'RDS2.5' WHERE code = 'RDS2.05';
UPDATE ic_standards SET code = 'RDS2.6' WHERE code = 'RDS2.06';

-- Kontrol Faaliyetleri Standardı (KAS3)
UPDATE ic_standards SET code = 'KAS3.7' WHERE code = 'KAS3.07';
UPDATE ic_standards SET code = 'KAS3.8' WHERE code = 'KAS3.08';
UPDATE ic_standards SET code = 'KAS3.9' WHERE code = 'KAS3.09';
UPDATE ic_standards SET code = 'KAS3.10' WHERE code = 'KAS3.10';
UPDATE ic_standards SET code = 'KAS3.11' WHERE code = 'KAS3.11';
UPDATE ic_standards SET code = 'KAS3.12' WHERE code = 'KAS3.12';

-- Bilgi ve İletişim Standardı (BIS4)
UPDATE ic_standards SET code = 'BIS4.13' WHERE code = 'BIS4.13';
UPDATE ic_standards SET code = 'BIS4.14' WHERE code = 'BIS4.14';
UPDATE ic_standards SET code = 'BIS4.15' WHERE code = 'BIS4.15';
UPDATE ic_standards SET code = 'BIS4.16' WHERE code = 'BIS4.16';

-- İzleme Standardı (IS5)
UPDATE ic_standards SET code = 'IS5.17' WHERE code = 'IS5.17';
UPDATE ic_standards SET code = 'IS5.18' WHERE code = 'IS5.18';
