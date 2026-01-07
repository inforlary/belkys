/*
  # Create IC Action Documents Storage Bucket

  1. Storage
    - Create storage bucket for action documents
    - Set up RLS policies for access control

  2. Security
    - Add storage policies for authenticated users
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('ic-action-documents', 'ic-action-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view action documents in storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ic-action-documents' AND
    EXISTS (
      SELECT 1 FROM ic_action_documents
      JOIN ic_actions a ON ic_action_documents.action_id = a.id
      JOIN ic_action_plans p ON a.action_plan_id = p.id
      WHERE ic_action_documents.file_url = storage.objects.name
      AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can upload action documents to storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ic-action-documents' AND
    (SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL
  );

CREATE POLICY "Users can delete their action documents from storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ic-action-documents' AND
    EXISTS (
      SELECT 1 FROM ic_action_documents
      WHERE ic_action_documents.file_url = storage.objects.name
      AND ic_action_documents.uploaded_by_id = auth.uid()
    )
  );