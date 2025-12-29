/*
  # Fix Message Attachments Insert Policy
  
  1. Changes
    - Drop the restrictive insert policy that only allows message senders
    - Create new policy that allows users to upload attachments to any message where they are sender OR recipient
    - This fixes the issue where users couldn't attach files when replying to messages
  
  2. Security
    - Users can only upload attachments to messages they are involved in (as sender or recipient)
    - Maintains security while allowing reply attachments
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can upload attachments to their messages" ON message_attachments;

-- Create a new policy that allows both senders and recipients to attach files
CREATE POLICY "Users can upload attachments to their messages"
ON message_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_attachments.message_id
      AND (messages.sender_id = auth.uid() OR messages.recipient_id = auth.uid())
  )
);