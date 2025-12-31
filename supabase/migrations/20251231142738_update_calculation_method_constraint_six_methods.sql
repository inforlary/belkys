/*
  # Update Calculation Method Constraint for Six Methods

  1. Changes
    - Drop existing constraint 'indicators_calculation_method_check'
    - Add new constraint that includes all 6 calculation methods
  
  2. New Calculation Methods
    - cumulative_increasing: Kümülatif Artan Değer
    - cumulative_decreasing: Kümülatif Azalan Değer
    - percentage_increasing: Yüzde Artan Değer
    - percentage_decreasing: Yüzde Azalan Değer
    - maintenance_increasing: Artan Koruma Modeli
    - maintenance_decreasing: Azalan Koruma Modeli
  
  3. Backward Compatibility
    - Old values 'cumulative', 'percentage', 'maintenance', 'standard' are kept for backward compatibility
*/

-- Drop existing constraint
ALTER TABLE indicators DROP CONSTRAINT IF EXISTS indicators_calculation_method_check;

-- Add new constraint with all 6 methods plus legacy values
ALTER TABLE indicators ADD CONSTRAINT indicators_calculation_method_check 
CHECK (calculation_method IN (
  'standard',
  'cumulative',
  'percentage',
  'maintenance',
  'cumulative_increasing',
  'cumulative_decreasing',
  'percentage_increasing',
  'percentage_decreasing',
  'maintenance_increasing',
  'maintenance_decreasing',
  'increasing',
  'decreasing'
));