/*
  # Add President Role and Executive Dashboard Features

  1. Changes
    - Add president_id column to organizations table
    - Create RLS policies for president role with read-only access to all data
    - Create function to automatically create president notifications for critical events
    - Add indexes for performance optimization
    - Create president_notifications table

  2. Security
    - President role has read-only access to all organizational data
    - President can view all reports but cannot modify any data
    - President receives critical notifications only
    - Only one president per organization
*/

-- Add president_id to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS president_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for president lookup
CREATE INDEX IF NOT EXISTS idx_organizations_president_id ON organizations(president_id);

-- Add comment
COMMENT ON COLUMN organizations.president_id IS 'Reference to the president user for this organization (only one per organization)';

-- Update profiles RLS policies to allow president read access
DROP POLICY IF EXISTS "Presidents can view all organization profiles" ON profiles;
CREATE POLICY "Presidents can view all organization profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'president' AND auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'president'
      AND p.organization_id = profiles.organization_id
    )
  );

-- Function to create president RLS policies for existing tables
CREATE OR REPLACE FUNCTION create_president_rls_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_record record;
  policy_sql text;
BEGIN
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'strategic_plans', 'objectives', 'goals', 'indicators', 'indicator_data_entries',
      'activities', 'departments', 'risks', 'risk_controls', 'risk_treatments',
      'risk_indicators', 'ic_plans', 'ic_actions', 'ic_action_plans', 'projects',
      'qm_processes', 'qm_dof_nonconformities', 'budget_programs',
      'budget_performance_forms', 'activity_reports', 'risk_categories',
      'collaborations', 'collaboration_plans'
    )
  LOOP
    -- Drop existing president policy
    EXECUTE format('DROP POLICY IF EXISTS "Presidents can view all %s" ON %I', table_record.tablename, table_record.tablename);
    
    -- Create new president policy
    policy_sql := format('
      CREATE POLICY "Presidents can view all %s"
        ON %I FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = ''president''
            AND profiles.organization_id = %I.organization_id
          )
        )',
      table_record.tablename,
      table_record.tablename,
      table_record.tablename
    );
    
    EXECUTE policy_sql;
  END LOOP;
END;
$$;

-- Execute the function to create policies
SELECT create_president_rls_policies();

-- Drop the function after use
DROP FUNCTION create_president_rls_policies();

-- Create notifications table for president
CREATE TABLE IF NOT EXISTS president_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  president_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('high_risk', 'low_performance', 'delayed_action', 'critical_dof', 'budget_variance')),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  related_module text NOT NULL,
  related_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create indexes for president notifications
CREATE INDEX IF NOT EXISTS idx_president_notifications_org ON president_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_president_notifications_president ON president_notifications(president_id);
CREATE INDEX IF NOT EXISTS idx_president_notifications_unread ON president_notifications(president_id, is_read) WHERE is_read = false;

-- Add RLS to president_notifications
ALTER TABLE president_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Presidents can view their notifications" ON president_notifications;
CREATE POLICY "Presidents can view their notifications"
  ON president_notifications FOR SELECT
  TO authenticated
  USING (president_id = auth.uid());

DROP POLICY IF EXISTS "Presidents can update their notifications" ON president_notifications;
CREATE POLICY "Presidents can update their notifications"
  ON president_notifications FOR UPDATE
  TO authenticated
  USING (president_id = auth.uid())
  WITH CHECK (president_id = auth.uid());

-- Function to create president notification
CREATE OR REPLACE FUNCTION create_president_notification(
  p_organization_id uuid,
  p_notification_type text,
  p_title text,
  p_message text,
  p_severity text,
  p_related_module text,
  p_related_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_president_id uuid;
BEGIN
  SELECT president_id INTO v_president_id
  FROM organizations
  WHERE id = p_organization_id;

  IF v_president_id IS NOT NULL THEN
    INSERT INTO president_notifications (
      organization_id,
      president_id,
      notification_type,
      title,
      message,
      severity,
      related_module,
      related_id
    ) VALUES (
      p_organization_id,
      v_president_id,
      p_notification_type,
      p_title,
      p_message,
      p_severity,
      p_related_module,
      p_related_id
    );
  END IF;
END;
$$;

-- Trigger to notify president on high/critical risks
CREATE OR REPLACE FUNCTION notify_president_on_high_risk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.risk_level IN ('Yüksek', 'Kritik', 'high', 'critical') THEN
    PERFORM create_president_notification(
      NEW.organization_id,
      'high_risk',
      'Yüksek Risk Tespit Edildi',
      format('Risk: %s - Seviye: %s', NEW.title, NEW.risk_level),
      CASE WHEN NEW.risk_level IN ('Kritik', 'critical') THEN 'critical' ELSE 'high' END,
      'risk_management',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_president_high_risk ON risks;
CREATE TRIGGER trigger_notify_president_high_risk
  AFTER INSERT OR UPDATE OF risk_level
  ON risks
  FOR EACH ROW
  WHEN (NEW.risk_level IN ('Yüksek', 'Kritik', 'high', 'critical'))
  EXECUTE FUNCTION notify_president_on_high_risk();

-- Add constraint to ensure only one president per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_president_per_org 
  ON profiles(organization_id) 
  WHERE role = 'president';

COMMENT ON INDEX idx_unique_president_per_org IS 'Ensures only one president per organization';
