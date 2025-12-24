/*
  # İç Kontrol Tablosu Check Constraint Düzeltmesi
  
  1. Değişiklikler
    - `ic_controls` tablosunda `control_type` constraint'ine 'directive' tipi ekleniyor
    - `ic_controls` tablosunda `control_nature` constraint'i güncelleniyor ('semi_automated' yerine 'it_dependent')
  
  2. Açıklama
    - Frontend'de 'directive' kontrol tipi kullanılıyor ancak veritabanında eksik
    - Frontend'de 'it_dependent' kontrol niteliği kullanılıyor ancak veritabanında 'semi_automated' var
    - Bu uyumsuzluk check constraint hatalarına neden oluyor
*/

-- control_type constraint'ini güncelle (directive ekle)
ALTER TABLE ic_controls 
DROP CONSTRAINT IF EXISTS ic_controls_control_type_check;

ALTER TABLE ic_controls 
ADD CONSTRAINT ic_controls_control_type_check 
CHECK (control_type IN ('preventive', 'detective', 'corrective', 'directive'));

-- control_nature constraint'ini güncelle (it_dependent ekle)
ALTER TABLE ic_controls 
DROP CONSTRAINT IF EXISTS ic_controls_control_nature_check;

ALTER TABLE ic_controls 
ADD CONSTRAINT ic_controls_control_nature_check 
CHECK (control_nature IN ('manual', 'automated', 'it_dependent'));
