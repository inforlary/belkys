/*
  # Fix IC Actions Related Objective Foreign Key

  1. Changes
    - Drop incorrect foreign key constraint referencing non-existent "objectives" table
    - Add correct foreign key constraint referencing "goals" table
    
  2. Notes
    - The system uses "goals" table, not "objectives"
    - related_objective_id column should reference goals(id)
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE ic_actions 
DROP CONSTRAINT IF EXISTS ic_actions_related_objective_id_fkey;

-- Add the correct foreign key constraint to goals table
ALTER TABLE ic_actions 
ADD CONSTRAINT ic_actions_related_objective_id_fkey 
FOREIGN KEY (related_objective_id) 
REFERENCES goals(id) 
ON DELETE SET NULL;
