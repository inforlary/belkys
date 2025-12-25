/*
  # Dönem Bazlı Erişim Kontrolleri

  ## Genel Bakış
  Bütçe dönemi durumuna göre veri düzenleme ve oluşturma kısıtlamaları.
  Örneğin kapalı dönemlerde veri düzenlenemez, sadece görüntülenir.

  ## 1. Erişim Kuralları

  ### draft (Taslak)
    - Sadece görüntüleme
    - Hiç veri girişi yapılamaz

  ### preparation (Hazırlık)
    - Veri girişi: ✅ Allowed
    - Düzenleme: ✅ Allowed (draft/rejected kayıtlar)
    - Onaylama: ❌ Not allowed
    - Silme: ✅ Allowed (kendi kayıtları)

  ### approval (Onay)
    - Veri girişi: ❌ Not allowed
    - Düzenleme: ⚠️  Sınırlı (sadece onaylayanlar status değiştirebilir)
    - Onaylama: ✅ Allowed
    - Silme: ❌ Not allowed

  ### approved/active/executing (Onaylandı/Aktif/Yürütülüyor)
    - Veri girişi: ❌ Not allowed
    - Düzenleme: ❌ Not allowed (sadece admin düzeltme yapabilir)
    - Onaylama: ❌ Not allowed
    - Silme: ❌ Not allowed

  ### closed (Kapalı)
    - Tüm işlemler: ❌ Sadece görüntüleme

  ## 2. Fonksiyonlar
    - can_edit_budget_entry() - Bütçe girişi düzenlenebilir mi?
    - can_create_budget_entry() - Yeni bütçe girişi oluşturulabilir mi?
    - can_delete_budget_entry() - Bütçe girişi silinebilir mi?
    - is_period_editable() - Dönem düzenlenebilir durumda mı?
*/

-- Function: Check if period is in editable state
CREATE OR REPLACE FUNCTION is_period_editable(p_period_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status text;
BEGIN
  IF p_period_id IS NULL THEN
    RETURN true; -- Backward compatibility: no period = editable
  END IF;
  
  SELECT period_status INTO v_status
  FROM budget_periods
  WHERE id = p_period_id;
  
  -- Editable states: preparation, approval (with restrictions)
  RETURN v_status IN ('draft', 'preparation', 'approval');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can create budget entry in period
CREATE OR REPLACE FUNCTION can_create_budget_entry(
  p_period_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean AS $$
DECLARE
  v_status text;
  v_user_role text;
BEGIN
  IF p_period_id IS NULL THEN
    RETURN true; -- Backward compatibility
  END IF;
  
  -- Get period status
  SELECT period_status INTO v_status
  FROM budget_periods
  WHERE id = p_period_id;
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;
  
  -- Super admin can always create (for corrections)
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_super_admin = true) THEN
    RETURN true;
  END IF;
  
  -- Rules by period status
  CASE v_status
    WHEN 'draft' THEN
      RETURN false; -- Period not started yet
    WHEN 'preparation' THEN
      RETURN v_user_role IN ('admin', 'vice_president', 'manager', 'user');
    WHEN 'approval' THEN
      RETURN false; -- No new entries during approval
    WHEN 'approved', 'active', 'executing' THEN
      RETURN v_user_role = 'admin'; -- Only admin can make corrections
    WHEN 'closed' THEN
      RETURN false; -- Period closed, no changes
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can edit budget entry
CREATE OR REPLACE FUNCTION can_edit_budget_entry(
  p_period_id uuid,
  p_entry_status text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean AS $$
DECLARE
  v_period_status text;
  v_user_role text;
BEGIN
  IF p_period_id IS NULL THEN
    RETURN true; -- Backward compatibility
  END IF;
  
  -- Get period status
  SELECT period_status INTO v_period_status
  FROM budget_periods
  WHERE id = p_period_id;
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;
  
  -- Super admin can always edit
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_super_admin = true) THEN
    RETURN true;
  END IF;
  
  -- Rules by period status
  CASE v_period_status
    WHEN 'draft' THEN
      RETURN false;
    WHEN 'preparation' THEN
      -- Can edit draft and rejected entries
      RETURN p_entry_status IN ('draft', 'rejected');
    WHEN 'approval' THEN
      -- Only status changes allowed (for approvers)
      IF v_user_role = 'vice_president' AND p_entry_status = 'submitted_to_vp' THEN
        RETURN true;
      ELSIF v_user_role = 'admin' AND p_entry_status IN ('vp_approved', 'submitted_to_admin') THEN
        RETURN true;
      ELSE
        RETURN false;
      END IF;
    WHEN 'approved', 'active', 'executing' THEN
      -- Only admin can make corrections
      RETURN v_user_role = 'admin';
    WHEN 'closed' THEN
      RETURN false;
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can delete budget entry
CREATE OR REPLACE FUNCTION can_delete_budget_entry(
  p_period_id uuid,
  p_entry_status text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean AS $$
DECLARE
  v_period_status text;
  v_user_role text;
BEGIN
  IF p_period_id IS NULL THEN
    RETURN true; -- Backward compatibility
  END IF;
  
  -- Get period status
  SELECT period_status INTO v_period_status
  FROM budget_periods
  WHERE id = p_period_id;
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;
  
  -- Super admin can always delete
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_super_admin = true) THEN
    RETURN true;
  END IF;
  
  -- Only allow deletion in preparation phase for draft entries
  IF v_period_status = 'preparation' AND p_entry_status = 'draft' THEN
    RETURN v_user_role IN ('admin', 'manager');
  END IF;
  
  -- Admin can delete in any non-closed period
  IF v_user_role = 'admin' AND v_period_status != 'closed' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get period editing constraints for UI
CREATE OR REPLACE FUNCTION get_period_constraints(p_period_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_period record;
  v_constraints jsonb;
BEGIN
  IF p_period_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_create', true,
      'can_edit', true,
      'can_delete', true,
      'can_approve', true,
      'message', 'No period restrictions (backward compatibility)'
    );
  END IF;
  
  SELECT * INTO v_period
  FROM budget_periods
  WHERE id = p_period_id;
  
  IF v_period IS NULL THEN
    RETURN jsonb_build_object('error', 'Period not found');
  END IF;
  
  -- Build constraints based on period status
  v_constraints := CASE v_period.period_status
    WHEN 'draft' THEN
      jsonb_build_object(
        'can_create', false,
        'can_edit', false,
        'can_delete', false,
        'can_approve', false,
        'message', 'Dönem henüz başlatılmadı',
        'hint', 'Lütfen dönemi başlatmak için "Hazırlığa Başla" butonuna tıklayın'
      )
    WHEN 'preparation' THEN
      jsonb_build_object(
        'can_create', true,
        'can_edit', true,
        'can_delete', true,
        'can_approve', false,
        'message', 'Bütçe hazırlık dönemi - Veri girişi yapılabilir',
        'hint', 'Taslak ve reddedilen kayıtları düzenleyebilirsiniz'
      )
    WHEN 'approval' THEN
      jsonb_build_object(
        'can_create', false,
        'can_edit', true, -- Limited to approvers
        'can_delete', false,
        'can_approve', true,
        'message', 'Onay süreci devam ediyor',
        'hint', 'Sadece onaylama işlemleri yapılabilir'
      )
    WHEN 'approved' THEN
      jsonb_build_object(
        'can_create', false,
        'can_edit', false,
        'can_delete', false,
        'can_approve', false,
        'message', 'Bütçe onaylandı',
        'hint', 'TBMM onayı bekleniyor veya alındı'
      )
    WHEN 'active' THEN
      jsonb_build_object(
        'can_create', false,
        'can_edit', false,
        'can_delete', false,
        'can_approve', false,
        'message', 'Bütçe yürürlüğe girdi',
        'hint', 'Mali yıl başladı, gerçekleşme verileri takip edilebilir'
      )
    WHEN 'executing' THEN
      jsonb_build_object(
        'can_create', false,
        'can_edit', false,
        'can_delete', false,
        'can_approve', false,
        'message', 'Bütçe yürütülüyor',
        'hint', 'Gerçekleşme verileri izlenebilir'
      )
    WHEN 'closed' THEN
      jsonb_build_object(
        'can_create', false,
        'can_edit', false,
        'can_delete', false,
        'can_approve', false,
        'message', 'Dönem kapatıldı',
        'hint', 'Sadece raporlama ve görüntüleme yapılabilir'
      )
    ELSE
      jsonb_build_object(
        'can_create', false,
        'can_edit', false,
        'can_delete', false,
        'can_approve', false,
        'message', 'Bilinmeyen dönem durumu'
      )
  END;
  
  -- Add period info
  v_constraints := v_constraints || jsonb_build_object(
    'period_status', v_period.period_status,
    'budget_year', v_period.budget_year,
    'preparation_year', v_period.preparation_year,
    'is_current', v_period.is_current
  );
  
  RETURN v_constraints;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Validate entry before save (to be called by triggers)
CREATE OR REPLACE FUNCTION validate_budget_entry_by_period()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id uuid;
  v_can_proceed boolean;
  v_constraints jsonb;
BEGIN
  -- Get period_id
  v_period_id := NEW.budget_period_id;
  
  -- Check if operation is allowed
  IF TG_OP = 'INSERT' THEN
    v_can_proceed := can_create_budget_entry(v_period_id, auth.uid());
    IF NOT v_can_proceed THEN
      v_constraints := get_period_constraints(v_period_id);
      RAISE EXCEPTION 'Bu dönemde yeni kayıt oluşturamazsınız: %', 
        v_constraints->>'message';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_can_proceed := can_edit_budget_entry(v_period_id, NEW.status, auth.uid());
    IF NOT v_can_proceed THEN
      v_constraints := get_period_constraints(v_period_id);
      RAISE EXCEPTION 'Bu dönemde bu kaydı düzenleyemezsiniz: %', 
        v_constraints->>'message';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_can_proceed := can_delete_budget_entry(v_period_id, OLD.status, auth.uid());
    IF NOT v_can_proceed THEN
      v_constraints := get_period_constraints(v_period_id);
      RAISE EXCEPTION 'Bu dönemde bu kaydı silemezsiniz: %', 
        v_constraints->>'message';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: We won't apply these triggers by default to avoid breaking existing functionality
-- They can be enabled later when the period system is fully implemented
-- To enable: CREATE TRIGGER trg_validate_period_multi_year BEFORE INSERT OR UPDATE OR DELETE ON multi_year_budget_entries FOR EACH ROW EXECUTE FUNCTION validate_budget_entry_by_period();

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_period_editable TO authenticated;
GRANT EXECUTE ON FUNCTION can_create_budget_entry TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_budget_entry TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_budget_entry TO authenticated;
GRANT EXECUTE ON FUNCTION get_period_constraints TO authenticated;
