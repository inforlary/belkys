/*
  # related_special_responsible_types JSONB'den Array'e Dönüştürme

  1. Değişiklikler
    - `related_special_responsible_types` kolonunu JSONB'den TEXT[] array'e dönüştür
    - Mevcut JSONB verileri array formatına migrate et
    - special_responsible_types ile aynı formatı kullan

  2. Amaç
    - Frontend ile daha uyumlu veri yapısı
    - Basit string array kullanımı
    - Consistent data structure

  3. Data Migration
    - Mevcut JSONB verileri güvenli şekilde array'e dönüştürülür
*/

DO $$
BEGIN
  -- Add new array column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'related_special_responsible_types_new'
  ) THEN
    ALTER TABLE ic_actions ADD COLUMN related_special_responsible_types_new text[];
  END IF;

  -- Migrate data from JSONB to array
  -- If JSONB is an array, extract values
  UPDATE ic_actions
  SET related_special_responsible_types_new = 
    CASE 
      WHEN jsonb_typeof(related_special_responsible_types) = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(related_special_responsible_types))
      ELSE
        NULL
    END
  WHERE related_special_responsible_types IS NOT NULL
    AND related_special_responsible_types_new IS NULL;

  -- Drop old column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'related_special_responsible_types' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE ic_actions DROP COLUMN related_special_responsible_types;
  END IF;

  -- Rename new column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'related_special_responsible_types_new'
  ) THEN
    ALTER TABLE ic_actions RENAME COLUMN related_special_responsible_types_new TO related_special_responsible_types;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN ic_actions.related_special_responsible_types IS 'İş birliği yapılacak özel birimler: TOP_MANAGEMENT, IC_MONITORING_BOARD, INTERNAL_AUDIT_BOARD, INTERNAL_AUDIT_COORDINATION_BOARD';
