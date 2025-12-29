/*
  # Fix message attachments RLS policies for super admin access

  1. Changes
    - Add super_admin policy to INSERT attachments on any message
    - Add super_admin policy to DELETE any attachment
    - Fix existing policies to ensure they work correctly

  2. Security
    - Super admins can manage all attachments
    - Regular users can only manage attachments for their messages
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can insert message attachments" ON message_attachments;
DROP POLICY IF EXISTS "Super admins can delete message attachments" ON message_attachments;

-- Super admins can insert message attachments on any message
CREATE POLICY "Super admins can insert message attachments"
  ON message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Super admins can delete any message attachment
CREATE POLICY "Super admins can delete message attachments"
  ON message_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );
