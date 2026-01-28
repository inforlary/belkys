/*
  # İş Akışları Onay Sistemi Düzeltmeleri

  1. Değişiklikler
    - workflow_processes'te department bilgisi qm_process üzerinden alınacak
    - Müdür oluşturursa direkt PENDING_APPROVAL (admin onayı)
    - User oluşturursa IN_REVIEW (müdür onayı) → PENDING_APPROVAL (admin onayı)

  2. Fonksiyon Güncellemeleri
    - submit_workflow_to_director: Müdür ise direkt PENDING_APPROVAL'a gönder
    - director_approve_workflow: QM process üzerinden department kontrolü
    - admin_final_approve_workflow: Güncelleme yok

  3. Güvenlik
    - Müdür kendi oluşturduğunu direkt admin onayına gönderebilir
    - Self-approval admin seviyesinde engellendi
*/

-- Drop existing function and recreate with department logic
DROP FUNCTION IF EXISTS submit_workflow_to_director(UUID);

CREATE OR REPLACE FUNCTION submit_workflow_to_director(workflow_id UUID)
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

  -- Get QM process to check department
  SELECT * INTO v_qm_process FROM qm_processes WHERE id = v_workflow.qm_process_id;

  -- If user is director in the same department, skip director review
  IF v_user_role IN ('director', 'DIRECTOR') AND v_qm_process.owner_department_id = v_user_dept_id THEN
    UPDATE workflow_processes
    SET
      status = 'pending_approval',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = workflow_id;

    RETURN json_build_object('success', true, 'message', 'İş akışı admin onayına gönderildi');
  ELSE
    -- Normal user: send to director review
    UPDATE workflow_processes
    SET
      status = 'in_review',
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = workflow_id;

    RETURN json_build_object('success', true, 'message', 'İş akışı müdür onayına gönderildi');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update director_approve_workflow to use QM process department
DROP FUNCTION IF EXISTS director_approve_workflow(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION director_approve_workflow(
  workflow_id UUID,
  action TEXT,
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

  IF v_qm_process IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'İlişkili QM süreci bulunamadı');
  END IF;

  -- Check if workflow's QM process is in the director's department
  IF v_qm_process.owner_department_id != v_user_dept_id THEN
    RETURN json_build_object('success', false, 'message', 'Bu iş akışı sizin biriminize ait değil');
  END IF;

  -- Check if workflow is in in_review status
  IF v_workflow.status NOT IN ('in_review', 'IN_REVIEW') THEN
    RETURN json_build_object('success', false, 'message', 'İş akışı inceleme aşamasında değil');
  END IF;

  -- Check self-approval (director shouldn't approve workflow they created)
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

COMMENT ON FUNCTION submit_workflow_to_director IS 'Kullanıcı iş akışını gönderir. Müdür ise direkt admin onayına, user ise müdür onayına gider';
COMMENT ON FUNCTION director_approve_workflow IS 'Müdür iş akışını inceler ve onaylar/reddeder (QM process üzerinden department kontrolü)';
