/*
  # Create messaging system

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `sender_id` (uuid, foreign key to profiles) - User sending message
      - `recipient_id` (uuid, foreign key to profiles) - Admin receiving message (nullable for broadcast)
      - `subject` (text) - Message subject
      - `message` (text) - Message content
      - `priority` (text) - 'low', 'normal', 'high', 'urgent'
      - `status` (text) - 'unread', 'read', 'replied', 'archived'
      - `reply_to_id` (uuid, self-reference) - For reply chains
      - `is_admin_message` (boolean) - True if sent by admin
      - `read_at` (timestamptz) - When message was read
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on messages table
    - Users can create messages to admins
    - Users can view their own sent/received messages
    - Admins can view all messages in their organization
    - Admins can reply to messages

  3. Important Notes
    - Users can only send messages to admins
    - Admins see all incoming messages
    - Reply threads are tracked via reply_to_id
*/

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  is_admin_message boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_organization ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sent messages
CREATE POLICY "Users can view own sent messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

-- Policy: Admins can view all messages in their organization
CREATE POLICY "Admins can view all messages in org"
  ON messages FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Users can create messages
CREATE POLICY "Users can create messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Users can only send to admins
      (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin'
      AND recipient_id IN (
        SELECT id FROM profiles 
        WHERE role = 'admin' 
        AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      )
      OR
      -- Admins can send to anyone
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- Policy: Recipients can update message status (mark as read)
CREATE POLICY "Recipients can update message status"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Policy: Admins can delete messages in their organization
CREATE POLICY "Admins can delete messages"
  ON messages FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_messages_updated_at ON messages;
CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();
