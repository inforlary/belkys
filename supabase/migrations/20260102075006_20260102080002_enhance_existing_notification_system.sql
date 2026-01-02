/*
  # Enhance Existing Notification System

  1. Modifications
    - Alter existing `notifications` table with new columns
    - Rename `type` to `notification_type` if needed
    - Rename `link` to `action_url` if needed
    - Add missing columns for comprehensive notification system

  2. New Tables
    - `notification_templates`: Reusable templates
    - `notification_preferences`: User preferences
    - `notification_read_receipts`: Read tracking

  3. Functions
    - Notification creation and management
    - Preference checking

  4. Security
    - RLS policies for data isolation
*/

-- First, let's enhance the existing notifications table
DO $$
BEGIN
  -- Add notification_type column if not exists (rename from type)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
      ALTER TABLE notifications RENAME COLUMN type TO notification_type;
    ELSE
      ALTER TABLE notifications ADD COLUMN notification_type text NOT NULL DEFAULT 'info';
    END IF;
  END IF;

  -- Add action_url column if not exists (rename from link)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'link') THEN
      ALTER TABLE notifications RENAME COLUMN link TO action_url;
    ELSE
      ALTER TABLE notifications ADD COLUMN action_url text;
    END IF;
  END IF;

  -- Add category column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'category') THEN
    ALTER TABLE notifications ADD COLUMN category text NOT NULL DEFAULT 'general';
  END IF;

  -- Add priority column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE notifications ADD COLUMN priority text NOT NULL DEFAULT 'medium';
  END IF;

  -- Add action_label column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_label') THEN
    ALTER TABLE notifications ADD COLUMN action_label text;
  END IF;

  -- Add related_entity_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'related_entity_type') THEN
    ALTER TABLE notifications ADD COLUMN related_entity_type text;
  END IF;

  -- Add related_entity_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'related_entity_id') THEN
    ALTER TABLE notifications ADD COLUMN related_entity_id uuid;
  END IF;

  -- Add metadata column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
    ALTER TABLE notifications ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;

  -- Add read_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at timestamptz;
  END IF;

  -- Add sent_via_email column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sent_via_email') THEN
    ALTER TABLE notifications ADD COLUMN sent_via_email boolean DEFAULT false;
  END IF;

  -- Add email_sent_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'email_sent_at') THEN
    ALTER TABLE notifications ADD COLUMN email_sent_at timestamptz;
  END IF;

  -- Add expires_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'expires_at') THEN
    ALTER TABLE notifications ADD COLUMN expires_at timestamptz;
  END IF;

  -- Add updated_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'updated_at') THEN
    ALTER TABLE notifications ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Drop existing check constraints if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_notification_type_check') THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_notification_type_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_category_check') THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_category_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check') THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_priority_check;
  END IF;
END $$;

-- Add check constraints
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check 
  CHECK (notification_type IN ('approval', 'alert', 'info', 'warning', 'error', 'reminder', 'success'));

ALTER TABLE notifications ADD CONSTRAINT notifications_category_check 
  CHECK (category IN ('budget', 'performance', 'ic', 'risk', 'collaboration', 'system', 'user', 'general'));

ALTER TABLE notifications ADD CONSTRAINT notifications_priority_check 
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Create notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  template_name text NOT NULL,
  notification_type text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  title_template text NOT NULL,
  message_template text NOT NULL,
  email_subject_template text,
  email_body_template text,
  action_label text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint for templates
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_unique_key 
  ON notification_templates(COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), template_key);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  in_app_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  email_frequency text DEFAULT 'instant' CHECK (email_frequency IN ('instant', 'daily_digest', 'weekly_digest', 'disabled')),
  approval_notifications boolean DEFAULT true,
  reminder_notifications boolean DEFAULT true,
  alert_notifications boolean DEFAULT true,
  info_notifications boolean DEFAULT true,
  budget_notifications boolean DEFAULT true,
  performance_notifications boolean DEFAULT true,
  ic_notifications boolean DEFAULT true,
  risk_notifications boolean DEFAULT true,
  collaboration_notifications boolean DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification read receipts table
CREATE TABLE IF NOT EXISTS notification_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  action_taken boolean DEFAULT false,
  action_taken_at timestamptz,
  UNIQUE(notification_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_org ON notifications(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type_category ON notifications(notification_type, category);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(related_entity_type, related_entity_id) WHERE related_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_org ON notification_templates(organization_id) WHERE organization_id IS NOT NULL;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_organization_id uuid,
  p_user_id uuid,
  p_title text,
  p_message text,
  p_notification_type text,
  p_category text,
  p_priority text DEFAULT 'medium',
  p_action_url text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_preferences record;
BEGIN
  SELECT * INTO v_preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  IF v_preferences IS NULL THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_preferences;
  END IF;
  
  IF NOT v_preferences.in_app_enabled THEN
    RETURN NULL;
  END IF;
  
  IF p_category = 'budget' AND NOT v_preferences.budget_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_category = 'performance' AND NOT v_preferences.performance_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_category = 'ic' AND NOT v_preferences.ic_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_category = 'risk' AND NOT v_preferences.risk_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_category = 'collaboration' AND NOT v_preferences.collaboration_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_notification_type = 'approval' AND NOT v_preferences.approval_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_notification_type = 'reminder' AND NOT v_preferences.reminder_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_notification_type IN ('alert', 'warning', 'error') AND NOT v_preferences.alert_notifications THEN
    RETURN NULL;
  END IF;
  
  IF p_notification_type = 'info' AND NOT v_preferences.info_notifications THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO notifications (
    organization_id,
    user_id,
    title,
    message,
    notification_type,
    category,
    priority,
    action_url,
    action_label,
    related_entity_type,
    related_entity_id,
    metadata,
    expires_at
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_title,
    p_message,
    p_notification_type,
    p_category,
    p_priority,
    p_action_url,
    p_action_label,
    p_related_entity_type,
    p_related_entity_id,
    p_metadata,
    p_expires_at
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(
  p_notification_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET 
    is_read = true,
    read_at = now(),
    updated_at = now()
  WHERE id = p_notification_id
    AND user_id = p_user_id
    AND is_read = false;
  
  INSERT INTO notification_read_receipts (notification_id, user_id)
  VALUES (p_notification_id, p_user_id)
  ON CONFLICT (notification_id, user_id) DO NOTHING;
  
  RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read(
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE notifications
    SET 
      is_read = true,
      read_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id
      AND is_read = false
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  RETURN v_count;
END;
$$;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM notifications
  WHERE user_id = p_user_id
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_count;
END;
$$;

-- Function to delete old notifications
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;
  
  RETURN v_count;
END;
$$;

-- Enable RLS on new tables
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification templates
CREATE POLICY "Users can view templates"
  ON notification_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = notification_templates.organization_id
    )
  );

CREATE POLICY "Admins can manage templates"
  ON notification_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('super_admin', 'admin')
          AND profiles.organization_id = notification_templates.organization_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('super_admin', 'admin')
          AND profiles.organization_id = notification_templates.organization_id
        )
    )
  );

-- RLS Policies for notification preferences
CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for read receipts
CREATE POLICY "Users can view own receipts"
  ON notification_read_receipts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert receipts"
  ON notification_read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION delete_old_notifications TO authenticated;

-- Insert default notification templates
INSERT INTO notification_templates (organization_id, template_key, template_name, notification_type, category, priority, title_template, message_template, action_label) VALUES
  (NULL, 'data_entry_submitted', 'Veri Girişi Onaya Gönderildi', 'approval', 'performance', 'medium', 'Yeni Veri Girişi Onay Bekliyor', 'Yeni bir veri girişi onayınızı bekliyor.', 'Görüntüle'),
  (NULL, 'data_entry_approved', 'Veri Girişi Onaylandı', 'success', 'performance', 'low', 'Veri Girişiniz Onaylandı', 'Veri girişiniz onaylandı.', 'Görüntüle'),
  (NULL, 'data_entry_rejected', 'Veri Girişi Reddedildi', 'warning', 'performance', 'medium', 'Veri Girişiniz Reddedildi', 'Veri girişiniz reddedildi.', 'Düzenle'),
  (NULL, 'risk_threshold_exceeded', 'Risk Eşiği Aşıldı', 'alert', 'risk', 'high', 'Risk İştahı Eşiği Aşıldı', 'Bir risk için belirlenen eşik değeri aşıldı.', 'Risk Detayı'),
  (NULL, 'finding_assigned', 'Yeni Bulgu Atandı', 'info', 'ic', 'medium', 'Size Yeni Bulgu Atandı', 'Size yeni bir bulgu atandı.', 'Görüntüle'),
  (NULL, 'deadline_approaching', 'Termin Yaklaşıyor', 'reminder', 'general', 'medium', 'Termin Yaklaşıyor', 'Bir termin yaklaşıyor.', 'Görüntüle'),
  (NULL, 'budget_threshold_exceeded', 'Bütçe Eşiği Aşıldı', 'alert', 'budget', 'high', 'Bütçe Uyarısı', 'Bütçe kullanım oranı yüksek seviyeye ulaştı.', 'Bütçe Detayı'),
  (NULL, 'collaboration_request', 'İş Birliği İsteği', 'info', 'collaboration', 'medium', 'Yeni İş Birliği Talebi', 'Yeni bir iş birliği talebi oluşturuldu.', 'Görüntüle'),
  (NULL, 'task_assigned', 'Görev Atandı', 'info', 'general', 'medium', 'Size Yeni Görev Atandı', 'Size yeni bir görev atandı.', 'Göreve Git'),
  (NULL, 'system_announcement', 'Sistem Duyurusu', 'info', 'system', 'low', 'Sistem Duyurusu', 'Yeni bir sistem duyurusu var.', 'Detaylar')
ON CONFLICT DO NOTHING;
