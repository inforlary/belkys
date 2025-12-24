/*
  # Alt Standartlara Makul Güvence Alanı Ekleme

  ## Değişiklikler
  
  1. `ic_kiks_sub_standards` tablosuna yeni alan ekleniyor:
    - `provides_reasonable_assurance` (boolean) - Mevcut durum makul güvence sağlıyor mu?
      - Default: false
      - Eğer true ise, bu alt standart için eylem planı eklenmeyecek
      - Eylem planı sayfasında "Mevcut durum makul güvence sağlamaktadır" mesajı gösterilecek
  
  2. Özellikler:
    - Boolean alan, default false
    - NULL değil
    - Mevcut kayıtlar için false olarak ayarlanır
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_sub_standards' 
    AND column_name = 'provides_reasonable_assurance'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards 
    ADD COLUMN provides_reasonable_assurance boolean DEFAULT false NOT NULL;
  END IF;
END $$;