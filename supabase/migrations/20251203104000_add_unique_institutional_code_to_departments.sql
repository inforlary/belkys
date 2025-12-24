/*
  # Add Unique Constraint for Institutional Codes in Departments

  1. Changes
    - Add unique constraint to `budget_institutional_code_id` in `departments` table
    - This ensures one institutional code can only be assigned to one department
    - Prevents duplicate institutional code assignments

  2. Security
    - No RLS changes needed
    - Constraint enforces data integrity at database level

  3. Notes
    - Duplicates have been cleaned up before adding this constraint
    - Each institutional code can now only belong to one department
*/

-- Add unique constraint to budget_institutional_code_id
-- This ensures each institutional code can only be assigned to one department
DO $$
BEGIN
  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'departments_budget_institutional_code_id_key'
  ) THEN
    ALTER TABLE departments 
    ADD CONSTRAINT departments_budget_institutional_code_id_key 
    UNIQUE (budget_institutional_code_id);
    
    RAISE NOTICE 'Unique constraint added successfully to departments.budget_institutional_code_id';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on departments.budget_institutional_code_id';
  END IF;
END $$;