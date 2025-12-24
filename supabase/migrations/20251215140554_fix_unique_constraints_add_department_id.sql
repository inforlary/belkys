/*
  # Fix Unique Constraints to Include Department ID

  1. Changes
    - Drop existing unique indexes that don't include department_id
    - Create new unique indexes that include department_id
    - This allows different departments to enter data for the same indicator and period

  2. Indexes Updated
    - idx_entries_unique_quarterly: Now includes department_id
    - idx_entries_unique_monthly: Now includes department_id
    - idx_entries_unique_yearly: Now includes department_id
    - idx_entries_unique_semi_annual: Now includes department_id
    - idx_entries_unique_annual: Now includes department_id

  3. Security
    - No RLS changes needed
    - This is a schema-only change to fix duplicate entry errors
*/

-- Drop old unique indexes
DROP INDEX IF EXISTS idx_entries_unique_quarterly;
DROP INDEX IF EXISTS idx_entries_unique_monthly;
DROP INDEX IF EXISTS idx_entries_unique_yearly;
DROP INDEX IF EXISTS idx_entries_unique_semi_annual;
DROP INDEX IF EXISTS idx_entries_unique_annual;

-- Create new unique indexes with department_id
CREATE UNIQUE INDEX idx_entries_unique_quarterly 
ON indicator_data_entries (indicator_id, period_year, period_quarter, department_id) 
WHERE period_type = 'quarterly';

CREATE UNIQUE INDEX idx_entries_unique_monthly 
ON indicator_data_entries (indicator_id, period_year, period_month, department_id) 
WHERE period_type = 'monthly';

CREATE UNIQUE INDEX idx_entries_unique_yearly 
ON indicator_data_entries (indicator_id, period_year, department_id) 
WHERE period_type = 'yearly';

CREATE UNIQUE INDEX idx_entries_unique_semi_annual 
ON indicator_data_entries (indicator_id, period_year, period_quarter, department_id) 
WHERE period_type IN ('semi-annual', 'semi_annual');

CREATE UNIQUE INDEX idx_entries_unique_annual 
ON indicator_data_entries (indicator_id, period_year, department_id) 
WHERE period_type IN ('annual', 'yearly');