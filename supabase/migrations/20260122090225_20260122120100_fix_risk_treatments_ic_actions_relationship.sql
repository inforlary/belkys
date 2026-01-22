/*
  # Fix IC Actions Relationship in Risk Treatments

  1. Changes
    - Ensures proper foreign key relationship between risk_treatments and ic_actions
    - Adds constraint name to avoid ambiguity when querying
    - Verifies ic_action_id foreign key is correctly configured

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Drop existing foreign key if it exists
ALTER TABLE risk_treatments 
DROP CONSTRAINT IF EXISTS risk_treatments_ic_action_id_fkey;

-- Re-add the foreign key with explicit naming to avoid ambiguity
ALTER TABLE risk_treatments
ADD CONSTRAINT risk_treatments_ic_action_id_fkey
FOREIGN KEY (ic_action_id) REFERENCES ic_actions(id) ON DELETE SET NULL;

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_risk_treatments_ic_action_id ON risk_treatments(ic_action_id) WHERE ic_action_id IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN risk_treatments.ic_action_id IS 'Foreign key to ic_actions table - links risk treatment to a specific IC action';
