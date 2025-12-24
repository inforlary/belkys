/*
  # Fix quarter_notifications RLS policies to avoid recursion

  1. Problem
    - Policies use SELECT on profiles table causing infinite recursion
    - Uses helper functions that were already created

  2. Solution
    - Use existing is_admin() and current_user_org() functions
    - Create new function for current_user_dept()
    - Simplify policies to avoid nested queries

  3. Security
    - Users can view notifications for their organization and department
    - Users can mark their own notifications as read
    - Admins can create notifications
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their department notifications" ON quarter_notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON quarter_notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON quarter_notifications;

-- Create function to get current user's department
CREATE OR REPLACE FUNCTION current_user_dept()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT department_id FROM profiles WHERE id = auth.uid();
$$;

-- Policy: Users can view notifications for their organization and department
CREATE POLICY "select_notifications"
  ON quarter_notifications FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      department_id IS NULL 
      OR department_id = current_user_dept()
    )
  );

-- Policy: Users can mark notifications as read
CREATE POLICY "update_notifications"
  ON quarter_notifications FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      department_id IS NULL 
      OR department_id = current_user_dept()
    )
  )
  WITH CHECK (
    organization_id = current_user_org()
  );

-- Policy: Admins can create notifications
CREATE POLICY "insert_notifications"
  ON quarter_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() AND organization_id = current_user_org()
  );
