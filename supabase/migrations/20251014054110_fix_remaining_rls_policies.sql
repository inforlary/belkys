/*
  # Fix remaining RLS policies to avoid infinite recursion

  1. Affected Tables
    - departments
    - indicator_data_entries
    - messages

  2. Solution
    - Use helper functions: is_admin(), current_user_org(), current_user_dept()
    - Avoid nested SELECT queries on profiles table
    
  3. Security
    - Maintain same access control rules
    - Prevent infinite recursion
*/

-- Departments Policies
DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;

CREATE POLICY "select_departments"
  ON departments FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

CREATE POLICY "manage_departments"
  ON departments FOR ALL
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  )
  WITH CHECK (
    is_admin() AND organization_id = current_user_org()
  );

-- Indicator Data Entries Policies
DROP POLICY IF EXISTS "Users can view entries in their department" ON indicator_data_entries;
DROP POLICY IF EXISTS "Users can create entries for their indicators" ON indicator_data_entries;
DROP POLICY IF EXISTS "Users can update their own draft entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "Admins can update any entry" ON indicator_data_entries;
DROP POLICY IF EXISTS "Users can delete their own draft entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "Admins can delete any entry" ON indicator_data_entries;

-- Policy: Users can view entries in their org (admins see all, users see their dept)
CREATE POLICY "select_data_entries"
  ON indicator_data_entries FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      is_admin()
      OR
      indicator_id IN (
        SELECT i.id FROM indicators i
        JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = current_user_dept()
      )
    )
  );

-- Policy: Users can create draft entries for their department's indicators
CREATE POLICY "insert_data_entries"
  ON indicator_data_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_user_org()
    AND entered_by = auth.uid()
    AND status = 'draft'
    AND indicator_id IN (
      SELECT i.id FROM indicators i
      JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = current_user_dept()
    )
  );

-- Policy: Users can update their own draft or submitted entries
CREATE POLICY "update_own_draft_entries"
  ON indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    entered_by = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    entered_by = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
  );

-- Policy: Admins can update any entry in their org
CREATE POLICY "update_entries_admin"
  ON indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  )
  WITH CHECK (
    is_admin() AND organization_id = current_user_org()
  );

-- Policy: Users can delete their own draft entries
CREATE POLICY "delete_own_draft_entries"
  ON indicator_data_entries FOR DELETE
  TO authenticated
  USING (
    entered_by = auth.uid()
    AND status = 'draft'
  );

-- Policy: Admins can delete any entry in their org
CREATE POLICY "delete_entries_admin"
  ON indicator_data_entries FOR DELETE
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  );

-- Messages Policies (if they have recursion issues)
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;

CREATE POLICY "select_messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  );

CREATE POLICY "insert_messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_user_org()
    AND sender_id = auth.uid()
  );

CREATE POLICY "update_messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  )
  WITH CHECK (
    organization_id = current_user_org()
  );
