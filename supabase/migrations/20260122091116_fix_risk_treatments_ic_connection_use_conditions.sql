/*
  # Fix Risk Treatments IC Connection - Use General Conditions

  1. Changes
    - Add `ic_condition_id` column to `risk_treatments` table
    - Add foreign key constraint to `ic_general_conditions`
    - Add index for performance
    - Keep `ic_standard_id` for backward compatibility but mark as deprecated

  2. Notes
    - Risk treatments should link to general conditions (ic_general_conditions), not standards
    - This aligns with how ic_actions work (they also use condition_id)
    - ic_standards table is global and doesn't have organization_id, causing the error
*/

-- Add ic_condition_id column to risk_treatments
ALTER TABLE risk_treatments
ADD COLUMN IF NOT EXISTS ic_condition_id UUID;

-- Add foreign key constraint to ic_general_conditions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'risk_treatments_ic_condition_id_fkey'
  ) THEN
    ALTER TABLE risk_treatments
    ADD CONSTRAINT risk_treatments_ic_condition_id_fkey
    FOREIGN KEY (ic_condition_id) REFERENCES ic_general_conditions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for foreign key
CREATE INDEX IF NOT EXISTS idx_risk_treatments_ic_condition_id ON risk_treatments(ic_condition_id);

-- Add comment
COMMENT ON COLUMN risk_treatments.ic_condition_id IS 'Foreign key to ic_general_conditions table - risk treatments link to general conditions, not standards';
COMMENT ON COLUMN risk_treatments.ic_standard_id IS 'DEPRECATED: Use ic_condition_id instead. Kept for backward compatibility.';
