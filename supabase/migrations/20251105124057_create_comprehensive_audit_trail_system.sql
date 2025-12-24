/*
  # Comprehensive Audit Trail System
  
  1. New Tables
    - `system_audit_logs` - Unified audit log table for all user activities
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key to profiles)
      - `user_email` (text) - Denormalized for faster queries
      - `user_name` (text) - Denormalized for display
      - `action_type` (text) - login, logout, create, update, delete, view, approve, reject
      - `entity_type` (text) - Table/module name
      - `entity_id` (uuid) - Record ID
      - `entity_name` (text) - Friendly name for display
      - `old_value` (jsonb) - Previous state
      - `new_value` (jsonb) - New state
      - `changes_summary` (text) - Human readable summary
      - `ip_address` (text)
      - `user_agent` (text)
      - `session_id` (uuid) - Track user sessions
      - `department_id` (uuid) - User's department at time of action
      - `severity` (text) - info, warning, critical
      - `status` (text) - success, failed, partial
      - `error_message` (text) - If action failed
      - `metadata` (jsonb) - Additional context
      - `created_at` (timestamptz)
      
    - `user_sessions` - Track user login sessions
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `organization_id` (uuid)
      - `login_at` (timestamptz)
      - `logout_at` (timestamptz)
      - `ip_address` (text)
      - `user_agent` (text)
      - `session_duration` (interval)
      - `is_active` (boolean)
      
  2. Security
    - Enable RLS on all tables
    - Admins can view all logs in their organization
    - Users can view their own logs
    - Super admins can view all logs
    
  3. Indexes
    - Optimized indexes for fast queries on audit logs
    - Composite indexes for common filter combinations
    
  4. Functions
    - Function to automatically log user actions
    - Function to calculate session duration
*/

-- Create system_audit_logs table
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  action_type text NOT NULL CHECK (action_type IN ('login', 'logout', 'create', 'update', 'delete', 'view', 'approve', 'reject', 'export', 'import', 'upload', 'download', 'archive', 'restore')),
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text,
  old_value jsonb,
  new_value jsonb,
  changes_summary text,
  ip_address text,
  user_agent text,
  session_id uuid,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  status text DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_email text,
  user_name text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  last_activity_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  session_duration interval,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_audit_logs

-- Admins and vice presidents can view all logs in their organization
CREATE POLICY "Admins can view all audit logs in their organization"
  ON system_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = system_audit_logs.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

-- Users can view their own logs
CREATE POLICY "Users can view their own audit logs"
  ON system_audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admins can view all logs
CREATE POLICY "Super admins can view all audit logs"
  ON system_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- System can insert logs (all authenticated users)
CREATE POLICY "System can insert audit logs"
  ON system_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for user_sessions

-- Admins can view all sessions in their organization
CREATE POLICY "Admins can view all user sessions in their organization"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = user_sessions.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admins can view all sessions
CREATE POLICY "Super admins can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Users can insert their own sessions
CREATE POLICY "Users can create their own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_created ON system_audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON system_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON system_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON system_audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON system_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON system_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON system_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON system_audit_logs(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action_created ON system_audit_logs(organization_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_entity_created ON system_audit_logs(organization_id, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_created ON system_audit_logs(user_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_org_active ON user_sessions(organization_id, is_active, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON user_sessions(login_at DESC);

-- Function to log user actions
CREATE OR REPLACE FUNCTION log_user_action(
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_changes_summary text DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_profile profiles%ROWTYPE;
  v_session_id uuid;
BEGIN
  -- Get user profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = auth.uid();
  
  -- Get or create session
  SELECT id INTO v_session_id
  FROM user_sessions
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY login_at DESC
  LIMIT 1;
  
  -- Insert audit log
  INSERT INTO system_audit_logs (
    organization_id,
    user_id,
    user_email,
    user_name,
    action_type,
    entity_type,
    entity_id,
    entity_name,
    old_value,
    new_value,
    changes_summary,
    session_id,
    department_id,
    severity,
    status,
    error_message,
    metadata
  ) VALUES (
    v_profile.organization_id,
    auth.uid(),
    v_profile.email,
    v_profile.full_name,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_value,
    p_new_value,
    p_changes_summary,
    v_session_id,
    v_profile.department_id,
    p_severity,
    p_status,
    p_error_message,
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start user session
CREATE OR REPLACE FUNCTION start_user_session(
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_session_id uuid;
  v_profile profiles%ROWTYPE;
BEGIN
  -- Get user profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = auth.uid();
  
  -- Close any existing active sessions
  UPDATE user_sessions
  SET is_active = false,
      logout_at = now(),
      session_duration = now() - login_at,
      updated_at = now()
  WHERE user_id = auth.uid()
    AND is_active = true;
  
  -- Create new session
  INSERT INTO user_sessions (
    user_id,
    organization_id,
    user_email,
    user_name,
    department_id,
    ip_address,
    user_agent,
    is_active
  ) VALUES (
    auth.uid(),
    v_profile.organization_id,
    v_profile.email,
    v_profile.full_name,
    v_profile.department_id,
    p_ip_address,
    p_user_agent,
    true
  ) RETURNING id INTO v_session_id;
  
  -- Log the login action
  PERFORM log_user_action(
    'login',
    'auth',
    auth.uid(),
    v_profile.full_name,
    NULL,
    NULL,
    'User logged in',
    'info',
    'success',
    NULL,
    jsonb_build_object('ip_address', p_ip_address, 'user_agent', p_user_agent)
  );
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end user session
CREATE OR REPLACE FUNCTION end_user_session(
  p_session_id uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_session_id uuid;
BEGIN
  -- If no session ID provided, get the active session
  IF p_session_id IS NULL THEN
    SELECT id INTO v_session_id
    FROM user_sessions
    WHERE user_id = auth.uid()
      AND is_active = true
    ORDER BY login_at DESC
    LIMIT 1;
  ELSE
    v_session_id := p_session_id;
  END IF;
  
  -- Update session
  UPDATE user_sessions
  SET is_active = false,
      logout_at = now(),
      session_duration = now() - login_at,
      updated_at = now()
  WHERE id = v_session_id;
  
  -- Log the logout action
  PERFORM log_user_action(
    'logout',
    'auth',
    auth.uid(),
    NULL,
    NULL,
    NULL,
    'User logged out',
    'info',
    'success',
    NULL,
    NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity() RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET last_activity_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;