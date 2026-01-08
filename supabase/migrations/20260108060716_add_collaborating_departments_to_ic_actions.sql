/*
  # Add Collaborating Departments to IC Actions

  1. Changes
    - Add `collaborating_departments_ids` column to `ic_actions` table
      - Array of UUIDs for departments that will collaborate on the action
      - Nullable (not all actions require collaboration)
  
  2. Purpose
    - Track which departments will collaborate with the responsible department
    - Support multiple collaborating departments for each action
*/

-- Add collaborating departments column to ic_actions
ALTER TABLE ic_actions 
ADD COLUMN IF NOT EXISTS collaborating_departments_ids uuid[] DEFAULT '{}';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ic_actions_collaborating_departments 
ON ic_actions USING GIN (collaborating_departments_ids);