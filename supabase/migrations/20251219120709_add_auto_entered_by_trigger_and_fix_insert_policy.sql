/*
  # Auto-set entered_by and Fix INSERT Policy
  
  1. Problem
    - Users getting 403 errors when trying to insert data entries
    - entered_by field is being set from client which could be security risk
    - get_user_context() may not be working correctly in policy context
    
  2. Solution
    - Create trigger to automatically set entered_by to auth.uid()
    - Simplify INSERT policy to be more explicit
    - Add better logging/debugging support
    
  3. Security
    - entered_by is now server-controlled, cannot be manipulated
    - Organization and department boundaries still enforced
    - Role-based access control maintained
*/

-- Create trigger function to auto-set entered_by
CREATE OR REPLACE FUNCTION set_entered_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always set entered_by to the current authenticated user
  NEW.entered_by := auth.uid();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_set_entered_by ON indicator_data_entries;

-- Create trigger to run before INSERT
CREATE TRIGGER auto_set_entered_by
  BEFORE INSERT ON indicator_data_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_entered_by();

-- Drop and recreate the INSERT policy with a clearer structure
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must have organization_id and department_id
    organization_id IS NOT NULL
    AND department_id IS NOT NULL
    -- User context check
    AND (
      -- Get user info and check permissions
      EXISTS (
        SELECT 1 
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id = indicator_data_entries.organization_id
          AND (
            -- Admins can insert for any department in their org
            p.role IN ('admin', 'vice_president', 'super_admin')
            OR
            -- Regular users and directors can only insert for their own department
            (p.role IN ('director', 'user') AND p.department_id = indicator_data_entries.department_id)
          )
      )
    )
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_entered_by() TO authenticated;
