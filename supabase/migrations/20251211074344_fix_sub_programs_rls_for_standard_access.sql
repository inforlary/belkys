/*
  # Fix sub_programs RLS to allow viewing standard (global) sub-programs

  1. Changes
    - Add RLS policy to allow all authenticated users to view standard sub-programs (organization_id IS NULL)
    - This enables organizations to map their departments to standard programs/sub-programs
  
  2. Security
    - Read-only access for standard sub-programs
    - Users still can only modify their own organization's sub-programs
*/

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Users can view standard global sub_programs" ON sub_programs;

-- Allow all authenticated users to view standard (global) sub-programs
CREATE POLICY "Users can view standard global sub_programs"
  ON sub_programs
  FOR SELECT
  TO authenticated
  USING (organization_id IS NULL);