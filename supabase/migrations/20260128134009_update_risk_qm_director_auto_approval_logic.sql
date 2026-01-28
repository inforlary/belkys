/*
  # Risk ve QM Süreçleri için Müdür Otomatik Onay Mantığı

  1. Değişiklikler
    - Müdür oluşturursa direkt PENDING_APPROVAL (admin onayı)
    - User oluşturursa IN_REVIEW (müdür onayı) → PENDING_APPROVAL (admin onayı)

  2. Fonksiyon Güncellemeleri
    - submit_risk_for_director_review: Müdür ise direkt PENDING_APPROVAL'a gönder
    - submit_qm_process_to_director: Müdür ise direkt PENDING_APPROVAL'a gönder

  3. Güvenlik
    - Müdür kendi oluşturduğunu direkt admin onayına gönderebilir
    - Self-approval admin seviyesinde engellendi
*/

-- Update submit_risk_for_director_review
DROP FUNCTION IF EXISTS submit_risk_for_director_review(UUID);

CREATE OR REPLACE FUNCTION submit_risk_for_director_review(risk_id UUID)
RETURNS JSON AS $$
DECLARE
  v_risk RECORD;
  v_user_id UUID;
  v_user_role TEXT;
  v_user_dept_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get user details
  SELECT role, department_id INTO v_user_role, v_user_dept_id
  FROM profiles WHERE id = v_user_id;

  -- Get risk details
  SELECT * INTO v_risk FROM risks WHERE id = risk_id;

  -- Check if risk exists
  IF v_risk IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Risk bulunamadı');
  END IF;

  -- Check if user is the creator
  IF v_risk.identified_by_id != v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Sadece oluşturduğunuz riski gönderebilirsiniz');
  END IF;

  -- Check if risk is in DRAFT or REJECTED status
  IF v_risk.approval_status NOT IN ('DRAFT', 'REJECTED') THEN
    RETURN json_build_object('success', false, 'message', 'Sadece taslak veya reddedilmiş riskler gönderilebilir');
  END IF;

  -- If user is director in the same department, skip director review
  IF v_user_role IN ('director', 'DIRECTOR') AND v_risk.owner_department_id = v_user_dept_id THEN
    UPDATE risks
    SET
      approval_status = 'PENDING_APPROVAL',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = risk_id;

    RETURN json_build_object('success', true, 'message', 'Risk admin onayına gönderildi');
  ELSE
    -- Normal user: send to director review
    UPDATE risks
    SET
      approval_status = 'IN_REVIEW',
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = risk_id;

    RETURN json_build_object('success', true, 'message', 'Risk müdür onayına gönderildi');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update submit_qm_process_to_director
DROP FUNCTION IF EXISTS submit_qm_process_to_director(UUID);

CREATE OR REPLACE FUNCTION submit_qm_process_to_director(process_id UUID)
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

  -- If user is director in the same department, skip director review
  IF v_user_role IN ('director', 'DIRECTOR') AND v_process.owner_department_id = v_user_dept_id THEN
    UPDATE qm_processes
    SET
      status = 'PENDING_APPROVAL',
      submitted_at = NOW(),
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = process_id;

    RETURN json_build_object('success', true, 'message', 'Süreç admin onayına gönderildi');
  ELSE
    -- Normal user: send to director review
    UPDATE qm_processes
    SET
      status = 'IN_REVIEW',
      submitted_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = process_id;

    RETURN json_build_object('success', true, 'message', 'Süreç müdür onayına gönderildi');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_risk_for_director_review IS 'Kullanıcı riski gönderir. Müdür ise direkt admin onayına, user ise müdür onayına gider';
COMMENT ON FUNCTION submit_qm_process_to_director IS 'Kullanıcı QM sürecini gönderir. Müdür ise direkt admin onayına, user ise müdür onayına gider';
