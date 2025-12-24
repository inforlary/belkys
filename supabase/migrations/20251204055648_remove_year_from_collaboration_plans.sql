/*
  # Remove year column from collaboration_plans
  
  1. Changes
    - Remove `year` column from `collaboration_plans` table
    - Year information now stored in `collaboration_plan_cost_estimates` table
    - Each plan can have multiple years with different cost estimates
  
  2. Rationale
    - The year field was causing NOT NULL constraint errors
    - New design uses separate cost_estimates table for multi-year planning
    - More flexible for plans spanning multiple years
*/

-- Remove year column from collaboration_plans
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaboration_plans' AND column_name = 'year'
  ) THEN
    ALTER TABLE collaboration_plans DROP COLUMN year;
  END IF;
END $$;
