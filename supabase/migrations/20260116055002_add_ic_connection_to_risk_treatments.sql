/*
  # Add Internal Control Connection to Risk Treatments

  ## Changes
  1. New Columns to `risk_treatments`
    - `is_ic_action` (boolean) - Indicates if this risk treatment is linked to an IC action
    - `ic_standard_id` (uuid) - Foreign key to ic_standards table
    - `ic_action_id` (uuid) - Foreign key to ic_actions table

  2. Foreign Keys
    - Link to ic_standards for standard reference
    - Link to ic_actions for action reference

  3. Indexes
    - Add indexes for foreign keys to improve query performance
*/

-- Add new columns to risk_treatments
ALTER TABLE risk_treatments
ADD COLUMN IF NOT EXISTS is_ic_action BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ic_standard_id UUID,
ADD COLUMN IF NOT EXISTS ic_action_id UUID;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'risk_treatments_ic_standard_id_fkey'
  ) THEN
    ALTER TABLE risk_treatments
    ADD CONSTRAINT risk_treatments_ic_standard_id_fkey
    FOREIGN KEY (ic_standard_id) REFERENCES ic_standards(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'risk_treatments_ic_action_id_fkey'
  ) THEN
    ALTER TABLE risk_treatments
    ADD CONSTRAINT risk_treatments_ic_action_id_fkey
    FOREIGN KEY (ic_action_id) REFERENCES ic_actions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_risk_treatments_ic_standard_id ON risk_treatments(ic_standard_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatments_ic_action_id ON risk_treatments(ic_action_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatments_is_ic_action ON risk_treatments(is_ic_action);

-- Add comment
COMMENT ON COLUMN risk_treatments.is_ic_action IS 'Indicates if this risk treatment is linked to an Internal Control action';
COMMENT ON COLUMN risk_treatments.ic_standard_id IS 'Foreign key to ic_standards table';
COMMENT ON COLUMN risk_treatments.ic_action_id IS 'Foreign key to ic_actions table';
