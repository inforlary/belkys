/*
  # Add notes column to risk_treatments table

  1. Changes
    - Add `notes` column to risk_treatments table to store additional information about treatments
    
  2. Details
    - Column type: TEXT (for longer notes)
    - Nullable: Yes (notes are optional)
    - No default value needed
*/

-- Add notes column to risk_treatments
ALTER TABLE risk_treatments 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN risk_treatments.notes IS 'Additional notes and information about the risk treatment';
