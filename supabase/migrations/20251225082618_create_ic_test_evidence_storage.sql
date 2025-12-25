/*
  # Create Storage Bucket for Internal Control Test Evidence Files

  1. New Storage Bucket
    - `ic-test-evidence` - Stores evidence files for internal control tests
  
  2. Storage Policies
    - Authenticated users can upload evidence files to their organization's folder
    - Users can view evidence files from their organization
    - Users can delete their own uploaded evidence files
    - Admins can delete any evidence files from their organization
  
  3. Security
    - Files are organized by organization_id
    - RLS policies ensure users can only access files from their organization
*/

-- Create the storage bucket for IC test evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ic-test-evidence',
  'ic-test-evidence',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files to their organization folder
CREATE POLICY "Users can upload evidence files to their org folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ic-test-evidence' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy: Allow users to view evidence files from their organization
CREATE POLICY "Users can view evidence files from their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ic-test-evidence' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy: Allow users to delete their own uploaded evidence files
CREATE POLICY "Users can delete their own evidence files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ic-test-evidence' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  ) AND
  owner = auth.uid()
);

-- Policy: Allow admins to delete any evidence files from their organization
CREATE POLICY "Admins can delete org evidence files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ic-test-evidence' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);