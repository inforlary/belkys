/*
  # Fix Indicator Mapping Constraint
  
  1. Changes
    - Drop the overly restrictive `unique_indicator_usage` constraint
    - The existing composite unique constraint (organization_id, activity_id, indicator_id, fiscal_year) 
      is sufficient and correct
    
  2. Reasoning
    - An indicator can be used in multiple activities
    - The same indicator should not be mapped to the same activity twice in the same fiscal year
    - The composite constraint ensures this correctly
*/

-- Drop the problematic constraint
ALTER TABLE program_activity_indicator_mappings
DROP CONSTRAINT IF EXISTS unique_indicator_usage;
