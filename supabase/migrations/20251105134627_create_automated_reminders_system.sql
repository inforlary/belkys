/*
  # Automated Reminders System
  
  1. New Tables
    - `reminder_rules` - Reminder configuration rules
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `name` (text) - Rule name
      - `reminder_type` (text) - deadline, data_entry, approval, custom
      - `entity_type` (text) - activity, indicator, approval, etc.
      - `trigger_before_days` (integer) - Days before deadline
      - `trigger_time` (time) - Time of day to send
      - `is_active` (boolean)
      - `recipients` (text[]) - user_ids or roles
      - `message_template` (text)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      
    - `scheduled_reminders` - Scheduled reminder instances
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `rule_id` (uuid, foreign key)
      - `entity_type` (text)
      - `entity_id` (uuid)
      - `recipient_id` (uuid, foreign key)
      - `scheduled_for` (timestamptz)
      - `status` (text) - pending, sent, failed, cancelled
      - `sent_at` (timestamptz)
      - `error_message` (text)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      
    - `reminder_preferences` - User reminder preferences
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `reminder_type` (text)
      - `email_enabled` (boolean)
      - `in_app_enabled` (boolean)
      - `frequency` (text) - daily, weekly, immediate
      - `quiet_hours_start` (time)
      - `quiet_hours_end` (time)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on all tables
    - Admins can manage rules
    - Users can view their reminders
    - Users can manage their preferences
    
  3. Functions
    - Function to generate reminders
    - Function to send reminder notifications
    - Function to check overdue items
*/

-- Create reminder_rules table
CREATE TABLE IF NOT EXISTS reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('deadline', 'data_entry', 'approval', 'custom')),
  entity_type text NOT NULL,
  trigger_before_days integer DEFAULT 1,
  trigger_time time DEFAULT '09:00:00',
  is_active boolean DEFAULT true,
  recipients text[] DEFAULT '{}',
  message_template text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create scheduled_reminders table
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  rule_id uuid REFERENCES reminder_rules(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create reminder_preferences table
CREATE TABLE IF NOT EXISTS reminder_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reminder_type text NOT NULL,
  email_enabled boolean DEFAULT true,
  in_app_enabled boolean DEFAULT true,
  frequency text DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'immediate')),
  quiet_hours_start time DEFAULT '22:00:00',
  quiet_hours_end time DEFAULT '08:00:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, reminder_type)
);

-- Enable RLS
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_rules
CREATE POLICY "Admins can manage reminder rules"
  ON reminder_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = reminder_rules.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Users can view reminder rules in their org"
  ON reminder_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = reminder_rules.organization_id
    )
  );

-- RLS Policies for scheduled_reminders
CREATE POLICY "Users can view their own reminders"
  ON scheduled_reminders FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "System can manage reminders"
  ON scheduled_reminders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = scheduled_reminders.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

-- RLS Policies for reminder_preferences
CREATE POLICY "Users can manage their own preferences"
  ON reminder_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reminder_rules_org ON reminder_rules(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_recipient ON scheduled_reminders(recipient_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status ON scheduled_reminders(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminder_preferences_user ON reminder_preferences(user_id);

-- Function to generate deadline reminders for activities
CREATE OR REPLACE FUNCTION generate_activity_deadline_reminders()
RETURNS void AS $$
DECLARE
  v_rule reminder_rules%ROWTYPE;
  v_activity RECORD;
  v_recipient_id uuid;
  v_scheduled_time timestamptz;
BEGIN
  FOR v_rule IN 
    SELECT * FROM reminder_rules 
    WHERE is_active = true 
    AND reminder_type = 'deadline'
    AND entity_type = 'activity'
  LOOP
    FOR v_activity IN
      SELECT 
        a.id,
        a.organization_id,
        a.title,
        a.end_date,
        a.assigned_user_id,
        a.department_id,
        d.name as department_name
      FROM activities a
      LEFT JOIN departments d ON d.id = a.department_id
      WHERE a.organization_id = v_rule.organization_id
      AND a.status IN ('planned', 'in_progress')
      AND a.end_date::date = (CURRENT_DATE + v_rule.trigger_before_days)
    LOOP
      IF v_activity.assigned_user_id IS NOT NULL THEN
        v_recipient_id := v_activity.assigned_user_id;
      ELSIF v_activity.department_id IS NOT NULL THEN
        SELECT id INTO v_recipient_id
        FROM profiles
        WHERE department_id = v_activity.department_id
        AND role IN ('admin', 'manager')
        LIMIT 1;
      ELSE
        CONTINUE;
      END IF;

      v_scheduled_time := (CURRENT_DATE + v_rule.trigger_before_days)::timestamp + v_rule.trigger_time;

      INSERT INTO scheduled_reminders (
        organization_id,
        rule_id,
        entity_type,
        entity_id,
        recipient_id,
        scheduled_for,
        status,
        metadata
      ) VALUES (
        v_rule.organization_id,
        v_rule.id,
        'activity',
        v_activity.id,
        v_recipient_id,
        v_scheduled_time,
        'pending',
        jsonb_build_object(
          'activity_title', v_activity.title,
          'end_date', v_activity.end_date,
          'department', v_activity.department_name
        )
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate data entry reminders
CREATE OR REPLACE FUNCTION generate_data_entry_reminders()
RETURNS void AS $$
DECLARE
  v_rule reminder_rules%ROWTYPE;
  v_indicator RECORD;
  v_user RECORD;
  v_scheduled_time timestamptz;
  v_current_month integer;
  v_current_quarter integer;
  v_current_year integer;
BEGIN
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  v_current_quarter := CEIL(v_current_month / 3.0);
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  FOR v_rule IN 
    SELECT * FROM reminder_rules 
    WHERE is_active = true 
    AND reminder_type = 'data_entry'
    AND entity_type = 'indicator'
  LOOP
    FOR v_indicator IN
      SELECT 
        i.id,
        i.organization_id,
        i.name,
        i.code,
        i.reporting_frequency,
        g.department_id
      FROM indicators i
      JOIN goals g ON g.id = i.goal_id
      WHERE i.organization_id = v_rule.organization_id
      AND NOT EXISTS (
        SELECT 1 FROM indicator_data_entries ide
        WHERE ide.indicator_id = i.id
        AND ide.period_year = v_current_year
        AND (
          (i.reporting_frequency = 'monthly' AND ide.period_month = v_current_month) OR
          (i.reporting_frequency = 'quarterly' AND ide.period_quarter = v_current_quarter)
        )
      )
    LOOP
      FOR v_user IN
        SELECT id
        FROM profiles
        WHERE organization_id = v_rule.organization_id
        AND (
          department_id = v_indicator.department_id OR
          role IN ('admin', 'vice_president')
        )
      LOOP
        v_scheduled_time := CURRENT_DATE::timestamp + v_rule.trigger_time;

        INSERT INTO scheduled_reminders (
          organization_id,
          rule_id,
          entity_type,
          entity_id,
          recipient_id,
          scheduled_for,
          status,
          metadata
        ) VALUES (
          v_rule.organization_id,
          v_rule.id,
          'indicator',
          v_indicator.id,
          v_user.id,
          v_scheduled_time,
          'pending',
          jsonb_build_object(
            'indicator_name', v_indicator.name,
            'indicator_code', v_indicator.code,
            'period_type', v_indicator.reporting_frequency,
            'period_month', v_current_month,
            'period_quarter', v_current_quarter,
            'period_year', v_current_year
          )
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send pending reminders as notifications
CREATE OR REPLACE FUNCTION send_pending_reminders()
RETURNS integer AS $$
DECLARE
  v_reminder RECORD;
  v_count integer := 0;
  v_message text;
BEGIN
  FOR v_reminder IN
    SELECT 
      sr.*,
      rr.message_template,
      rr.name as rule_name,
      p.full_name as recipient_name
    FROM scheduled_reminders sr
    JOIN reminder_rules rr ON rr.id = sr.rule_id
    JOIN profiles p ON p.id = sr.recipient_id
    WHERE sr.status = 'pending'
    AND sr.scheduled_for <= now()
    ORDER BY sr.scheduled_for
    LIMIT 100
  LOOP
    BEGIN
      v_message := v_reminder.message_template;
      
      IF v_reminder.metadata IS NOT NULL THEN
        v_message := regexp_replace(v_message, '\{\{([^}]+)\}\}', 
          COALESCE(v_reminder.metadata->>'\1', ''), 'g');
      END IF;

      PERFORM create_notification(
        v_reminder.recipient_id,
        v_reminder.organization_id,
        'reminder',
        v_reminder.rule_name,
        v_message,
        'medium',
        'general',
        NULL, NULL,
        v_reminder.entity_type,
        v_reminder.entity_id,
        NULL,
        7
      );

      UPDATE scheduled_reminders
      SET status = 'sent',
          sent_at = now()
      WHERE id = v_reminder.id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE scheduled_reminders
      SET status = 'failed',
          error_message = SQLERRM
      WHERE id = v_reminder.id;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and create overdue reminders
CREATE OR REPLACE FUNCTION check_overdue_items()
RETURNS void AS $$
BEGIN
  INSERT INTO scheduled_reminders (
    organization_id,
    entity_type,
    entity_id,
    recipient_id,
    scheduled_for,
    status,
    metadata
  )
  SELECT 
    a.organization_id,
    'activity',
    a.id,
    COALESCE(a.assigned_user_id, (
      SELECT id FROM profiles 
      WHERE department_id = a.department_id 
      AND role IN ('admin', 'manager')
      LIMIT 1
    )),
    now(),
    'pending',
    jsonb_build_object(
      'activity_title', a.title,
      'end_date', a.end_date,
      'days_overdue', CURRENT_DATE - a.end_date::date
    )
  FROM activities a
  WHERE a.status IN ('planned', 'in_progress')
  AND a.end_date < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM scheduled_reminders sr
    WHERE sr.entity_type = 'activity'
    AND sr.entity_id = a.id
    AND sr.status = 'sent'
    AND sr.sent_at > CURRENT_DATE - INTERVAL '1 day'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default reminder preferences for existing users
INSERT INTO reminder_preferences (user_id, reminder_type, email_enabled, in_app_enabled)
SELECT 
  id,
  reminder_type,
  true,
  true
FROM profiles
CROSS JOIN (
  VALUES ('deadline'), ('data_entry'), ('approval'), ('custom')
) AS rt(reminder_type)
ON CONFLICT (user_id, reminder_type) DO NOTHING;

-- Trigger to update reminder_preferences timestamp
CREATE OR REPLACE FUNCTION update_reminder_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_reminder_preferences_updated_at
  BEFORE UPDATE ON reminder_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_preferences_timestamp();