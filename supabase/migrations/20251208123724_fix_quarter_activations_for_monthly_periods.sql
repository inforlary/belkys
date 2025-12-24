/*
  # Fix Quarter Activations for Monthly Periods
  
  1. Changes
    - Remove the check constraint on `quarter` column that limits values to 1-4
    - Add new check constraint allowing values 1-12 for monthly support
    
  2. Notes
    - This allows the system to support monthly (1-12), quarterly (1-4), semi-annual (1-2), and annual (1) periods
    - The quarter column is used as a generic "period" column for all frequency types
*/

-- Drop the existing constraint
ALTER TABLE quarter_activations 
DROP CONSTRAINT IF EXISTS quarter_activations_quarter_check;

-- Add new constraint allowing 1-12 (for monthly support)
ALTER TABLE quarter_activations 
ADD CONSTRAINT quarter_activations_quarter_check 
CHECK (quarter >= 1 AND quarter <= 12);
