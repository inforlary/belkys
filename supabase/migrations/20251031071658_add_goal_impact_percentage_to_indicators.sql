/*
  # Add Goal Impact Percentage to Indicators

  1. Changes
    - Add `goal_impact_percentage` column to `indicators` table
      - Type: numeric (decimal)
      - Range: 0-100 (percentage value)
      - Nullable: true (can be null for indicators without defined impact)
      - Default: null
    
  2. Purpose
    - Track how much each indicator contributes to its goal's overall progress
    - Used for weighted progress calculations across multiple indicators
    - Helps prioritize indicators based on their strategic importance
*/

-- Add goal_impact_percentage column to indicators table
ALTER TABLE indicators 
ADD COLUMN IF NOT EXISTS goal_impact_percentage numeric;

-- Add check constraint to ensure percentage is between 0 and 100
ALTER TABLE indicators
ADD CONSTRAINT goal_impact_percentage_range 
CHECK (goal_impact_percentage IS NULL OR (goal_impact_percentage >= 0 AND goal_impact_percentage <= 100));