/*
  # Fix Institutional Code Column Lengths

  1. Changes
    - Increase `kurum_kodu` from VARCHAR(2) to VARCHAR(10) to support 5-digit municipality codes
    - Increase `birim_kodu` from VARCHAR(2) to VARCHAR(10) to support 2-digit unit codes
    - Increase `tam_kod` from VARCHAR(15) to VARCHAR(30) to support full hierarchical codes
    
  2. Reason
    - Turkish municipality codes are 5 digits (e.g., 06106, 41116)
    - Unit codes can be 2 digits (e.g., 01, 02, 18)
    - Full codes can be longer when combined (e.g., 41116-18)
*/

-- Increase kurum_kodu length from 2 to 10 characters
ALTER TABLE budget_institutional_codes 
ALTER COLUMN kurum_kodu TYPE VARCHAR(10);

-- Increase birim_kodu length from 2 to 10 characters
ALTER TABLE budget_institutional_codes 
ALTER COLUMN birim_kodu TYPE VARCHAR(10);

-- Increase tam_kod length from 15 to 30 characters
ALTER TABLE budget_institutional_codes 
ALTER COLUMN tam_kod TYPE VARCHAR(30);