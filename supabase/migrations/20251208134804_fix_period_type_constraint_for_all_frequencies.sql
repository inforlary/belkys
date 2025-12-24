/*
  # Fix period_type constraint to support all measurement frequencies

  1. Changes
    - Drop old check constraint on period_type
    - Add new check constraint that supports:
      - 'monthly' - for monthly measurements
      - 'quarterly' - for quarterly measurements (3-month periods)
      - 'semi-annual' - for semi-annual measurements (6-month periods)
      - 'annual' - for annual measurements (yearly)
      - 'yearly' - legacy support (same as annual)

  2. Security
    - No RLS changes needed
    
  3. Important Notes
    - This aligns the database with the indicator measurement_frequency values
    - Both 'annual' and 'yearly' are supported for backwards compatibility
*/

-- Drop the old constraint
ALTER TABLE indicator_data_entries 
  DROP CONSTRAINT IF EXISTS indicator_data_entries_period_type_check;

-- Add new constraint with all supported period types
ALTER TABLE indicator_data_entries
  ADD CONSTRAINT indicator_data_entries_period_type_check 
  CHECK (period_type IN ('monthly', 'quarterly', 'semi-annual', 'semi_annual', 'annual', 'yearly'));

-- Create unique constraint for semi-annual periods if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique_semi_annual 
  ON indicator_data_entries(indicator_id, period_year, period_quarter) 
  WHERE period_type IN ('semi-annual', 'semi_annual');

-- Create unique constraint for annual periods if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique_annual 
  ON indicator_data_entries(indicator_id, period_year) 
  WHERE period_type IN ('annual', 'yearly');