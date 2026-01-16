/*
  # Update Risk Code Format

  1. Changes
    - Update all risk codes from 'R001' format to 'RSK-001' format
    - Ensures consistency across all risks

  2. Details
    - Updates existing risks with R format codes
    - Maintains the numeric sequence
*/

-- Update risk codes from R format to RSK- format
UPDATE risks
SET code = CONCAT('RSK-', LPAD(REGEXP_REPLACE(code, '[^0-9]', '', 'g'), 3, '0'))
WHERE code LIKE 'R%' AND code NOT LIKE 'RSK-%';
