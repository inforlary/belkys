/*
  # Enhance IC Actions with Continuous Actions and All Units Support

  1. New Columns
    - `is_continuous` (boolean) - Whether the action is continuous (no end date) or time-bound
    - `applies_to_all_units` (boolean) - Whether the action applies to all departments
    - `special_responsible` (varchar) - Special responsible person/role name (e.g., "Data Protection Officer")
    - `special_responsible_type` (varchar) - Type of special responsible (TOP_MANAGEMENT, INTERNAL_AUDITOR, etc.)

  2. Status Updates
    - Add new status 'ONGOING' for continuous actions that are actively running
    - Update constraint to include ONGOING status

  3. Changes
    - Make target_date nullable (continuous actions don't have end date)
    - Make responsible_department_id and related_department_ids nullable when applies_to_all_units is true
*/

-- Add new columns to ic_actions
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN DEFAULT false;
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS applies_to_all_units BOOLEAN DEFAULT false;
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS special_responsible VARCHAR(100);
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS special_responsible_type VARCHAR(50);
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS monitoring_period VARCHAR(20);

-- Update status constraint to include ONGOING
ALTER TABLE ic_actions DROP CONSTRAINT IF EXISTS ic_actions_status_check;
ALTER TABLE ic_actions ADD CONSTRAINT ic_actions_status_check 
  CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED', 'ON_HOLD', 'ONGOING'));

-- Make target_date nullable for continuous actions
ALTER TABLE ic_actions ALTER COLUMN target_date DROP NOT NULL;

-- Add check constraint for special_responsible_type values
ALTER TABLE ic_actions ADD CONSTRAINT ic_actions_special_responsible_type_check
  CHECK (special_responsible_type IS NULL OR special_responsible_type IN (
    'TOP_MANAGEMENT',
    'INTERNAL_AUDITOR',
    'ETHICS_COMMITTEE',
    'IT_COORDINATOR',
    'HR_COORDINATOR',
    'QUALITY_MANAGER',
    'RISK_COORDINATOR',
    'STRATEGY_COORDINATOR',
    'OTHER'
  ));

-- Add check constraint for monitoring_period values
ALTER TABLE ic_actions ADD CONSTRAINT ic_actions_monitoring_period_check
  CHECK (monitoring_period IS NULL OR monitoring_period IN (
    'CONTINUOUS',
    'MONTHLY',
    'QUARTERLY',
    'YEARLY'
  ));

-- Add comment explaining the new fields
COMMENT ON COLUMN ic_actions.is_continuous IS 'Whether this is a continuous action (true) or a time-bound action (false)';
COMMENT ON COLUMN ic_actions.applies_to_all_units IS 'Whether this action applies to all departments (true) or specific departments (false)';
COMMENT ON COLUMN ic_actions.special_responsible IS 'Name or title of special responsible person/role';
COMMENT ON COLUMN ic_actions.special_responsible_type IS 'Type of special responsible: TOP_MANAGEMENT, INTERNAL_AUDITOR, ETHICS_COMMITTEE, IT_COORDINATOR, HR_COORDINATOR, QUALITY_MANAGER, RISK_COORDINATOR, STRATEGY_COORDINATOR, OTHER';
COMMENT ON COLUMN ic_actions.monitoring_period IS 'For continuous actions: how often progress should be monitored (CONTINUOUS, MONTHLY, QUARTERLY, YEARLY)';
