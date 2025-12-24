/*
  # Advanced Features System

  1. New Tables
    - `indicator_files`: File attachments for indicators
      - `id` (uuid, primary key)
      - `indicator_id` (uuid, references indicators)
      - `file_name` (text)
      - `file_path` (text)
      - `file_size` (integer)
      - `file_type` (text)
      - `uploaded_by` (uuid, references profiles)
      - `created_at` (timestamptz)

    - `indicator_comments`: Comments and notes on indicators
      - `id` (uuid, primary key)
      - `indicator_id` (uuid, references indicators)
      - `user_id` (uuid, references profiles)
      - `comment` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `data_entry_comments`: Comments on data entries
      - `id` (uuid, primary key)
      - `data_entry_id` (uuid, references indicator_data_entries)
      - `user_id` (uuid, references profiles)
      - `comment` (text)
      - `created_at` (timestamptz)

    - `activity_logs`: Track all user actions
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `organization_id` (uuid, references organizations)
      - `action_type` (text) - 'create', 'update', 'delete', 'approve', etc
      - `entity_type` (text) - 'indicator', 'goal', 'data_entry', etc
      - `entity_id` (uuid)
      - `old_value` (jsonb)
      - `new_value` (jsonb)
      - `ip_address` (text)
      - `user_agent` (text)
      - `created_at` (timestamptz)

    - `user_favorites`: User's favorite indicators/goals
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `entity_type` (text) - 'indicator', 'goal', 'objective'
      - `entity_id` (uuid)
      - `created_at` (timestamptz)

    - `notifications`: System notifications
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `organization_id` (uuid)
      - `type` (text) - 'reminder', 'alert', 'success', 'approval_request'
      - `title` (text)
      - `message` (text)
      - `link` (text)
      - `is_read` (boolean)
      - `created_at` (timestamptz)

    - `reminders`: Scheduled reminders for data entry
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `indicator_id` (uuid, references indicators)
      - `reminder_type` (text) - 'quarterly', 'monthly', 'yearly'
      - `send_days_before` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `risk_alerts`: Automatic risk detection
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `indicator_id` (uuid, references indicators)
      - `year` (integer)
      - `quarter` (integer)
      - `risk_level` (text) - 'low', 'medium', 'high', 'critical'
      - `risk_type` (text) - 'deviation', 'missing_data', 'declining_trend'
      - `message` (text)
      - `is_resolved` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Indicator Files
CREATE TABLE IF NOT EXISTS indicator_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid REFERENCES indicators(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer DEFAULT 0,
  file_type text,
  uploaded_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE indicator_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their organization"
  ON indicator_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_files.organization_id
    )
  );

CREATE POLICY "Users can upload files"
  ON indicator_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_files.organization_id
    )
  );

CREATE POLICY "Users can delete their own files"
  ON indicator_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Indicator Comments
CREATE TABLE IF NOT EXISTS indicator_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid REFERENCES indicators(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE indicator_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments in their organization"
  ON indicator_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_comments.organization_id
    )
  );

CREATE POLICY "Users can create comments"
  ON indicator_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_comments.organization_id
    )
  );

CREATE POLICY "Users can update their own comments"
  ON indicator_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON indicator_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Data Entry Comments
CREATE TABLE IF NOT EXISTS data_entry_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_entry_id uuid REFERENCES indicator_data_entries(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_entry_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view data entry comments in their organization"
  ON data_entry_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = data_entry_comments.organization_id
    )
  );

CREATE POLICY "Users can create data entry comments"
  ON data_entry_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = data_entry_comments.organization_id
    )
  );

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  organization_id uuid NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = activity_logs.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = activity_logs.organization_id
    )
  );

-- User Favorites
CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON user_favorites FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own favorites"
  ON user_favorites FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own favorites"
  ON user_favorites FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = notifications.organization_id
    )
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  indicator_id uuid REFERENCES indicators(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  send_days_before integer DEFAULT 7,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminders"
  ON reminders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = reminders.organization_id
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = reminders.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Risk Alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  indicator_id uuid REFERENCES indicators(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL,
  quarter integer,
  risk_level text NOT NULL,
  risk_type text NOT NULL,
  message text NOT NULL,
  is_resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_org ON risk_alerts(organization_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_indicator ON risk_alerts(indicator_id);

ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk alerts in their organization"
  ON risk_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risk_alerts.organization_id
    )
  );

CREATE POLICY "System can create risk alerts"
  ON risk_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risk_alerts.organization_id
    )
  );

CREATE POLICY "Users can update risk alerts"
  ON risk_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risk_alerts.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risk_alerts.organization_id
    )
  );
