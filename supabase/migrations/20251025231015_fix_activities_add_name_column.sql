/*
  # Fix Activities table - Add name column

  1. Changes
    - Add 'name' column to activities table (for budget program integration)
    - Copy existing 'title' values to 'name'
    - Make 'name' NOT NULL
  
  2. Notes
    - This fixes the column name inconsistency
    - Activities will have both 'title' (for strategic planning) and 'name' (for budget programs)
*/

-- Add name column
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS name text;

-- Copy title to name for existing records
UPDATE activities 
SET name = title 
WHERE name IS NULL;

-- Make name NOT NULL
ALTER TABLE activities 
ALTER COLUMN name SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_activities_name ON activities(name);
