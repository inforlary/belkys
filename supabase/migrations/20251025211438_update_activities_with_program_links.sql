/*
  # Faaliyetleri Program ve Alt Programa Bağla (Link Activities to Programs/Sub-Programs)

  1. Changes
    - Add `program_id` column to activities table
    - Add `sub_program_id` column to activities table
    - These are optional (nullable) to maintain compatibility with existing data
    - Future activities can be linked to programs for budget integration

  2. Indexes
    - Index on program_id
    - Index on sub_program_id

  3. Notes
    - Existing activities without program links will still work
    - When creating budget entries, the activity's program/sub_program will be used
    - This creates the link between performance management and budget planning
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'program_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN program_id uuid REFERENCES programs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'sub_program_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN sub_program_id uuid REFERENCES sub_programs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_program ON activities(program_id);
CREATE INDEX IF NOT EXISTS idx_activities_sub_program ON activities(sub_program_id);