/*
  # Fix Calculation Method Constraint

  1. Changes
    - Drop existing constraint 'indicators_calculation_method_check'
    - Add new constraint that includes 'maintenance' option
  
  2. Notes
    - Adds 'maintenance' (Koruma Modeli B = A) to valid calculation methods
*/

-- Drop existing constraint
ALTER TABLE indicators DROP CONSTRAINT IF EXISTS indicators_calculation_method_check;

-- Add new constraint with maintenance option
ALTER TABLE indicators ADD CONSTRAINT indicators_calculation_method_check 
CHECK (calculation_method IN ('standard', 'cumulative', 'percentage', 'cumulative_decreasing', 'maintenance'));