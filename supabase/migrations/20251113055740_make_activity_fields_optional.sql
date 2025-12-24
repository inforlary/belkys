/*
  # Make Activity Fields Optional

  1. Changes
    - Make `start_date` nullable in activities table
    - Make `end_date` nullable in activities table
    - Set default value for `budget` to 0 (already has default but ensure NOT NULL removed)
    - Set default value for `progress_percentage` to 0 (already has default but ensure NOT NULL removed)
  
  2. Reason
    - These fields are not required for basic activity creation
    - Users can focus on essential fields: goal, code, title, status
    - Department is auto-assigned from goal
*/

-- Make start_date and end_date nullable
ALTER TABLE activities 
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;

-- Ensure budget and progress_percentage have proper defaults
ALTER TABLE activities 
  ALTER COLUMN budget SET DEFAULT 0,
  ALTER COLUMN progress_percentage SET DEFAULT 0;
