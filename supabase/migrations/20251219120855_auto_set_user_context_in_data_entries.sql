/*
  # Auto-set User Context in Data Entries
  
  1. Problem
    - INSERT policy queries profiles which has its own RLS
    - This creates circular dependency issues
    - Users getting 403 even with correct permissions
    
  2. Solution
    - Use trigger to auto-populate organization_id, department_id, entered_by
    - Simplify INSERT policy - just check user is authenticated
    - Validate permissions in trigger (SECURITY DEFINER bypasses RLS)
    
  3. Security
    - All user context set server-side, cannot be manipulated
    - Trigger validates permissions before insert
    - Failed validations throw clear errors
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS auto_set_user_context ON indicator_data_entries;
DROP TRIGGER IF EXISTS auto_set_entered_by ON indicator_data_entries;
DROP FUNCTION IF EXISTS set_user_context_for_data_entry();
DROP FUNCTION IF EXISTS set_entered_by();

-- Create comprehensive trigger function
CREATE OR REPLACE FUNCTION set_user_context_for_data_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_org_id uuid;
  v_user_dept_id uuid;
  v_indicator_dept_id uuid;
BEGIN
  -- Get user context from profiles (SECURITY DEFINER bypasses RLS)
  SELECT role, organization_id, department_id
  INTO v_user_role, v_user_org_id, v_user_dept_id
  FROM profiles
  WHERE id = auth.uid();
  
  -- User must exist
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı profili bulunamadı';
  END IF;
  
  -- Auto-set entered_by
  NEW.entered_by := auth.uid();
  
  -- Auto-set organization_id if not provided
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_user_org_id;
  END IF;
  
  -- Validate organization match
  IF NEW.organization_id != v_user_org_id THEN
    RAISE EXCEPTION 'Yetkiniz olmayan bir organizasyona veri ekleyemezsiniz';
  END IF;
  
  -- Get indicator's department
  SELECT g.department_id INTO v_indicator_dept_id
  FROM indicators i
  JOIN goals g ON g.id = i.goal_id
  WHERE i.id = NEW.indicator_id;
  
  -- Auto-set department_id if not provided
  IF NEW.department_id IS NULL THEN
    IF v_user_role IN ('admin', 'vice_president', 'super_admin') THEN
      -- Admins can set any department, default to indicator's department
      NEW.department_id := v_indicator_dept_id;
    ELSE
      -- Regular users use their own department
      NEW.department_id := v_user_dept_id;
    END IF;
  END IF;
  
  -- Validate department permissions
  IF v_user_role IN ('admin', 'vice_president', 'super_admin') THEN
    -- Admins can insert for any department in their org
    NULL;
  ELSIF v_user_role IN ('director', 'user') THEN
    -- Regular users can only insert for their own department
    IF NEW.department_id != v_user_dept_id THEN
      RAISE EXCEPTION 'Sadece kendi departmanınıza veri ekleyebilirsiniz';
    END IF;
  ELSE
    RAISE EXCEPTION 'Veri ekleme yetkiniz yok';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER auto_set_user_context
  BEFORE INSERT ON indicator_data_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_user_context_for_data_entry();

-- Drop and recreate simple INSERT policy
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Just verify user is authenticated
    -- All authorization is handled in trigger
    auth.uid() IS NOT NULL
  );

-- Grant permissions
GRANT EXECUTE ON FUNCTION set_user_context_for_data_entry() TO authenticated;
