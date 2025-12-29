/*
  # İlk Defa Bütçe Dönemi Başlatma Düzeltmesi

  Bu migration, yeni oluşturulan organizasyonlar için ilk bütçe dönemi başlatma 
  işlemini düzeltir. Artık önceki dönem yoksa hata vermek yerine, otomatik olarak
  ilk dönemi oluşturur.

  ## Değişiklikler
  
  1. `start_next_year_budget_preparation` fonksiyonunu günceller
     - Eğer hiç dönem yoksa, dinamik olarak cari yıl + 1 için dönem oluşturur
     - Önceki dönem varsa normal klonlama işlemini yapar
     - İlk dönem için klonlama yapmaz (çünkü klonlanacak veri yok)
  
  2. Güvenlik
     - Mevcut SECURITY DEFINER korunur
     - Sadece authenticated kullanıcılar erişebilir
*/

-- Drop and recreate the function with fix
CREATE OR REPLACE FUNCTION start_next_year_budget_preparation(
  p_organization_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_current_period record;
  v_new_period_id uuid;
  v_clone_result jsonb;
  v_current_year int;
  v_new_budget_year int;
  v_new_preparation_year int;
  v_is_first_period boolean := false;
BEGIN
  -- Get most recent active or executing period
  SELECT * INTO v_current_period
  FROM budget_periods
  WHERE organization_id = p_organization_id
  AND period_status IN ('active', 'executing')
  ORDER BY budget_year DESC
  LIMIT 1;
  
  IF v_current_period IS NULL THEN
    -- If no active period, get the latest
    SELECT * INTO v_current_period
    FROM budget_periods
    WHERE organization_id = p_organization_id
    ORDER BY budget_year DESC
    LIMIT 1;
  END IF;
  
  -- If no period exists, this is the first period for this organization
  IF v_current_period IS NULL THEN
    v_is_first_period := true;
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    v_new_budget_year := v_current_year + 1;
    v_new_preparation_year := v_current_year;
    
    -- Create first period
    v_new_period_id := create_budget_period(
      p_organization_id,
      v_new_preparation_year,  -- This year is preparation year
      v_new_budget_year,        -- Next year is budget year
      true                      -- Auto-start
    );
    
    -- No cloning for first period (no previous data to clone)
    v_clone_result := jsonb_build_object(
      'cloned_mappings', 0,
      'cloned_justifications', 0,
      'cloned_budget_entries', 0,
      'message', 'İlk dönem oluşturuldu. Klonlanacak önceki veri bulunmuyor.'
    );
  ELSE
    -- Normal flow: create next year based on existing period
    v_new_budget_year := v_current_period.budget_year + 1;
    v_new_preparation_year := v_current_period.budget_year;
    
    -- Create next period
    v_new_period_id := create_budget_period(
      p_organization_id,
      v_new_preparation_year,       -- Current budget year becomes preparation year
      v_new_budget_year,             -- Next year
      true                           -- Auto-start
    );
    
    -- Clone data from previous year
    v_clone_result := clone_budget_for_next_year(
      p_organization_id,
      v_current_period.budget_year,
      v_new_budget_year
    );
  END IF;
  
  -- Mark new period as current
  UPDATE budget_periods
  SET is_current = false
  WHERE organization_id = p_organization_id
  AND id != v_new_period_id;
  
  UPDATE budget_periods
  SET is_current = true
  WHERE id = v_new_period_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'new_period_id', v_new_period_id,
    'previous_budget_year', COALESCE(v_current_period.budget_year, v_new_preparation_year),
    'new_budget_year', v_new_budget_year,
    'is_first_period', v_is_first_period,
    'clone_result', v_clone_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION start_next_year_budget_preparation TO authenticated;