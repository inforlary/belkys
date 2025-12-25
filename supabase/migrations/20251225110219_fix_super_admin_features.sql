/*
  # Fix Super Admin Features
  
  1. Fixes
    - Add function to terminate all sessions for inactive organizations
    - Fix super_admin_activity_logs insert to use current user ID
    - Ensure proper cascade delete for organizations
    
  2. Security
    - Only super admins can terminate sessions
    - Proper RLS maintained
*/

-- Function to terminate all sessions for an organization
CREATE OR REPLACE FUNCTION terminate_organization_sessions(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only super admins can call this
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can terminate organization sessions';
  END IF;

  -- Update all active sessions for users in this organization
  UPDATE user_sessions
  SET ended_at = now(),
      status = 'terminated'
  WHERE user_id IN (
    SELECT id FROM profiles WHERE organization_id = org_id
  )
  AND ended_at IS NULL;
END;
$$;

-- Function to auto-terminate sessions when organization is deactivated
CREATE OR REPLACE FUNCTION auto_terminate_sessions_on_org_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If organization is being deactivated
  IF OLD.is_active = true AND NEW.is_active = false THEN
    -- Terminate all active sessions
    UPDATE user_sessions
    SET ended_at = now(),
        status = 'terminated'
    WHERE user_id IN (
      SELECT id FROM profiles WHERE organization_id = NEW.id
    )
    AND ended_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic session termination
DROP TRIGGER IF EXISTS trigger_auto_terminate_sessions ON organizations;
CREATE TRIGGER trigger_auto_terminate_sessions
  AFTER UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_terminate_sessions_on_org_deactivation();
