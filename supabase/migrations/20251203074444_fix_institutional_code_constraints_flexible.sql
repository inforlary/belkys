/*
  # Fix Institutional Code Check Constraints - Flexible Version

  1. Changes
    - Drop old check constraints that limit codes to exactly 2 digits
    - Add new flexible check constraints:
      - il_kodu: 2 digits (e.g., 41, 06, 81)
      - kurum_kodu: 2-5 digits to support both formats (e.g., "16" or "41116")
      - birim_kodu: 2 digits (e.g., 01, 18)
    
  2. Reason
    - Some organizations use 2-digit kurum_kodu (last 2 digits only)
    - Some organizations may want to use full 5-digit codes
    - This provides flexibility for both approaches
*/

-- Drop old constraints
ALTER TABLE budget_institutional_codes 
DROP CONSTRAINT IF EXISTS budget_institutional_codes_il_kodu_check;

ALTER TABLE budget_institutional_codes 
DROP CONSTRAINT IF EXISTS budget_institutional_codes_kurum_kodu_check;

ALTER TABLE budget_institutional_codes 
DROP CONSTRAINT IF EXISTS budget_institutional_codes_birim_kodu_check;

-- Add new flexible constraints
-- il_kodu: 2 digits (province code)
ALTER TABLE budget_institutional_codes 
ADD CONSTRAINT budget_institutional_codes_il_kodu_check 
CHECK (il_kodu ~ '^\d{2}$');

-- kurum_kodu: 2 to 5 digits (flexible - supports both short and full codes)
ALTER TABLE budget_institutional_codes 
ADD CONSTRAINT budget_institutional_codes_kurum_kodu_check 
CHECK (kurum_kodu IS NULL OR kurum_kodu ~ '^\d{2,5}$');

-- birim_kodu: 2 digits (unit code)
ALTER TABLE budget_institutional_codes 
ADD CONSTRAINT budget_institutional_codes_birim_kodu_check 
CHECK (birim_kodu IS NULL OR birim_kodu ~ '^\d{2}$');