/*
  # Program Eşleştirmelerine Hedef (Goal) Alanı Ekleme

  1. Değişiklikler
    - `program_activity_indicator_mappings` tablosuna `goal_id` sütunu ekleniyor
    - Bu alan alt programın hangi stratejik hedefle ilişkili olduğunu gösterecek
    - Nullable olacak (zorunlu değil)
    - Goals tablosuna foreign key ile bağlanacak
  
  2. İş Mantığı
    - Müdürlükler alt programlarını kendi hedefleriyle eşleştirebilecek
    - Bu eşleştirme sayesinde performans programı ile stratejik plan arasında bağlantı kurulacak
    
  3. Notlar
    - Mevcut verileri etkilemez
    - Index eklenerek sorgu performansı artırılır
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_activity_indicator_mappings' AND column_name = 'goal_id'
  ) THEN
    ALTER TABLE program_activity_indicator_mappings 
    ADD COLUMN goal_id uuid REFERENCES goals(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_pai_mappings_goal ON program_activity_indicator_mappings(goal_id);
  END IF;
END $$;