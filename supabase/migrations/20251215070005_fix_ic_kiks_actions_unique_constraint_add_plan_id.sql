/*
  # Fix ic_kiks_actions unique constraint to include ic_plan_id

  1. Problem
    - Current constraint: UNIQUE (organization_id, sub_standard_id, code)
    - This prevents using the same code for the same standard in different plans
    - Example: KOS 1.1.1 can only exist once per organization, even across different plans

  2. Solution
    - Drop the old constraint
    - Add new constraint: UNIQUE (organization_id, ic_plan_id, sub_standard_id, code)
    - This allows the same code to be used in different plans

  3. Impact
    - Users can now create actions with the same code for the same standard in different plans
    - Each plan can have its own set of actions with proper codes (KOS 1.1.1, KOS 1.1.2, etc.)
*/

-- Drop the old constraint
ALTER TABLE ic_kiks_actions 
DROP CONSTRAINT IF EXISTS ic_kiks_actions_organization_id_sub_standard_id_code_key;

-- Add the new constraint with ic_plan_id included
ALTER TABLE ic_kiks_actions
ADD CONSTRAINT ic_kiks_actions_organization_id_plan_id_sub_standard_id_code_key
UNIQUE (organization_id, ic_plan_id, sub_standard_id, code);

-- Create an index to improve query performance
CREATE INDEX IF NOT EXISTS idx_ic_kiks_actions_plan_standard 
ON ic_kiks_actions(ic_plan_id, sub_standard_id);
