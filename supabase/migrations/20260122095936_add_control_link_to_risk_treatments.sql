/*
  # Add Control Link to Risk Treatments

  1. Changes
    - Add `risk_control_id` column to `risk_treatments` table (UUID, nullable)
    - Add `action_type` column to `risk_treatments` table (text)
    - Add foreign key constraint to `risk_controls` table
    - Add index for foreign key
    - Add check constraint for action_type values

  2. Action Types
    - NEW_CONTROL: Create a new control
    - IMPROVE_CONTROL: Improve an existing control
    - AUTOMATE_CONTROL: Automate an existing control
    - ENHANCE_CONTROL: Enhance control effectiveness
    - REMOVE_CONTROL: Remove or replace a control
    - OTHER: Other types of risk treatment actions

  3. Security
    - No RLS changes needed (inherits from risk_treatments table)
*/

-- Add risk_control_id column to risk_treatments
ALTER TABLE risk_treatments 
ADD COLUMN IF NOT EXISTS risk_control_id UUID;

-- Add action_type column to risk_treatments
ALTER TABLE risk_treatments 
ADD COLUMN IF NOT EXISTS action_type TEXT;

-- Add foreign key constraint to risk_controls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'risk_treatments_risk_control_id_fkey'
  ) THEN
    ALTER TABLE risk_treatments
    ADD CONSTRAINT risk_treatments_risk_control_id_fkey
    FOREIGN KEY (risk_control_id) REFERENCES risk_controls(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for risk_control_id
CREATE INDEX IF NOT EXISTS idx_risk_treatments_risk_control_id ON risk_treatments(risk_control_id);

-- Add check constraint for action_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'risk_treatments_action_type_check'
  ) THEN
    ALTER TABLE risk_treatments
    ADD CONSTRAINT risk_treatments_action_type_check
    CHECK (action_type IN ('NEW_CONTROL', 'IMPROVE_CONTROL', 'AUTOMATE_CONTROL', 'ENHANCE_CONTROL', 'REMOVE_CONTROL', 'OTHER'));
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN risk_treatments.risk_control_id IS 'Foreign key to risk_controls table - links treatment to a specific control';
COMMENT ON COLUMN risk_treatments.action_type IS 'Type of action: NEW_CONTROL, IMPROVE_CONTROL, AUTOMATE_CONTROL, ENHANCE_CONTROL, REMOVE_CONTROL, OTHER';
