/*
  # KİKS Standart Referanslarını Ana Standartlara Güncelle
  
  1. Değişiklikler
    - `ic_processes.kiks_standard_id` referansını `ic_kiks_main_standards`'a güncelle
    - `ic_risks.kiks_standard_id` referansını `ic_kiks_main_standards`'a güncelle
    
  2. Notlar
    - Mevcut veriler korunur
    - Foreign key constraint'ler yeniden oluşturulur
    - Hiyerarşik yapı ile uyumlu hale gelir
*/

-- ic_processes tablosundaki kiks_standard_id foreign key'ini güncelle
DO $$
BEGIN
  -- Eski constraint'i kaldır (varsa)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ic_processes_kiks_standard_id_fkey'
    AND table_name = 'ic_processes'
  ) THEN
    ALTER TABLE ic_processes 
    DROP CONSTRAINT ic_processes_kiks_standard_id_fkey;
  END IF;
  
  -- Yeni constraint ekle (ic_kiks_main_standards'a referans)
  ALTER TABLE ic_processes
  ADD CONSTRAINT ic_processes_kiks_standard_id_fkey
  FOREIGN KEY (kiks_standard_id) REFERENCES ic_kiks_main_standards(id) ON DELETE SET NULL;
END $$;

-- ic_risks tablosundaki kiks_standard_id foreign key'ini güncelle
DO $$
BEGIN
  -- Eski constraint'i kaldır (varsa)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ic_risks_kiks_standard_id_fkey'
    AND table_name = 'ic_risks'
  ) THEN
    ALTER TABLE ic_risks 
    DROP CONSTRAINT ic_risks_kiks_standard_id_fkey;
  END IF;
  
  -- Yeni constraint ekle (ic_kiks_main_standards'a referans)
  ALTER TABLE ic_risks
  ADD CONSTRAINT ic_risks_kiks_standard_id_fkey
  FOREIGN KEY (kiks_standard_id) REFERENCES ic_kiks_main_standards(id) ON DELETE SET NULL;
END $$;