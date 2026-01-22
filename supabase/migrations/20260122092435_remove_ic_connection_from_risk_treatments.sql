/*
  # Remove IC Connection from Risk Treatments

  1. Changes
    - Remove ic_condition_id and ic_action_id columns from risk_treatments table
    - Remove is_ic_action column from risk_treatments table
    - Drop related foreign key constraints
    - Remove ic_standard_id column (deprecated)

  2. Notes
    - Risk treatments will no longer have internal control connections
    - This simplifies the risk treatment workflow
    - Existing data in these columns will be lost
*/

-- Drop foreign key constraints first
ALTER TABLE risk_treatments DROP CONSTRAINT IF EXISTS risk_treatments_ic_condition_id_fkey;
ALTER TABLE risk_treatments DROP CONSTRAINT IF EXISTS risk_treatments_ic_action_id_fkey;
ALTER TABLE risk_treatments DROP CONSTRAINT IF EXISTS risk_treatments_ic_standard_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_risk_treatments_ic_condition_id;
DROP INDEX IF EXISTS idx_risk_treatments_ic_action_id;
DROP INDEX IF EXISTS idx_risk_treatments_ic_standard_id;

-- Remove columns
ALTER TABLE risk_treatments DROP COLUMN IF EXISTS ic_condition_id;
ALTER TABLE risk_treatments DROP COLUMN IF EXISTS ic_action_id;
ALTER TABLE risk_treatments DROP COLUMN IF EXISTS is_ic_action;
ALTER TABLE risk_treatments DROP COLUMN IF EXISTS ic_standard_id;
