/*
  # İş Akışı Onay Sistemi Ekleme
  
  1. Değişiklikler
    - `workflow_processes` tablosuna onay alanları eklendi
      - `approved_by` (uuid) - Onaylayan kullanıcı
      - `approved_at` (timestamptz) - Onay tarihi
      - `rejection_reason` (text) - Red nedeni
      - `reviewed_by` (uuid) - İnceleyenler (admin/director)
      - `reviewed_at` (timestamptz) - İnceleme tarihi
  
  2. Onay İş Akışı
    - draft: Taslak, henüz onaya gönderilmemiş
    - pending_approval: Onay bekliyor
    - approved: Onaylandı
    
  3. Yetkiler
    - Tüm kullanıcılar taslak oluşturabilir
    - Admin ve Director onaylayabilir
    - Sadece Admin ve Director silebilir
*/

-- Add approval fields to workflow_processes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_processes' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE workflow_processes 
      ADD COLUMN approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN approved_at timestamptz,
      ADD COLUMN rejection_reason text,
      ADD COLUMN reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_processes_approved_by ON workflow_processes(approved_by);
CREATE INDEX IF NOT EXISTS idx_workflow_processes_reviewed_by ON workflow_processes(reviewed_by);

-- Update delete policy to include director role
DROP POLICY IF EXISTS "Admins can delete workflows" ON workflow_processes;

CREATE POLICY "Admins and directors can delete workflows"
  ON workflow_processes FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND (role IN ('admin', 'ADMIN', 'director', 'DIRECTOR') OR is_super_admin = true)
    )
  );
