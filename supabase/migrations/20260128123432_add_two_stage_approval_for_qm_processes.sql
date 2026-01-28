/*
  # QM Süreçleri İçin İki Aşamalı Onay Sistemi

  1. Yeni Alanlar
    - `reviewed_by` (uuid) - Müdür incelemesi
    - `reviewed_at` (timestamptz) - Müdür inceleme tarihi
    - `final_approved_by` (uuid) - Admin final onay
    - `final_approved_at` (timestamptz) - Admin final onay tarihi

  2. Onay İş Akışı
    - DRAFT: Kullanıcı tarafından oluşturuldu
    - IN_REVIEW: Müdür incelemesinde
    - PENDING_APPROVAL: Admin onayı bekliyor
    - APPROVED: Onaylandı (final)
    - REJECTED: Reddedildi

  3. Fonksiyonlar
    - submit_qm_process_to_director: Müdür onayına gönder
    - director_approve_qm_process: Müdür onayla/reddet
    - admin_final_approve_qm_process: Admin final onayla/reddet

  4. Güvenlik
    - Self-approval engellendi
    - Birim bazlı erişim kontrolü
    - Rol bazlı yetkilendirme
*/

-- Add review and final approval fields
ALTER TABLE qm_processes
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qm_processes_reviewed_by ON qm_processes(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_qm_processes_final_approved_by ON qm_processes(final_approved_by);

-- Update status constraint to include IN_REVIEW
ALTER TABLE qm_processes DROP CONSTRAINT IF EXISTS qm_processes_status_check;
ALTER TABLE qm_processes ADD CONSTRAINT qm_processes_status_check 
  CHECK (status IN ('DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'));

-- Function: Submit QM process to director for review
CREATE OR REPLACE FUNCTION submit_qm_process_to_director(process_id UUID)
RETURNS JSON AS $$
DECLARE
  v_process RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get process details
  SELECT * INTO v_process FROM qm_processes WHERE id = process_id;

  -- Check if process exists
  IF v_process IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Süreç bulunamadı');
  END IF;

  -- Check if user is the creator
  IF v_process.created_by != v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Sadece oluşturduğunuz süreci gönderebilirsiniz');
  END IF;

  -- Check if process is in DRAFT or REJECTED status
  IF v_process.status NOT IN ('DRAFT', 'REJECTED') THEN
    RETURN json_build_object('success', false, 'message', 'Sadece taslak veya reddedilmiş süreçler gönderilebilir');
  END IF;

  -- Update process status to IN_REVIEW
  UPDATE qm_processes
  SET
    status = 'IN_REVIEW',
    submitted_at = NOW(),
    rejection_reason = NULL,
    updated_at = NOW()
  WHERE id = process_id;

  RETURN json_build_object('success', true, 'message', 'Süreç müdür onayına gönderildi');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Director approve/reject QM process
CREATE OR REPLACE FUNCTION director_approve_qm_process(
  process_id UUID,
  action TEXT, -- 'approve' or 'reject'
  rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_process RECORD;
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

  -- Get process details
  SELECT * INTO v_process FROM qm_processes WHERE id = process_id;

  -- Check if process exists
  IF v_process IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Süreç bulunamadı');
  END IF;

  -- Check if process is in the director's department
  IF v_process.owner_department_id != v_user_dept_id THEN
    RETURN json_build_object('success', false, 'message', 'Bu süreç sizin biriminize ait değil');
  END IF;

  -- Check if process is in IN_REVIEW status
  IF v_process.status != 'IN_REVIEW' THEN
    RETURN json_build_object('success', false, 'message', 'Süreç inceleme aşamasında değil');
  END IF;

  -- Check self-approval
  IF v_process.created_by = v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi oluşturduğunuz süreci onaylayamazsınız');
  END IF;

  -- Handle approval
  IF action = 'approve' THEN
    UPDATE qm_processes
    SET
      status = 'PENDING_APPROVAL',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = process_id;

    RETURN json_build_object('success', true, 'message', 'Süreç onaylandı ve admin onayına gönderildi');

  -- Handle rejection
  ELSIF action = 'reject' THEN
    IF rejection_reason_text IS NULL OR rejection_reason_text = '' THEN
      RETURN json_build_object('success', false, 'message', 'Red nedeni belirtilmelidir');
    END IF;

    UPDATE qm_processes
    SET
      status = 'REJECTED',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = process_id;

    RETURN json_build_object('success', true, 'message', 'Süreç reddedildi');

  ELSE
    RETURN json_build_object('success', false, 'message', 'Geçersiz işlem');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Admin final approve/reject QM process
CREATE OR REPLACE FUNCTION admin_final_approve_qm_process(
  process_id UUID,
  action TEXT, -- 'approve' or 'reject'
  rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_process RECORD;
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

  -- Get process details
  SELECT * INTO v_process FROM qm_processes WHERE id = process_id;

  -- Check if process exists
  IF v_process IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Süreç bulunamadı');
  END IF;

  -- Check if process is in PENDING_APPROVAL status
  IF v_process.status != 'PENDING_APPROVAL' THEN
    RETURN json_build_object('success', false, 'message', 'Süreç admin onayı beklemiyor');
  END IF;

  -- Check self-approval
  IF v_process.created_by = v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi oluşturduğunuz süreci onaylayamazsınız');
  END IF;

  -- Handle approval
  IF action = 'approve' THEN
    UPDATE qm_processes
    SET
      status = 'APPROVED',
      approved_by = v_user_id,
      approved_at = NOW(),
      final_approved_by = v_user_id,
      final_approved_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = process_id;

    RETURN json_build_object('success', true, 'message', 'Süreç onaylandı');

  -- Handle rejection
  ELSIF action = 'reject' THEN
    IF rejection_reason_text IS NULL OR rejection_reason_text = '' THEN
      RETURN json_build_object('success', false, 'message', 'Red nedeni belirtilmelidir');
    END IF;

    UPDATE qm_processes
    SET
      status = 'REJECTED',
      final_approved_by = v_user_id,
      final_approved_at = NOW(),
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = process_id;

    RETURN json_build_object('success', true, 'message', 'Süreç reddedildi');

  ELSE
    RETURN json_build_object('success', false, 'message', 'Geçersiz işlem');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_qm_process_to_director IS 'Kullanıcı QM sürecini müdür onayına gönderir';
COMMENT ON FUNCTION director_approve_qm_process IS 'Müdür QM sürecini inceler ve onaylar/reddeder';
COMMENT ON FUNCTION admin_final_approve_qm_process IS 'Admin QM süreci için final onay verir/reddeder';
