/*
  # Eylem Planlarını Yeni KİKS Yapısına Güncelle

  1. Değişiklikler
    - `ic_action_plans` tablosuna `kiks_action_id` foreign key alanı eklenir
    - Eski `kiks_standard_id` alanı kaldırılır
    - `kiks_standard_code` ve `kiks_standard_title` alanları kaldırılır (bunlar artık join ile gelecek)
    
  2. Notlar
    - Yeni eylem planları ic_kiks_actions tablosundan gelecek
    - Belediyeler eylem seçip kendi planlarına ekleyebilecek
*/

-- Önce eski foreign key constraint'i kaldır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ic_action_plans_kiks_standard_id_fkey'
    AND table_name = 'ic_action_plans'
  ) THEN
    ALTER TABLE ic_action_plans DROP CONSTRAINT ic_action_plans_kiks_standard_id_fkey;
  END IF;
END $$;

-- Eski kolonları kaldır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plans' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_action_plans DROP COLUMN kiks_standard_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plans' AND column_name = 'kiks_standard_code'
  ) THEN
    ALTER TABLE ic_action_plans DROP COLUMN kiks_standard_code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plans' AND column_name = 'kiks_standard_title'
  ) THEN
    ALTER TABLE ic_action_plans DROP COLUMN kiks_standard_title;
  END IF;
END $$;

-- Yeni kiks_action_id kolonunu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plans' AND column_name = 'kiks_action_id'
  ) THEN
    ALTER TABLE ic_action_plans ADD COLUMN kiks_action_id uuid REFERENCES ic_kiks_actions(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_ic_action_plans_kiks_action_id ON ic_action_plans(kiks_action_id);
  END IF;
END $$;