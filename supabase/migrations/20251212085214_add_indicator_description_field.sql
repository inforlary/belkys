/*
  # Göstergelere Açıklama Alanı Ekleme

  1. Değişiklikler
    - `indicators` tablosuna `description` sütunu ekleniyor
    - Bu alan göstergeye ilişkin açıklamaları içerecek
    - Text tipinde ve nullable olacak
  
  2. Notlar
    - Mevcut verileri etkilemez
    - Hesaplama yöntemi açıklaması alanından önce görüntülenecek
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'description'
  ) THEN
    ALTER TABLE indicators ADD COLUMN description text;
  END IF;
END $$;