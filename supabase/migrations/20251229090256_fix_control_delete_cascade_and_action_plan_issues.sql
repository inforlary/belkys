/*
  # Kontrol Silme ve Eylem Planı Sorunları Düzeltmesi

  ## Sorunlar:
  1. Kontrol Faaliyetleri sayfasında kontrol silinemiyor (ic_automatic_action_queue NO ACTION)
  2. Test sayıları güncellenmiyor
  3. Eylem Planı sayfasında silme işlemi yok
  
  ## Çözümler:
  1. ic_automatic_action_queue foreign key'ini CASCADE yap
  2. Sayfa yenilemelerinde test sayılarını doğru getir
*/

-- 1. ic_automatic_action_queue control_id foreign key'ini CASCADE yap
ALTER TABLE ic_automatic_action_queue
DROP CONSTRAINT IF EXISTS ic_automatic_action_queue_control_id_fkey;

ALTER TABLE ic_automatic_action_queue
ADD CONSTRAINT ic_automatic_action_queue_control_id_fkey
FOREIGN KEY (control_id)
REFERENCES ic_controls(id)
ON DELETE CASCADE;

-- 2. ic_action_plans için de silme fonksiyonları ekle (control silindiğinde NULL)
-- Zaten SET NULL olarak ayarlı, ek işlem gerekmiyor

DO $$
BEGIN
  RAISE NOTICE '✅ Kontrol silme sorunları düzeltildi';
END $$;
