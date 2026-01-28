/*
  # Remove Vice President ID from Goals Table
  
  1. Changes
    - Drop vice_president_id column from goals table
    - This column was used for VP performance tracking which is being removed
    
  2. Security
    - No RLS changes needed, just removing an unused column
*/

-- Drop vice_president_id column from goals table
ALTER TABLE goals DROP COLUMN IF EXISTS vice_president_id;

COMMENT ON TABLE goals IS 'Goals (Hedefler) - linked to objectives and departments';