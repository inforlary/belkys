/*
  # Update task_rotation_history action_type constraint

  1. Changes
    - Update action_type check constraint to include more action types
    - Add 'assignment' as a valid action type for non-initial assignments
    
  2. Valid action types:
    - initial_assignment: First time assignment
    - rotation: Regular rotation
    - assignment: Manual assignment/change
    - postponement: When rotation is postponed
*/

-- Drop existing constraint
ALTER TABLE task_rotation_history 
DROP CONSTRAINT IF EXISTS task_rotation_history_action_type_check;

-- Add updated constraint with more action types
ALTER TABLE task_rotation_history
ADD CONSTRAINT task_rotation_history_action_type_check 
CHECK (action_type IN ('initial_assignment', 'rotation', 'assignment', 'postponement'));