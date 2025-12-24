/*
  # Eylem Planlarında Tamamlanma Tarihini Opsiyonel Yap

  1. Değişiklikler
    - `ic_action_plans` tablosundaki `completion_date` alanını nullable yap
    - Bu sayede eylem planı eklenirken tamamlanma tarihi opsiyonel olacak
  
  2. Notlar
    - Tamamlanma tarihi sadece eylem gerçekten tamamlandığında girilmeli
    - Planlanan eylemler için hedef tarih (target_date) kullanılmalı
*/

ALTER TABLE ic_action_plans
ALTER COLUMN completion_date DROP NOT NULL;
