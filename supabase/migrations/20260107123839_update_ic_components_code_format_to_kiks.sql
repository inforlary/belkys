/*
  # Update IC Components Code Format to KIKS Standard

  1. Changes
    - Update ic_components code format to match KIKS numbering
    - KO -> KOS1 (Kontrol Ortamı Standardı)
    - RD -> RDS2 (Risk Değerlendirme Standardı)
    - KF -> KAS3 (Kontrol Faaliyetleri Standardı)
    - BI -> BIS4 (Bilgi ve İletişim Standardı)
    - IZ -> IS5 (İzleme Standardı)

  2. Notes
    - This allows full KIKS format: KOS1.01.1, RDS2.01.1, etc.
*/

-- Update component codes to KIKS format
UPDATE ic_components SET code = 'KOS1' WHERE code = 'KO';
UPDATE ic_components SET code = 'RDS2' WHERE code = 'RD';
UPDATE ic_components SET code = 'KAS3' WHERE code = 'KF';
UPDATE ic_components SET code = 'BIS4' WHERE code = 'BI';
UPDATE ic_components SET code = 'IS5' WHERE code = 'IZ';
