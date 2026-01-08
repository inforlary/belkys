/*
  # Convert Special Responsible to Array for Multiple Selection

  1. Changes
    - Rename `special_responsible_type` to `special_responsible_types` and convert to text array
    - Remove `special_responsible` field (OTHER type custom text)
    - Add `other_responsible_description` field for custom role descriptions
    - This allows multiple special roles to be assigned as responsible (not just related)

  2. Purpose
    - Support multiple special responsible roles in addition to multiple departments
    - Improve flexibility in assigning responsibilities
    - Align responsible roles structure with related roles structure

  3. Data Migration
    - Safely migrate existing single special_responsible_type to array format
    - Preserve existing data
*/

DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'special_responsible_types'
  ) THEN
    ALTER TABLE ic_actions ADD COLUMN special_responsible_types text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'other_responsible_description'
  ) THEN
    ALTER TABLE ic_actions ADD COLUMN other_responsible_description text;
  END IF;

  -- Migrate existing data from special_responsible_type to special_responsible_types
  UPDATE ic_actions
  SET special_responsible_types = ARRAY[special_responsible_type]
  WHERE special_responsible_type IS NOT NULL 
    AND special_responsible_type != ''
    AND (special_responsible_types IS NULL OR array_length(special_responsible_types, 1) IS NULL);

  -- Migrate custom text from special_responsible to other_responsible_description
  UPDATE ic_actions
  SET other_responsible_description = special_responsible
  WHERE special_responsible IS NOT NULL 
    AND special_responsible != ''
    AND special_responsible_type = 'OTHER'
    AND (other_responsible_description IS NULL OR other_responsible_description = '');

  -- Drop old columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'special_responsible_type'
  ) THEN
    ALTER TABLE ic_actions DROP COLUMN special_responsible_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_actions' AND column_name = 'special_responsible'
  ) THEN
    ALTER TABLE ic_actions DROP COLUMN special_responsible;
  END IF;
END $$;