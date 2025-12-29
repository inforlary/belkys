/*
  # Create Message Attachments Storage Bucket
  
  1. Storage Setup
    - Create `message-attachments` bucket for storing message attachment files
    - Set file size limit to 10MB
    - Allow common file types (documents, images, etc.)
    
  2. Security
    - Add RLS policies for authenticated users to upload attachments
    - Allow users to view attachments from messages they sent or received
    - Allow users to delete their own uploaded attachments
*/

-- Create the storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload attachments
CREATE POLICY "Users can upload message attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
);

-- Allow users to view attachments from their messages
CREATE POLICY "Users can view their message attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM message_attachments ma
    INNER JOIN messages m ON ma.message_id = m.id
    WHERE ma.storage_path = name
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  )
);

-- Allow users to delete their own uploaded attachments
CREATE POLICY "Users can delete their message attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM message_attachments ma
    WHERE ma.storage_path = name
      AND ma.uploaded_by = auth.uid()
  )
);

-- Allow super admins to view all message attachments
CREATE POLICY "Super admins can view all message attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
);

-- Allow super admins to delete any message attachment
CREATE POLICY "Super admins can delete any message attachment"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
);