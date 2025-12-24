/*
  # İç Kontrol Testlerine ic_plan_id Ekleme
  
  1. Değişiklikler
    - `ic_control_tests` tablosuna `ic_plan_id` alanı ekleniyor
    - Bu alan kontrolün bağlı olduğu iç kontrol planını takip eder
    - İndeks ekleniyor performans için
  
  2. Açıklama
    - Frontend kodu ic_plan_id kullanarak testleri filtreliyor
    - Bu alan tabloda mevcut olmadığı için 403 hatası alınıyor
    - Plan bazlı veri izolasyonu sağlanıyor
*/

-- ic_plan_id alanını ekle
ALTER TABLE ic_control_tests 
ADD COLUMN IF NOT EXISTS ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_ic_control_tests_plan ON ic_control_tests(ic_plan_id);

-- Mevcut kayıtlar için ic_plan_id'yi kontrol tablosundan al
UPDATE ic_control_tests ct
SET ic_plan_id = c.ic_plan_id
FROM ic_controls c
WHERE ct.control_id = c.id
AND ct.ic_plan_id IS NULL;
