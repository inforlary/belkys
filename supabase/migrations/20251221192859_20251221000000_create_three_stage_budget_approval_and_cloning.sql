/*
  # Üç Aşamalı Bütçe Onay Sistemi ve Yıllık Klonlama

  1. Onay Aşamaları (Bütçe ve Performans Modülü)
    - Müdür → Başkan Yardımcısı → Yönetici (3 aşama)
    - Status'lar:
      * draft - Taslak (müdür tarafından oluşturuldu)
      * submitted_to_vp - Başkan yardımcısına gönderildi
      * vp_approved - Başkan yardımcısı onayladı
      * submitted_to_admin - Yöneticiye gönderildi
      * admin_approved - Yönetici onayladı (final)
      * rejected - Reddedildi (her aşamada)

  2. Değişiklikler
    - `multi_year_budget_entries` tablosuna yeni status alanları
    - `activity_justifications` tablosuna fiscal_year alanı
    - `program_activity_indicator_mappings` tablosuna fiscal_year alanı
    - 3 aşamalı onay için metadata alanları

  3. Klonlama Fonksiyonu
    - `clone_budget_for_next_year()` fonksiyonu
    - Önceki yıl verilerini yeni yıl için kopyalar
    - Status'ları draft yapar
    - Referans tutarları kopyalar

  4. Güvenlik
    - Müdürler sadece draft ve rejected kayıtları düzenleyebilir
    - Başkan yardımcıları submitted_to_vp kayıtları onaylayabilir
    - Yöneticiler vp_approved kayıtları onaylayabilir
*/

-- Remove old constraint first
ALTER TABLE activity_justifications DROP CONSTRAINT IF EXISTS activity_justifications_status_check;

-- Update existing status values to match new schema
UPDATE activity_justifications SET status = 'admin_approved' WHERE status = 'completed';
UPDATE activity_justifications SET status = 'admin_approved' WHERE status = 'approved';
UPDATE activity_justifications SET status = 'draft' WHERE status NOT IN ('draft', 'rejected', 'admin_approved');

-- Add fiscal_year to activity_justifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_justifications'
    AND column_name = 'fiscal_year'
  ) THEN
    ALTER TABLE activity_justifications
    ADD COLUMN fiscal_year integer NOT NULL DEFAULT 2025;

    CREATE INDEX IF NOT EXISTS idx_activity_justifications_fiscal_year
    ON activity_justifications(fiscal_year);
  END IF;
END $$;

-- Add fiscal_year to program_activity_indicator_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_activity_indicator_mappings'
    AND column_name = 'fiscal_year'
  ) THEN
    ALTER TABLE program_activity_indicator_mappings
    ADD COLUMN fiscal_year integer NOT NULL DEFAULT 2025;

    CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_fiscal_year
    ON program_activity_indicator_mappings(fiscal_year);

    -- Update unique constraint to include fiscal_year
    ALTER TABLE program_activity_indicator_mappings
    DROP CONSTRAINT IF EXISTS program_activity_indicator_mappings_organization_id_activity;

    -- Add new unique constraint with fiscal_year
    ALTER TABLE program_activity_indicator_mappings
    ADD CONSTRAINT unique_mapping_per_year
    UNIQUE NULLS NOT DISTINCT (organization_id, activity_id, indicator_id, fiscal_year);
  END IF;
END $$;

-- Update multi_year_budget_entries status constraint to include new statuses
ALTER TABLE multi_year_budget_entries
DROP CONSTRAINT IF EXISTS multi_year_budget_entries_status_check;

ALTER TABLE multi_year_budget_entries
ADD CONSTRAINT multi_year_budget_entries_status_check
CHECK (status IN ('draft', 'submitted_to_vp', 'vp_approved', 'submitted_to_admin', 'admin_approved', 'rejected', 'approved', 'submitted'));

-- Add three-stage approval metadata to multi_year_budget_entries
DO $$
BEGIN
  -- VP approval fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_year_budget_entries'
    AND column_name = 'vp_submitted_at'
  ) THEN
    ALTER TABLE multi_year_budget_entries
    ADD COLUMN vp_submitted_at timestamptz,
    ADD COLUMN vp_submitted_by uuid REFERENCES profiles(id),
    ADD COLUMN vp_reviewed_at timestamptz,
    ADD COLUMN vp_reviewed_by uuid REFERENCES profiles(id),
    ADD COLUMN vp_rejection_reason text;

    CREATE INDEX IF NOT EXISTS idx_budget_entries_vp_reviewed_by
    ON multi_year_budget_entries(vp_reviewed_by);
  END IF;

  -- Admin approval fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_year_budget_entries'
    AND column_name = 'admin_submitted_at'
  ) THEN
    ALTER TABLE multi_year_budget_entries
    ADD COLUMN admin_submitted_at timestamptz,
    ADD COLUMN admin_submitted_by uuid REFERENCES profiles(id),
    ADD COLUMN admin_reviewed_at timestamptz,
    ADD COLUMN admin_reviewed_by uuid REFERENCES profiles(id),
    ADD COLUMN admin_rejection_reason text;

    CREATE INDEX IF NOT EXISTS idx_budget_entries_admin_reviewed_by
    ON multi_year_budget_entries(admin_reviewed_by);
  END IF;
END $$;

-- Add three-stage approval metadata to activity_justifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_justifications'
    AND column_name = 'vp_submitted_at'
  ) THEN
    -- Add VP approval fields
    ALTER TABLE activity_justifications
    ADD COLUMN vp_submitted_at timestamptz,
    ADD COLUMN vp_submitted_by uuid REFERENCES profiles(id),
    ADD COLUMN vp_reviewed_at timestamptz,
    ADD COLUMN vp_reviewed_by uuid REFERENCES profiles(id),
    ADD COLUMN vp_rejection_reason text;

    -- Add admin approval fields
    ALTER TABLE activity_justifications
    ADD COLUMN admin_submitted_at timestamptz,
    ADD COLUMN admin_submitted_by uuid REFERENCES profiles(id),
    ADD COLUMN admin_reviewed_at timestamptz,
    ADD COLUMN admin_reviewed_by uuid REFERENCES profiles(id),
    ADD COLUMN admin_rejection_reason text;

    CREATE INDEX IF NOT EXISTS idx_activity_justifications_vp_reviewed_by
    ON activity_justifications(vp_reviewed_by);

    CREATE INDEX IF NOT EXISTS idx_activity_justifications_admin_reviewed_by
    ON activity_justifications(admin_reviewed_by);
  END IF;
END $$;

-- Now add the new constraint
ALTER TABLE activity_justifications
ADD CONSTRAINT activity_justifications_status_check
CHECK (status IN ('draft', 'submitted_to_vp', 'vp_approved', 'submitted_to_admin', 'admin_approved', 'rejected'));

-- Function to clone budget data for next fiscal year
CREATE OR REPLACE FUNCTION clone_budget_for_next_year(
  p_organization_id uuid,
  p_source_year integer,
  p_target_year integer
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_mappings_count integer := 0;
  v_budget_entries_count integer := 0;
  v_justifications_count integer := 0;
BEGIN
  -- Clone program_activity_indicator_mappings
  WITH cloned_mappings AS (
    INSERT INTO program_activity_indicator_mappings (
      organization_id,
      department_id,
      program_id,
      sub_program_id,
      activity_id,
      indicator_id,
      goal_id,
      fiscal_year,
      notes,
      description_status,
      created_by,
      updated_by
    )
    SELECT
      organization_id,
      department_id,
      program_id,
      sub_program_id,
      activity_id,
      indicator_id,
      goal_id,
      p_target_year,
      notes,
      'draft', -- Reset to draft
      created_by,
      updated_by
    FROM program_activity_indicator_mappings
    WHERE organization_id = p_organization_id
      AND fiscal_year = p_source_year
    ON CONFLICT (organization_id, activity_id, indicator_id, fiscal_year)
    DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_mappings_count FROM cloned_mappings;

  -- Clone activity_justifications
  WITH cloned_justifications AS (
    INSERT INTO activity_justifications (
      organization_id,
      department_id,
      program_id,
      sub_program_id,
      activity_id,
      legal_basis,
      justification,
      cost_elements,
      budget_needs,
      fiscal_year,
      status,
      created_by
    )
    SELECT
      organization_id,
      department_id,
      program_id,
      sub_program_id,
      activity_id,
      legal_basis,
      justification,
      cost_elements,
      budget_needs,
      p_target_year,
      'draft', -- Reset to draft
      created_by
    FROM activity_justifications
    WHERE organization_id = p_organization_id
      AND fiscal_year = p_source_year
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_justifications_count FROM cloned_justifications;

  -- Clone multi_year_budget_entries
  WITH cloned_entries AS (
    INSERT INTO multi_year_budget_entries (
      organization_id,
      mapping_id,
      economic_code_id,
      financing_type_id,
      fiscal_year,
      period_type,
      period_number,
      budget_type,
      amount,
      notes,
      status,
      created_by,
      updated_by
    )
    SELECT
      organization_id,
      mapping_id,
      economic_code_id,
      financing_type_id,
      p_target_year,
      period_type,
      period_number,
      budget_type,
      0, -- Reset amount to 0 for new year
      'Cloned from ' || p_source_year || ': ' || COALESCE(notes, ''),
      'draft', -- Reset to draft
      created_by,
      updated_by
    FROM multi_year_budget_entries
    WHERE organization_id = p_organization_id
      AND fiscal_year = p_source_year
      AND status IN ('admin_approved', 'approved') -- Only clone approved entries
    ON CONFLICT (mapping_id, economic_code_id, financing_type_id, fiscal_year, period_type, period_number)
    DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_budget_entries_count FROM cloned_entries;

  -- Ensure year settings exist
  INSERT INTO budget_year_settings (organization_id, year, year_type, is_active)
  VALUES (p_organization_id, p_target_year, 'budget', true)
  ON CONFLICT (organization_id, year) DO NOTHING;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'source_year', p_source_year,
    'target_year', p_target_year,
    'cloned_mappings', v_mappings_count,
    'cloned_justifications', v_justifications_count,
    'cloned_budget_entries', v_budget_entries_count
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on clone function
GRANT EXECUTE ON FUNCTION clone_budget_for_next_year TO authenticated;

-- Update RLS policies for multi_year_budget_entries to support 3-stage approval
DROP POLICY IF EXISTS "Users can update their budget entries" ON multi_year_budget_entries;

-- Managers (directors) can update draft and rejected entries
CREATE POLICY "Managers can update draft and rejected entries"
  ON multi_year_budget_entries FOR UPDATE
  TO authenticated
  USING (
    status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = multi_year_budget_entries.organization_id
      AND role = 'manager'
    )
  );

-- Vice Presidents can review submitted entries
CREATE POLICY "Vice Presidents can review submitted entries"
  ON multi_year_budget_entries FOR UPDATE
  TO authenticated
  USING (
    status IN ('submitted_to_vp', 'vp_approved')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = multi_year_budget_entries.organization_id
      AND role = 'vice_president'
    )
  );

-- Admins can review VP approved entries
CREATE POLICY "Admins can review vp approved entries"
  ON multi_year_budget_entries FOR UPDATE
  TO authenticated
  USING (
    status IN ('submitted_to_admin', 'vp_approved', 'admin_approved')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = multi_year_budget_entries.organization_id
      AND role = 'admin'
    )
  );

-- Update RLS policies for activity_justifications to support 3-stage approval
DROP POLICY IF EXISTS "Users can update own department justifications" ON activity_justifications;
DROP POLICY IF EXISTS "Managers can update justifications" ON activity_justifications;

-- Managers can update draft and rejected justifications
CREATE POLICY "Managers can update draft and rejected justifications"
  ON activity_justifications FOR UPDATE
  TO authenticated
  USING (
    status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = activity_justifications.organization_id
      AND department_id = activity_justifications.department_id
      AND role = 'manager'
    )
  );

-- Vice Presidents can review submitted justifications
CREATE POLICY "Vice Presidents can review submitted justifications"
  ON activity_justifications FOR UPDATE
  TO authenticated
  USING (
    status IN ('submitted_to_vp', 'vp_approved')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = activity_justifications.organization_id
      AND role = 'vice_president'
    )
  );

-- Admins can review VP approved justifications
CREATE POLICY "Admins can review vp approved justifications"
  ON activity_justifications FOR UPDATE
  TO authenticated
  USING (
    status IN ('submitted_to_admin', 'vp_approved', 'admin_approved')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = activity_justifications.organization_id
      AND role = 'admin'
    )
  );

-- Users can still update draft justifications in their department
CREATE POLICY "Users can update draft justifications in own department"
  ON activity_justifications FOR UPDATE
  TO authenticated
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = activity_justifications.organization_id
      AND department_id = activity_justifications.department_id
      AND role = 'user'
    )
  );