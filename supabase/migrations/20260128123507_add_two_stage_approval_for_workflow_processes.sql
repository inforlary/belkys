/*
  # İş Akışları İçin İki Aşamalı Onay Sistemi

  1. Yeni Alanlar
    - `final_approved_by` (uuid) - Admin final onay
    - `final_approved_at` (timestamptz) - Admin final onay tarihi
    - Mevcut reviewed_by ve reviewed_at alanları müdür incelemesi için kullanılacak

  2. Onay İş Akışı
    - draft: Kullanıcı tarafından oluşturuldu
    - in_review: Müdür incelemesinde
    - pending_approval: Admin onayı bekliyor
    - approved: Onaylandı (final)
    - rejected: Reddedildi

  3. Fonksiyonlar
    - submit_workflow_to_director: Müdür onayına gönder
    - director_approve_workflow: Müdür onayla/reddet
    - admin_final_approve_workflow: Admin final onayla/reddet

  4. Güvenlik
    - Self-approval engellendi
    - QM process üzerinden birim kontrolü
    - Rol bazlı yetkilendirme
*/

-- Add final approval fields
ALTER TABLE workflow_processes
  ADD COLUMN IF NOT EXISTS final_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_processes_final_approved_by ON workflow_processes(final_approved_by);

-- Update status constraint to include in_review
ALTER TABLE workflow_processes DROP CONSTRAINT IF EXISTS workflow_processes_status_check;
ALTER TABLE workflow_processes ADD CONSTRAINT workflow_processes_status_check 
  CHECK (status IN ('draft', 'DRAFT', 'in_review', 'IN_REVIEW', 'pending_approval', 'PENDING_APPROVAL', 'approved', 'APPROVED', 'rejected', 'REJECTED'));

-- Function: Submit workflow to director for review
CREATE OR REPLACE FUNCTION submit_workflow_to_director(workflow_id UUID)
RETURNS JSON AS $$
DECLARE
  v_workflow RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get workflow details
  SELECT * INTO v_workflow FROM workflow_processes WHERE id = workflow_id;

  -- Check if workflow exists
  IF v_workflow IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'İş akışı bulunamadı');
  END IF;

  -- Check if user is the creator
  IF v_workflow.created_by != v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Sadece oluşturduğunuz iş akışını gönderebilirsiniz');
  END IF;

  -- Check if workflow is in draft or rejected status
  IF v_workflow.status NOT IN ('draft', 'DRAFT', 'rejected', 'REJECTED') THEN
    RETURN json_build_object('success', false, 'message', 'Sadece taslak veya reddedilmiş iş akışları gönderilebilir');
  END IF;

  -- Update workflow status to in_review
  UPDATE workflow_processes
  SET
    status = 'in_review',
    rejection_reason = NULL,
    updated_at = NOW()
  WHERE id = workflow_id;

  RETURN json_build_object('success', true, 'message', 'İş akışı müdür onayına gönderildi');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Director approve/reject workflow
CREATE OR REPLACE FUNCTION director_approve_workflow(
  workflow_id UUID,
  action TEXT, -- 'approve' or 'reject'
  rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_workflow RECORD;
  v_qm_process RECORD;
  v_user_id UUID;
  v_user_role TEXT;
  v_user_dept_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get user details
  SELECT role, department_id INTO v_user_role, v_user_dept_id
  FROM profiles WHERE id = v_user_id;

  -- Check if user is director
  IF v_user_role NOT IN ('director', 'DIRECTOR') THEN
    RETURN json_build_object('success', false, 'message', 'Bu işlem için müdür yetkisi gereklidir');
  END IF;

  -- Get workflow details
  SELECT * INTO v_workflow FROM workflow_processes WHERE id = workflow_id;

  -- Check if workflow exists
  IF v_workflow IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'İş akışı bulunamadı');
  END IF;

  -- Get QM process to check department
  SELECT * INTO v_qm_process FROM qm_processes WHERE id = v_workflow.qm_process_id;

  -- Check if workflow's QM process is in the director's department
  IF v_qm_process.owner_department_id != v_user_dept_id THEN
    RETURN json_build_object('success', false, 'message', 'Bu iş akışı sizin biriminize ait değil');
  END IF;

  -- Check if workflow is in in_review status
  IF v_workflow.status NOT IN ('in_review', 'IN_REVIEW') THEN
    RETURN json_build_object('success', false, 'message', 'İş akışı inceleme aşamasında değil');
  END IF;

  -- Check self-approval
  IF v_workflow.created_by = v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi oluşturduğunuz iş akışını onaylayamazsınız');
  END IF;

  -- Handle approval
  IF action = 'approve' THEN
    UPDATE workflow_processes
    SET
      status = 'pending_approval',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = workflow_id;

    RETURN json_build_object('success', true, 'message', 'İş akışı onaylandı ve admin onayına gönderildi');

  -- Handle rejection
  ELSIF action = 'reject' THEN
    IF rejection_reason_text IS NULL OR rejection_reason_text = '' THEN
      RETURN json_build_object('success', false, 'message', 'Red nedeni belirtilmelidir');
    END IF;

    UPDATE workflow_processes
    SET
      status = 'rejected',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = workflow_id;

    RETURN json_build_object('success', true, 'message', 'İş akışı reddedildi');

  ELSE
    RETURN json_build_object('success', false, 'message', 'Geçersiz işlem');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Admin final approve/reject workflow
CREATE OR REPLACE FUNCTION admin_final_approve_workflow(
  workflow_id UUID,
  action TEXT, -- 'approve' or 'reject'
  rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_workflow RECORD;
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Get user role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;

  -- Check if user is admin
  IF v_user_role NOT IN ('admin', 'ADMIN') THEN
    RETURN json_build_object('success', false, 'message', 'Bu işlem için yönetici yetkisi gereklidir');
  END IF;

  -- Get workflow details
  SELECT * INTO v_workflow FROM workflow_processes WHERE id = workflow_id;

  -- Check if workflow exists
  IF v_workflow IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'İş akışı bulunamadı');
  END IF;

  -- Check if workflow is in pending_approval status
  IF v_workflow.status NOT IN ('pending_approval', 'PENDING_APPROVAL') THEN
    RETURN json_build_object('success', false, 'message', 'İş akışı admin onayı beklemiyor');
  END IF;

  -- Check self-approval
  IF v_workflow.created_by = v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi oluşturduğunuz iş akışını onaylayamazsınız');
  END IF;

  -- Handle approval
  IF action = 'approve' THEN
    UPDATE workflow_processes
    SET
      status = 'approved',
      approved_by = v_user_id,
      approved_at = NOW(),
      final_approved_by = v_user_id,
      final_approved_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = workflow_id;

    RETURN json_build_object('success', true, 'message', 'İş akışı onaylandı');

  -- Handle rejection
  ELSIF action = 'reject' THEN
    IF rejection_reason_text IS NULL OR rejection_reason_text = '' THEN
      RETURN json_build_object('success', false, 'message', 'Red nedeni belirtilmelidir');
    END IF;

    UPDATE workflow_processes
    SET
      status = 'rejected',
      final_approved_by = v_user_id,
      final_approved_at = NOW(),
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = workflow_id;

    RETURN json_build_object('success', true, 'message', 'İş akışı reddedildi');

  ELSE
    RETURN json_build_object('success', false, 'message', 'Geçersiz işlem');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_workflow_to_director IS 'Kullanıcı iş akışını müdür onayına gönderir';
COMMENT ON FUNCTION director_approve_workflow IS 'Müdür iş akışını inceler ve onaylar/reddeder';
COMMENT ON FUNCTION admin_final_approve_workflow IS 'Admin iş akışı için final onay verir/reddeder';
