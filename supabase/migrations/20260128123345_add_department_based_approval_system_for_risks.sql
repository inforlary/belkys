/*
  # Risk Yönetimi İçin Birim Bazlı İki Aşamalı Onay Sistemi

  1. RLS Politika Güncellemeleri
    - Kullanıcılar sadece kendi birimlerindeki riskleri görebilir
    - Kullanıcılar kendi birimlerinde risk oluşturabilir
    - Müdürler kendi birimlerindeki riskleri inceleyip onaylayabilir
    - Adminler tüm birimlerdeki riskleri görebilir ve final onaylayabilir
    - Director rolü artık müdür yetkisine sahip

  2. Onay Alanları
    - `reviewed_by` (uuid) - İncelemede olan müdür
    - `reviewed_at` (timestamptz) - Müdür inceleme tarihi
    - `final_approved_by` (uuid) - Final onaylayan admin
    - `final_approved_at` (timestamptz) - Final onay tarihi

  3. Onay İş Akışı
    - DRAFT: Kullanıcı tarafından oluşturuldu
    - IN_REVIEW: Müdür incelemesinde
    - PENDING_APPROVAL: Admin onayı bekliyor
    - APPROVED: Onaylandı (final)
    - REJECTED: Reddedildi
    - CLOSED: Kapatıldı

  4. Güvenlik
    - Self-approval engellendi
    - Birim bazlı erişim kontrolü
    - Rol bazlı yetkilendirme
*/

-- Add review and final approval fields to risks
ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_risks_reviewed_by ON risks(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_risks_final_approved_by ON risks(final_approved_by);

-- Drop existing RLS policies for risks
DROP POLICY IF EXISTS "Super admins have full access to risks" ON risks;
DROP POLICY IF EXISTS "Users can view their organization risks" ON risks;
DROP POLICY IF EXISTS "Admins and directors can manage risks" ON risks;

-- Create new department-based RLS policies
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "Super admins full access to risks"
  ON risks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Admins can view all risks in their organization
CREATE POLICY "Admins can view all organization risks"
  ON risks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ADMIN')
    )
  );

-- Directors can view risks in their departments
CREATE POLICY "Directors can view their department risks"
  ON risks FOR SELECT
  TO authenticated
  USING (
    owner_department_id IN (
      SELECT department_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('director', 'DIRECTOR')
    )
  );

-- Users can view risks in their departments
CREATE POLICY "Users can view their department risks"
  ON risks FOR SELECT
  TO authenticated
  USING (
    owner_department_id IN (
      SELECT department_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Users can create risks in their departments
CREATE POLICY "Users can create risks in their department"
  ON risks FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_department_id IN (
      SELECT department_id FROM profiles
      WHERE id = auth.uid()
    )
    AND approval_status = 'DRAFT'
  );

-- Users can update their own draft risks
CREATE POLICY "Users can update their draft risks"
  ON risks FOR UPDATE
  TO authenticated
  USING (
    identified_by_id = auth.uid()
    AND approval_status IN ('DRAFT', 'REJECTED')
  );

-- Directors can update risks in their departments (for review)
CREATE POLICY "Directors can update department risks for review"
  ON risks FOR UPDATE
  TO authenticated
  USING (
    owner_department_id IN (
      SELECT department_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('director', 'DIRECTOR')
    )
  );

-- Admins can update all risks in organization (for final approval)
CREATE POLICY "Admins can update all organization risks"
  ON risks FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ADMIN')
    )
  );

-- Admins can delete risks
CREATE POLICY "Admins can delete risks"
  ON risks FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ADMIN')
    )
  );

-- Function: Submit risk for director review
CREATE OR REPLACE FUNCTION submit_risk_for_director_review(risk_id UUID)
RETURNS JSON AS $$
DECLARE
  v_risk RECORD;
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Get user role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;

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

  -- Update risk status to IN_REVIEW
  UPDATE risks
  SET
    approval_status = 'IN_REVIEW',
    updated_at = NOW()
  WHERE id = risk_id;

  RETURN json_build_object('success', true, 'message', 'Risk müdür onayına gönderildi');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Director review risk (approve or reject)
CREATE OR REPLACE FUNCTION director_review_risk(
  risk_id UUID,
  action TEXT, -- 'approve' or 'reject'
  rejection_reason_text TEXT DEFAULT NULL
)
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

  -- Check if user is director
  IF v_user_role NOT IN ('director', 'DIRECTOR') THEN
    RETURN json_build_object('success', false, 'message', 'Bu işlem için müdür yetkisi gereklidir');
  END IF;

  -- Get risk details
  SELECT * INTO v_risk FROM risks WHERE id = risk_id;

  -- Check if risk exists
  IF v_risk IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Risk bulunamadı');
  END IF;

  -- Check if risk is in the director's department
  IF v_risk.owner_department_id != v_user_dept_id THEN
    RETURN json_build_object('success', false, 'message', 'Bu risk sizin biriminize ait değil');
  END IF;

  -- Check if risk is in IN_REVIEW status
  IF v_risk.approval_status != 'IN_REVIEW' THEN
    RETURN json_build_object('success', false, 'message', 'Risk inceleme aşamasında değil');
  END IF;

  -- Check self-approval
  IF v_risk.identified_by_id = v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi oluşturduğunuz riski onaylayamazsınız');
  END IF;

  -- Handle approval
  IF action = 'approve' THEN
    UPDATE risks
    SET
      approval_status = 'PENDING_APPROVAL',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = risk_id;

    RETURN json_build_object('success', true, 'message', 'Risk onaylandı ve admin onayına gönderildi');

  -- Handle rejection
  ELSIF action = 'reject' THEN
    IF rejection_reason_text IS NULL OR rejection_reason_text = '' THEN
      RETURN json_build_object('success', false, 'message', 'Red nedeni belirtilmelidir');
    END IF;

    UPDATE risks
    SET
      approval_status = 'REJECTED',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = risk_id;

    RETURN json_build_object('success', true, 'message', 'Risk reddedildi');

  ELSE
    RETURN json_build_object('success', false, 'message', 'Geçersiz işlem');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Admin final approval
CREATE OR REPLACE FUNCTION admin_final_approve_risk(
  risk_id UUID,
  action TEXT, -- 'approve' or 'reject'
  rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_risk RECORD;
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

  -- Get risk details
  SELECT * INTO v_risk FROM risks WHERE id = risk_id;

  -- Check if risk exists
  IF v_risk IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Risk bulunamadı');
  END IF;

  -- Check if risk is in PENDING_APPROVAL status
  IF v_risk.approval_status != 'PENDING_APPROVAL' THEN
    RETURN json_build_object('success', false, 'message', 'Risk admin onayı beklemiyor');
  END IF;

  -- Check self-approval (admin shouldn't approve their own risk)
  IF v_risk.identified_by_id = v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi oluşturduğunuz riski onaylayamazsınız');
  END IF;

  -- Handle approval
  IF action = 'approve' THEN
    UPDATE risks
    SET
      approval_status = 'APPROVED',
      approved_by = v_user_id,
      approved_at = NOW(),
      final_approved_by = v_user_id,
      final_approved_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = risk_id;

    RETURN json_build_object('success', true, 'message', 'Risk onaylandı');

  -- Handle rejection
  ELSIF action = 'reject' THEN
    IF rejection_reason_text IS NULL OR rejection_reason_text = '' THEN
      RETURN json_build_object('success', false, 'message', 'Red nedeni belirtilmelidir');
    END IF;

    UPDATE risks
    SET
      approval_status = 'REJECTED',
      final_approved_by = v_user_id,
      final_approved_at = NOW(),
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = risk_id;

    RETURN json_build_object('success', true, 'message', 'Risk reddedildi');

  ELSE
    RETURN json_build_object('success', false, 'message', 'Geçersiz işlem');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_risk_for_director_review IS 'Kullanıcı riski müdür onayına gönderir';
COMMENT ON FUNCTION director_review_risk IS 'Müdür riski inceler ve onaylar/reddeder';
COMMENT ON FUNCTION admin_final_approve_risk IS 'Admin final onay verir/reddeder';
