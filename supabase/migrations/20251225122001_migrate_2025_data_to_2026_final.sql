/*
  # Mevcut 2025 Verilerini 2026 Bütçe Dönemine Taşıma (Final)

  ## Genel Bakış
  Sistemdeki mevcut fiscal_year=2025 verilerinin aslında 2026 bütçesi olduğu
  tespit edilmiştir. Bu migration:
  1. Her organizasyon için 2026 bütçe dönemi oluşturur (hazırlık: 2025)
  2. Tüm fiscal_year=2025 verilerini fiscal_year=2026 olarak günceller
  3. Bu verileri oluşturulan 2026 dönemine bağlar

  ## Etkilenen Tablolar
    - multi_year_budget_entries
    - activity_justifications
    - program_activity_indicator_mappings
    - budget_performance_forms (sadece period_id)

  ## Önemli Not
  Bu migration veri güvenliği için şöyle çalışır:
  - fiscal_year=2025 → 2026
  - fiscal_year=2024 → Değişmez (gerçek 2024 verileri)
  - fiscal_year=2026+ → Değişmez (ileri tarihli tahminler)
*/

-- Step 1: Create 2026 budget periods for all organizations with data
DO $$
DECLARE
  v_org record;
  v_period_id uuid;
  v_existing_period_id uuid;
BEGIN
  -- For each organization that has fiscal_year=2025 data
  FOR v_org IN (
    SELECT DISTINCT organization_id
    FROM (
      SELECT organization_id FROM multi_year_budget_entries WHERE fiscal_year = 2025
      UNION
      SELECT organization_id FROM activity_justifications WHERE fiscal_year = 2025
      UNION
      SELECT organization_id FROM program_activity_indicator_mappings WHERE fiscal_year = 2025
    ) orgs
  ) LOOP
    -- Check if period already exists
    SELECT id INTO v_existing_period_id
    FROM budget_periods
    WHERE organization_id = v_org.organization_id
    AND budget_year = 2026
    LIMIT 1;
    
    -- Create period if doesn't exist
    IF v_existing_period_id IS NULL THEN
      BEGIN
        v_period_id := create_budget_period(
          v_org.organization_id,
          2025, -- preparation_year
          2026, -- budget_year
          false -- don't auto-start
        );
        
        -- Set this period as current and in preparation state
        UPDATE budget_periods
        SET 
          is_current = true,
          period_status = 'preparation'
        WHERE id = v_period_id;
        
        -- Unmark other periods as current
        UPDATE budget_periods
        SET is_current = false
        WHERE organization_id = v_org.organization_id
        AND id != v_period_id;
        
        RAISE NOTICE 'Created 2026 budget period for organization %', v_org.organization_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create period for organization %: %', v_org.organization_id, SQLERRM;
      END;
    ELSE
      -- Update existing period to preparation
      UPDATE budget_periods
      SET 
        is_current = true,
        period_status = 'preparation'
      WHERE id = v_existing_period_id;
      
      -- Unmark other periods as current
      UPDATE budget_periods
      SET is_current = false
      WHERE organization_id = v_org.organization_id
      AND id != v_existing_period_id;
      
      v_period_id := v_existing_period_id;
      RAISE NOTICE 'Using existing 2026 period for organization %', v_org.organization_id;
    END IF;
  END LOOP;
END $$;

-- Step 2: Update fiscal_year from 2025 to 2026 in tables that have fiscal_year

-- Update multi_year_budget_entries
UPDATE multi_year_budget_entries
SET 
  fiscal_year = 2026,
  budget_period_id = (
    SELECT id FROM budget_periods
    WHERE organization_id = multi_year_budget_entries.organization_id
    AND budget_year = 2026
    LIMIT 1
  ),
  notes = CASE
    WHEN notes IS NOT NULL AND notes NOT LIKE '[Migrated:%' THEN 
      '[Migrated: 2025→2026] ' || notes
    WHEN notes IS NULL THEN
      '[Migrated: 2025→2026]'
    ELSE
      notes
  END,
  updated_at = now()
WHERE fiscal_year = 2025;

-- Update activity_justifications
UPDATE activity_justifications
SET 
  fiscal_year = 2026,
  budget_period_id = (
    SELECT id FROM budget_periods
    WHERE organization_id = activity_justifications.organization_id
    AND budget_year = 2026
    LIMIT 1
  ),
  updated_at = now()
WHERE fiscal_year = 2025;

-- Update program_activity_indicator_mappings
UPDATE program_activity_indicator_mappings
SET 
  fiscal_year = 2026,
  budget_period_id = (
    SELECT id FROM budget_periods
    WHERE organization_id = program_activity_indicator_mappings.organization_id
    AND budget_year = 2026
    LIMIT 1
  ),
  updated_at = now()
WHERE fiscal_year = 2025;

-- Update budget_performance_forms (only budget_period_id, no fiscal_year)
UPDATE budget_performance_forms
SET 
  budget_period_id = (
    SELECT id FROM budget_periods bp
    WHERE bp.organization_id = budget_performance_forms.organization_id
    AND bp.budget_year = 2026
    LIMIT 1
  ),
  updated_at = now()
WHERE budget_period_id IS NULL
AND organization_id IN (
  SELECT organization_id FROM budget_periods WHERE budget_year = 2026
);

-- Step 3: Create historical 2024 periods and link data
DO $$
DECLARE
  v_org record;
  v_period_id uuid;
  v_existing_period_id uuid;
BEGIN
  FOR v_org IN (
    SELECT DISTINCT organization_id
    FROM (
      SELECT organization_id FROM multi_year_budget_entries WHERE fiscal_year = 2024
      UNION
      SELECT organization_id FROM activity_justifications WHERE fiscal_year = 2024
      UNION
      SELECT organization_id FROM program_activity_indicator_mappings WHERE fiscal_year = 2024
    ) orgs
  ) LOOP
    SELECT id INTO v_existing_period_id
    FROM budget_periods
    WHERE organization_id = v_org.organization_id
    AND budget_year = 2024
    LIMIT 1;
    
    IF v_existing_period_id IS NULL THEN
      BEGIN
        v_period_id := create_budget_period(
          v_org.organization_id,
          2023, -- preparation_year
          2024, -- budget_year
          false
        );
        
        -- Set as closed (historical data)
        UPDATE budget_periods
        SET period_status = 'closed'
        WHERE id = v_period_id;
        
        RAISE NOTICE 'Created historical 2024 period for organization %', v_org.organization_id;
      EXCEPTION WHEN OTHERS THEN
        v_period_id := NULL;
        RAISE NOTICE 'Could not create 2024 period for organization %: %', v_org.organization_id, SQLERRM;
      END;
    ELSE
      v_period_id := v_existing_period_id;
    END IF;
    
    -- Link 2024 data to this period
    IF v_period_id IS NOT NULL THEN
      UPDATE multi_year_budget_entries
      SET budget_period_id = v_period_id
      WHERE organization_id = v_org.organization_id
      AND fiscal_year = 2024
      AND budget_period_id IS NULL;
      
      UPDATE activity_justifications
      SET budget_period_id = v_period_id
      WHERE organization_id = v_org.organization_id
      AND fiscal_year = 2024
      AND budget_period_id IS NULL;
      
      UPDATE program_activity_indicator_mappings
      SET budget_period_id = v_period_id
      WHERE organization_id = v_org.organization_id
      AND fiscal_year = 2024
      AND budget_period_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- Step 4: Send notifications about the migration
INSERT INTO budget_period_notifications (
  period_id,
  notification_type,
  title,
  message,
  sent_to_roles
)
SELECT
  bp.id,
  'status_changed',
  '2026 Mali Yılı Bütçe Dönemi Aktif',
  '2026 mali yılı bütçe hazırlık dönemi aktifleştirilmiştir. Mevcut verileriniz 2026 bütçesi olarak kaydedilmiştir. ' ||
  'Lütfen bütçe verilerinizi gözden geçirerek onaya sununuz. ' ||
  'Hazırlık dönemi: 1 Ekim 2025 - 30 Kasım 2025, Onay süreci: 1-31 Aralık 2025',
  ARRAY['admin', 'vice_president', 'manager']
FROM budget_periods bp
WHERE bp.budget_year = 2026
AND bp.is_current = true
AND NOT EXISTS (
  SELECT 1 FROM budget_period_notifications bpn
  WHERE bpn.period_id = bp.id
  AND bpn.notification_type = 'status_changed'
  AND bpn.title = '2026 Mali Yılı Bütçe Dönemi Aktif'
);

-- Summary report
DO $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'migration_date', now(),
    'periods_created_2026', (SELECT COUNT(*) FROM budget_periods WHERE budget_year = 2026),
    'periods_created_2024', (SELECT COUNT(*) FROM budget_periods WHERE budget_year = 2024),
    'multi_year_entries_migrated', (SELECT COUNT(*) FROM multi_year_budget_entries WHERE fiscal_year = 2026),
    'justifications_migrated', (SELECT COUNT(*) FROM activity_justifications WHERE fiscal_year = 2026),
    'mappings_migrated', (SELECT COUNT(*) FROM program_activity_indicator_mappings WHERE fiscal_year = 2026),
    'performance_forms_linked', (SELECT COUNT(*) FROM budget_performance_forms WHERE budget_period_id IS NOT NULL)
  ) INTO v_stats;
  
  RAISE NOTICE 'Migration Summary: %', v_stats;
END $$;
