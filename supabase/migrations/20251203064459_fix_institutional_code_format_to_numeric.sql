/*
  # Fix Institutional Code Format to Numeric (41116 format)
  
  1. Changes
    - Update tam_kod generation to use numeric format without dots
    - Level 1: 41116 (il_kodu + mahalli_idare_turu + kurum_kodu, without separators)
    - Level 2: 41116-02 (parent_code + '-' + birim_kodu)
  
  2. Migration Steps
    - Drop existing trigger
    - Create new trigger function with correct format
    - Recreate trigger
    - Update all existing tam_kod values
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trg_generate_budget_institutional_tam_kod ON budget_institutional_codes;

-- Create new trigger function with numeric format (no dots)
CREATE OR REPLACE FUNCTION generate_budget_institutional_tam_kod()
RETURNS TRIGGER AS $$
DECLARE
  parent_kod TEXT;
BEGIN
  IF NEW.level = 1 THEN
    -- Level 1: Format as 41116 (concatenate without separators)
    NEW.tam_kod := NEW.il_kodu || NEW.mahalli_idare_turu::text || NEW.kurum_kodu;
  ELSIF NEW.level = 2 THEN
    -- Level 2: Get parent code and append with hyphen
    IF NEW.parent_id IS NOT NULL THEN
      SELECT tam_kod INTO parent_kod FROM budget_institutional_codes WHERE id = NEW.parent_id;
      IF parent_kod IS NOT NULL THEN
        NEW.tam_kod := parent_kod || '-' || NEW.birim_kodu;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trg_generate_budget_institutional_tam_kod
  BEFORE INSERT OR UPDATE ON budget_institutional_codes
  FOR EACH ROW
  EXECUTE FUNCTION generate_budget_institutional_tam_kod();

-- Update all existing Level 1 codes
UPDATE budget_institutional_codes
SET tam_kod = il_kodu || mahalli_idare_turu::text || kurum_kodu
WHERE level = 1 AND is_active = true;

-- Update all existing Level 2 codes
UPDATE budget_institutional_codes child
SET tam_kod = parent.tam_kod || '-' || child.birim_kodu
FROM budget_institutional_codes parent
WHERE child.parent_id = parent.id 
  AND child.level = 2 
  AND child.is_active = true
  AND parent.is_active = true;
