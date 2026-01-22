/*
  # Add Test Date Columns to Risk Controls

  1. New Columns
    - `last_test_date` (date, nullable) - Date when the control was last tested
    - `next_test_date` (date, nullable) - Date when the control should be tested next

  2. Changes
    - Adds test date tracking functionality to risk controls
    - These fields help track control testing schedules and compliance
*/

-- Add test date columns to risk_controls
ALTER TABLE risk_controls
ADD COLUMN IF NOT EXISTS last_test_date DATE,
ADD COLUMN IF NOT EXISTS next_test_date DATE;

-- Add helpful comments
COMMENT ON COLUMN risk_controls.last_test_date IS 'Date when this control was last tested';
COMMENT ON COLUMN risk_controls.next_test_date IS 'Scheduled date for the next test of this control';

-- Create index for next_test_date to help with finding upcoming tests
CREATE INDEX IF NOT EXISTS idx_risk_controls_next_test_date ON risk_controls(next_test_date) WHERE next_test_date IS NOT NULL;
