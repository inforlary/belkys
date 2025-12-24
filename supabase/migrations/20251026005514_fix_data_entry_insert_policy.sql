/*
  # Fix Data Entry Insert Policy

  ## Changes
  
  1. **Update INSERT policy for indicator_data_entries**
     - Allow inserting entries with 'draft' OR 'submitted' status
     - This enables users to directly submit data for approval
  
  ## Security
  - Users can only insert entries for indicators in their department
  - Users can only insert entries with their own user_id
  - Maintains organization isolation
*/

-- Drop the old policy
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

-- Create new policy that allows both draft and submitted status
CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_user_org()
    AND entered_by = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
    AND indicator_id IN (
      SELECT i.id
      FROM indicators i
      JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = current_user_dept()
    )
  );