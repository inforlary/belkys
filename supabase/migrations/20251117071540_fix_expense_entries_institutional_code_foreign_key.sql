/*
  # Fix expense_budget_entries institutional_code_id foreign key
  
  1. Changes
    - Drop the incorrect foreign key constraint pointing to institutional_codes
    - Create correct foreign key constraint pointing to budget_institutional_codes
  
  2. Reason
    - The application uses budget_institutional_codes table (with tam_kod, kurum_adi columns)
    - But foreign key was pointing to institutional_codes table (with code, name columns)
    - This mismatch caused foreign key constraint violations
*/

-- Drop the incorrect foreign key
ALTER TABLE expense_budget_entries 
DROP CONSTRAINT IF EXISTS expense_budget_entries_institutional_code_id_fkey;

-- Create the correct foreign key pointing to budget_institutional_codes
ALTER TABLE expense_budget_entries
ADD CONSTRAINT expense_budget_entries_institutional_code_id_fkey
FOREIGN KEY (institutional_code_id) 
REFERENCES budget_institutional_codes(id);
