/*
  # Add Hierarchical Structure to Institutional Codes

  1. Changes
    - Add `parent_id` column to enable hierarchical structure
    - Add `level` column (1 for Kurum, 2 for Müdürlük/Birim)
    - Make `birim_kodu` and `birim_adi` nullable for level 1 records
    - Convert existing records: create level 1 parent, then update to level 2
    - Update unique constraint to allow level 1 without birim
    - Add index for parent_id for faster hierarchical queries

  2. Migration Strategy
    - Add columns with nullable constraints first
    - Migrate existing data by creating parent records
    - Add stricter constraints after data migration
*/

-- Step 1: Add new columns for hierarchy (nullable first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_institutional_codes' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE budget_institutional_codes ADD COLUMN parent_id uuid REFERENCES budget_institutional_codes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_institutional_codes' AND column_name = 'level'
  ) THEN
    ALTER TABLE budget_institutional_codes ADD COLUMN level smallint DEFAULT 2;
  END IF;
END $$;

-- Step 2: Make birim fields nullable
ALTER TABLE budget_institutional_codes
  ALTER COLUMN birim_kodu DROP NOT NULL,
  ALTER COLUMN birim_adi DROP NOT NULL;

-- Step 3: Migrate existing data (convert each record to have a parent)
DO $$
DECLARE
  rec RECORD;
  parent_id_new uuid;
BEGIN
  FOR rec IN SELECT * FROM budget_institutional_codes WHERE level = 2 AND parent_id IS NULL AND is_active = true
  LOOP
    -- Create parent (level 1) record for this kurum if not exists
    INSERT INTO budget_institutional_codes (
      organization_id, 
      il_kodu, 
      il_adi, 
      mahalli_idare_turu, 
      kurum_kodu, 
      kurum_adi,
      birim_kodu,
      birim_adi,
      level,
      is_active,
      created_by,
      created_at
    ) VALUES (
      rec.organization_id,
      rec.il_kodu,
      rec.il_adi,
      rec.mahalli_idare_turu,
      rec.kurum_kodu,
      rec.kurum_adi,
      NULL,  -- no birim for level 1
      NULL,  -- no birim for level 1
      1,     -- level 1
      true,
      rec.created_by,
      rec.created_at
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO parent_id_new;

    -- If insert succeeded, get the id
    IF parent_id_new IS NULL THEN
      -- Already exists, find it
      SELECT id INTO parent_id_new
      FROM budget_institutional_codes
      WHERE organization_id = rec.organization_id
        AND il_kodu = rec.il_kodu
        AND mahalli_idare_turu = rec.mahalli_idare_turu
        AND kurum_kodu = rec.kurum_kodu
        AND level = 1
        AND is_active = true;
    END IF;

    -- Update the original record to point to parent
    IF parent_id_new IS NOT NULL THEN
      UPDATE budget_institutional_codes
      SET parent_id = parent_id_new
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- Step 4: Add constraints now that data is migrated
ALTER TABLE budget_institutional_codes
  ALTER COLUMN level SET NOT NULL,
  ADD CONSTRAINT budget_institutional_codes_level_check CHECK (level IN (1, 2));

-- Check: if level = 1, birim_kodu and birim_adi must be NULL
-- if level = 2, they must NOT be NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budget_institutional_codes_level_birim_check'
  ) THEN
    ALTER TABLE budget_institutional_codes
      ADD CONSTRAINT budget_institutional_codes_level_birim_check
      CHECK (
        (level = 1 AND birim_kodu IS NULL AND birim_adi IS NULL) OR
        (level = 2 AND birim_kodu IS NOT NULL AND birim_adi IS NOT NULL)
      );
  END IF;
END $$;

-- Check: if level = 2, parent_id must NOT be NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budget_institutional_codes_level_parent_check'
  ) THEN
    ALTER TABLE budget_institutional_codes
      ADD CONSTRAINT budget_institutional_codes_level_parent_check
      CHECK (
        (level = 1 AND parent_id IS NULL) OR
        (level = 2 AND parent_id IS NOT NULL)
      );
  END IF;
END $$;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_budget_institutional_codes_parent ON budget_institutional_codes(parent_id);
CREATE INDEX IF NOT EXISTS idx_budget_institutional_codes_level ON budget_institutional_codes(level);

-- Step 6: Drop old unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'budget_institutional_codes_organization_id_il_kodu_mahalli_ida_key'
  ) THEN
    ALTER TABLE budget_institutional_codes
      DROP CONSTRAINT budget_institutional_codes_organization_id_il_kodu_mahalli_ida_key;
  END IF;
END $$;

-- Step 7: Add new unique constraints
-- Level 1: unique by organization, il, tür, kurum
CREATE UNIQUE INDEX IF NOT EXISTS budget_institutional_codes_level1_unique
  ON budget_institutional_codes(organization_id, il_kodu, mahalli_idare_turu, kurum_kodu)
  WHERE level = 1 AND is_active = true;

-- Level 2: unique by parent and birim
CREATE UNIQUE INDEX IF NOT EXISTS budget_institutional_codes_level2_unique
  ON budget_institutional_codes(parent_id, birim_kodu)
  WHERE level = 2 AND is_active = true;

-- Step 8: Update trigger function to handle tam_kod for both levels
CREATE OR REPLACE FUNCTION generate_budget_institutional_tam_kod()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.level = 1 THEN
    -- Level 1: il.tür.kurum (e.g., 41.1.16)
    NEW.tam_kod := NEW.il_kodu || '.' || NEW.mahalli_idare_turu || '.' || NEW.kurum_kodu;
  ELSE
    -- Level 2: parent_kod-birim (e.g., 41.1.16-05)
    DECLARE
      parent_kod TEXT;
    BEGIN
      SELECT tam_kod INTO parent_kod FROM budget_institutional_codes WHERE id = NEW.parent_id;
      IF parent_kod IS NOT NULL THEN
        NEW.tam_kod := parent_kod || '-' || NEW.birim_kodu;
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Recreate trigger
DROP TRIGGER IF EXISTS trg_generate_budget_institutional_tam_kod ON budget_institutional_codes;
CREATE TRIGGER trg_generate_budget_institutional_tam_kod
  BEFORE INSERT OR UPDATE ON budget_institutional_codes
  FOR EACH ROW
  EXECUTE FUNCTION generate_budget_institutional_tam_kod();

-- Step 10: Update tam_kod for all existing records
UPDATE budget_institutional_codes SET updated_at = now() WHERE is_active = true;
