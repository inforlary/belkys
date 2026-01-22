/*
  # Proje Yönetimi Modülü Erişim Kontrolü

  1. Değişiklikler
    - organizations tablosuna module_project_management kolonu eklendi
    - Varsayılan değer: true (tüm organizasyonlar için aktif)
  
  2. Notlar
    - Mevcut organizasyonlar için otomatik olarak true olarak ayarlanır
*/

-- Proje Yönetimi modülü kolonu ekle
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'module_project_management'
  ) THEN
    ALTER TABLE organizations 
    ADD COLUMN module_project_management BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Mevcut organizasyonlar için true olarak ayarla
UPDATE organizations 
SET module_project_management = true 
WHERE module_project_management IS NULL;
