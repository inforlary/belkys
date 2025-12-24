/*
  # Enhanced Messages System
  
  1. New Tables
    - `message_threads` - Thread/conversation management
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `subject` (text)
      - `participants` (uuid[]) - Array of user IDs
      - `last_message_at` (timestamptz)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      
    - `message_attachments` - File attachments
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key)
      - `file_name` (text)
      - `file_size` (bigint)
      - `file_type` (text)
      - `storage_path` (text)
      - `uploaded_by` (uuid)
      - `created_at` (timestamptz)
      
    - `message_reactions` - Emoji reactions
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `reaction` (text)
      - `created_at` (timestamptz)
      
    - `message_read_receipts` - Read tracking
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `read_at` (timestamptz)
      
    - `message_drafts` - Draft messages
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `thread_id` (uuid, foreign key)
      - `recipient_id` (uuid)
      - `subject` (text)
      - `message` (text)
      - `draft_data` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Changes to existing messages table
    - Add thread_id column
    - Add is_draft column
    - Add is_archived column
    - Add is_starred column
    - Add is_deleted column
    - Add metadata column (jsonb)
    
  3. Security
    - Enable RLS on all tables
    - Users can only see their own messages/threads
    - Participants can access thread messages
*/

-- Create message_threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  participants uuid[] NOT NULL DEFAULT '{}',
  last_message_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create message_attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, reaction)
);

-- Create message_read_receipts table
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Create message_drafts table
CREATE TABLE IF NOT EXISTS message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  thread_id uuid REFERENCES message_threads(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  subject text,
  message text,
  draft_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN thread_id uuid REFERENCES message_threads(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_draft boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_starred'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_starred boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE messages ADD COLUMN metadata jsonb;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_threads
CREATE POLICY "Users can view threads they participate in"
  ON message_threads FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create threads"
  ON message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    auth.uid() = ANY(participants)
  );

CREATE POLICY "Thread creators can update threads"
  ON message_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for message_attachments
CREATE POLICY "Users can view attachments in their messages"
  ON message_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_attachments.message_id
      AND (messages.sender_id = auth.uid() OR messages.recipient_id = auth.uid())
    )
  );

CREATE POLICY "Users can upload attachments to their messages"
  ON message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_attachments.message_id
      AND messages.sender_id = auth.uid()
    )
  );

-- RLS Policies for message_reactions
CREATE POLICY "Users can view reactions on their messages"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
      AND (messages.sender_id = auth.uid() OR messages.recipient_id = auth.uid())
    )
  );

CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for message_read_receipts
CREATE POLICY "Users can view read receipts of their sent messages"
  ON message_read_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_read_receipts.message_id
      AND messages.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON message_read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_read_receipts.message_id
      AND messages.recipient_id = auth.uid()
    )
  );

-- RLS Policies for message_drafts
CREATE POLICY "Users can manage their own drafts"
  ON message_drafts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_threads_participants ON message_threads USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_message_threads_org ON message_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user ON message_read_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_message_drafts_user ON message_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_archived ON messages(is_archived) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages(is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(is_deleted) WHERE is_deleted = false;

-- Function to update thread last_message_at
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE message_threads
    SET last_message_at = NEW.created_at
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updating thread timestamp
DROP TRIGGER IF EXISTS update_thread_timestamp ON messages;
CREATE TRIGGER update_thread_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_last_message();

-- Function to create read receipt
CREATE OR REPLACE FUNCTION mark_message_as_read(message_uuid uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO message_read_receipts (message_id, user_id)
  VALUES (message_uuid, auth.uid())
  ON CONFLICT (message_id, user_id) DO NOTHING;
  
  UPDATE messages
  SET read_at = now()
  WHERE id = message_uuid
  AND recipient_id = auth.uid()
  AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count()
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM messages
    WHERE recipient_id = auth.uid()
    AND read_at IS NULL
    AND is_deleted = false
    AND is_archived = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive/unarchive message
CREATE OR REPLACE FUNCTION toggle_message_archive(message_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET is_archived = NOT is_archived
  WHERE id = message_uuid
  AND (sender_id = auth.uid() OR recipient_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to star/unstar message
CREATE OR REPLACE FUNCTION toggle_message_star(message_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET is_starred = NOT is_starred
  WHERE id = message_uuid
  AND (sender_id = auth.uid() OR recipient_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to soft delete message
CREATE OR REPLACE FUNCTION soft_delete_message(message_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET is_deleted = true
  WHERE id = message_uuid
  AND (sender_id = auth.uid() OR recipient_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update draft timestamp
CREATE OR REPLACE FUNCTION update_draft_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_draft_updated_at ON message_drafts;
CREATE TRIGGER set_draft_updated_at
  BEFORE UPDATE ON message_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_draft_timestamp();