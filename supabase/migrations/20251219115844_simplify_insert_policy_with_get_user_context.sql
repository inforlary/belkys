/*
  # Simplify INSERT Policy with get_user_context Function

  1. Problem
    - Previous approach using nested EXISTS queries causes RLS conflicts
    - Profiles table RLS blocks policy evaluation
    - Need a cleaner approach that works with existing infrastructure

  2. Solution
    - Use existing get_user_context() function if it exists
    - Otherwise create a new security definer function
    - Simplify policy logic to avoid RLS conflicts

  3. Security
    - Maintain organization and department boundaries
    - Role-based access control preserved
    - All users must be authenticated
*/

-- Check if get_user_context exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_context'
  ) THEN
    CREATE FUNCTION get_user_context()
    RETURNS TABLE (
      org_id uuid,
      dept_id uuid,
      user_role text
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        organization_id,
        department_id,
        role
      FROM profiles
      WHERE id = auth.uid();
    END;
    $func$;
  END IF;
END $$;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

-- Create simplified INSERT policy
CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    entered_by = auth.uid()
    AND organization_id IS NOT NULL
    AND department_id IS NOT NULL
    AND (
      -- Check using get_user_context to bypass RLS issues
      EXISTS (
        SELECT 1 FROM get_user_context() uc
        WHERE uc.org_id = indicator_data_entries.organization_id
          AND (
            -- Admins and vice presidents can insert for any department
            uc.user_role IN ('admin', 'vice_president', 'super_admin')
            OR
            -- Directors and users can only insert for their department
            (uc.user_role IN ('director', 'user') AND uc.dept_id = indicator_data_entries.department_id)
          )
      )
    )
  );
