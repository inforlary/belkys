/*
  # Bütçe Tablolarını Dönemlere Bağlama

  ## Genel Bakış
  Mevcut bütçe tablolarına budget_period_id referansı eklenerek,
  her veri kaydının hangi bütçe dönemine ait olduğu net olarak belirlenir.

  ## 1. Güncellenecek Tablolar
    - `multi_year_budget_entries` - Çok yıllı bütçe girişleri
    - `activity_justifications` - Faaliyet gerekçeleri
    - `program_activity_indicator_mappings` - Program-faaliyet-gösterge eşleştirmeleri
    - `budget_performance_forms` - Bütçe performans formları

  ## 2. Değişiklikler
    - Her tabloya `budget_period_id` kolonu eklenir (nullable, sonra doldurulacak)
    - `fiscal_year` ile birlikte çalışır (backward compatibility)
    - Foreign key constraint ile budget_periods tablosuna bağlanır
    - Index'ler eklenir

  ## 3. Veri Bütünlüğü
    - Mevcut veriler korunur (nullable alan)
    - Sonraki migration'da veriler dönemlere atanacak
    - Yeni kayıtlar için budget_period_id zorunlu hale gelecek
*/

-- Add budget_period_id to multi_year_budget_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_year_budget_entries'
    AND column_name = 'budget_period_id'
  ) THEN
    -- Add column as nullable first
    ALTER TABLE multi_year_budget_entries
    ADD COLUMN budget_period_id uuid REFERENCES budget_periods(id) ON DELETE SET NULL;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_multi_year_entries_period
    ON multi_year_budget_entries(budget_period_id);
    
    -- Add comment
    COMMENT ON COLUMN multi_year_budget_entries.budget_period_id IS 
    'Bu bütçe girişinin ait olduğu bütçe dönemi. Örnek: 2025te hazırlanan 2026 bütçesi için period kaydı.';
  END IF;
END $$;

-- Add budget_period_id to activity_justifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_justifications'
    AND column_name = 'budget_period_id'
  ) THEN
    ALTER TABLE activity_justifications
    ADD COLUMN budget_period_id uuid REFERENCES budget_periods(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_activity_justifications_period
    ON activity_justifications(budget_period_id);
    
    COMMENT ON COLUMN activity_justifications.budget_period_id IS 
    'Bu gerekçenin ait olduğu bütçe dönemi';
  END IF;
END $$;

-- Add budget_period_id to program_activity_indicator_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_activity_indicator_mappings'
    AND column_name = 'budget_period_id'
  ) THEN
    ALTER TABLE program_activity_indicator_mappings
    ADD COLUMN budget_period_id uuid REFERENCES budget_periods(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_period
    ON program_activity_indicator_mappings(budget_period_id);
    
    COMMENT ON COLUMN program_activity_indicator_mappings.budget_period_id IS 
    'Bu eşleştirmenin ait olduğu bütçe dönemi';
  END IF;
END $$;

-- Add budget_period_id to budget_performance_forms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_performance_forms'
    AND column_name = 'budget_period_id'
  ) THEN
    ALTER TABLE budget_performance_forms
    ADD COLUMN budget_period_id uuid REFERENCES budget_periods(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_period
    ON budget_performance_forms(budget_period_id);
    
    COMMENT ON COLUMN budget_performance_forms.budget_period_id IS 
    'Bu performans formunun ait olduğu bütçe dönemi';
  END IF;
END $$;

-- Add budget_period_id to expense_budget_entries (eski sistem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'expense_budget_entries'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_budget_entries'
    AND column_name = 'budget_period_id'
  ) THEN
    ALTER TABLE expense_budget_entries
    ADD COLUMN budget_period_id uuid REFERENCES budget_periods(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_expense_entries_period
    ON expense_budget_entries(budget_period_id);
  END IF;
END $$;

-- Add budget_period_id to revenue_budget_entries (eski sistem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'revenue_budget_entries'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_budget_entries'
    AND column_name = 'budget_period_id'
  ) THEN
    ALTER TABLE revenue_budget_entries
    ADD COLUMN budget_period_id uuid REFERENCES budget_periods(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_revenue_entries_period
    ON revenue_budget_entries(budget_period_id);
  END IF;
END $$;

-- Helper function: Get period by fiscal year (Backward compatibility)
CREATE OR REPLACE FUNCTION get_period_by_fiscal_year(
  p_organization_id uuid,
  p_fiscal_year integer
)
RETURNS uuid AS $$
DECLARE
  v_period_id uuid;
BEGIN
  SELECT id INTO v_period_id
  FROM budget_periods
  WHERE organization_id = p_organization_id
  AND budget_year = p_fiscal_year
  LIMIT 1;
  
  RETURN v_period_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get fiscal year from period
CREATE OR REPLACE FUNCTION get_fiscal_year_from_period(p_period_id uuid)
RETURNS integer AS $$
DECLARE
  v_fiscal_year integer;
BEGIN
  SELECT budget_year INTO v_fiscal_year
  FROM budget_periods
  WHERE id = p_period_id;
  
  RETURN v_fiscal_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-set budget_period_id from fiscal_year (for new records)
CREATE OR REPLACE FUNCTION auto_set_budget_period_from_fiscal_year()
RETURNS TRIGGER AS $$
BEGIN
  -- If period_id is null but fiscal_year is provided, try to find period
  IF NEW.budget_period_id IS NULL AND NEW.fiscal_year IS NOT NULL THEN
    NEW.budget_period_id := get_period_by_fiscal_year(
      NEW.organization_id,
      NEW.fiscal_year
    );
  END IF;
  
  -- If period_id is provided but fiscal_year is null, get it from period
  IF NEW.budget_period_id IS NOT NULL AND NEW.fiscal_year IS NULL THEN
    NEW.fiscal_year := get_fiscal_year_from_period(NEW.budget_period_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to multi_year_budget_entries
DROP TRIGGER IF EXISTS trg_auto_set_period_multi_year ON multi_year_budget_entries;
CREATE TRIGGER trg_auto_set_period_multi_year
  BEFORE INSERT OR UPDATE ON multi_year_budget_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_budget_period_from_fiscal_year();

-- Apply trigger to activity_justifications
DROP TRIGGER IF EXISTS trg_auto_set_period_justifications ON activity_justifications;
CREATE TRIGGER trg_auto_set_period_justifications
  BEFORE INSERT OR UPDATE ON activity_justifications
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_budget_period_from_fiscal_year();

-- Apply trigger to program_activity_indicator_mappings
DROP TRIGGER IF EXISTS trg_auto_set_period_mappings ON program_activity_indicator_mappings;
CREATE TRIGGER trg_auto_set_period_mappings
  BEFORE INSERT OR UPDATE ON program_activity_indicator_mappings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_budget_period_from_fiscal_year();

-- Apply trigger to budget_performance_forms
DROP TRIGGER IF EXISTS trg_auto_set_period_performance ON budget_performance_forms;
CREATE TRIGGER trg_auto_set_period_performance
  BEFORE INSERT OR UPDATE ON budget_performance_forms
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_budget_period_from_fiscal_year();

-- Update clone function to include period_id
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
  v_source_period_id uuid;
  v_target_period_id uuid;
BEGIN
  -- Get period IDs
  v_source_period_id := get_period_by_fiscal_year(p_organization_id, p_source_year);
  v_target_period_id := get_period_by_fiscal_year(p_organization_id, p_target_year);
  
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
      budget_period_id,
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
      v_target_period_id,
      notes,
      'draft',
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
      budget_period_id,
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
      v_target_period_id,
      'draft',
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
      budget_period_id,
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
      v_target_period_id,
      period_type,
      period_number,
      budget_type,
      0,
      'Cloned from ' || p_source_year || ': ' || COALESCE(notes, ''),
      'draft',
      created_by,
      updated_by
    FROM multi_year_budget_entries
    WHERE organization_id = p_organization_id
      AND fiscal_year = p_source_year
      AND status IN ('admin_approved', 'approved')
    ON CONFLICT (mapping_id, economic_code_id, financing_type_id, fiscal_year, period_type, period_number)
    DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_budget_entries_count FROM cloned_entries;

  -- Ensure year settings exist
  INSERT INTO budget_year_settings (organization_id, year, year_type, is_active)
  VALUES (p_organization_id, p_target_year, 'budget', true)
  ON CONFLICT (organization_id, year) DO NOTHING;

  -- Update clone info in target period
  IF v_target_period_id IS NOT NULL THEN
    UPDATE budget_periods
    SET 
      cloned_from_period_id = v_source_period_id,
      cloned_at = now()
    WHERE id = v_target_period_id;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'source_year', p_source_year,
    'target_year', p_target_year,
    'source_period_id', v_source_period_id,
    'target_period_id', v_target_period_id,
    'cloned_mappings', v_mappings_count,
    'cloned_justifications', v_justifications_count,
    'cloned_budget_entries', v_budget_entries_count
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_period_by_fiscal_year TO authenticated;
GRANT EXECUTE ON FUNCTION get_fiscal_year_from_period TO authenticated;
