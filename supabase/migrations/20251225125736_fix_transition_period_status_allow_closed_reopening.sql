/*
  # Kapalı Dönemleri Tekrar Açma Desteği

  ## Değişiklikler
  
  Bu migration `transition_period_status` fonksiyonunu günceller:
  
  1. Manuel geçişler için tüm durum geçişlerine izin verir
  2. Kapalı (closed) dönemler artık tekrar açılabilir
  3. Admin kullanıcılar ihtiyaç durumunda dönemleri yeniden aktif hale getirebilir
  
  ## Geçiş Kuralları
  
  ### Otomatik Geçişler (transition_type = 'automatic')
  - Sadece ileri doğru: draft → preparation → approval → approved → active → executing → closed
  
  ### Manuel Geçişler (transition_type = 'manual')
  - Tüm durumlara geçiş yapılabilir
  - Kapalı dönemler tekrar açılabilir
  - Geriye dönük düzeltmeler yapılabilir
  
  ## Güvenlik
  - RLS politikaları değiştirilmedi
  - Sadece admin ve super_admin kullanıcılar dönem durumlarını değiştirebilir
*/

-- Update transition_period_status function to allow manual reopening of closed periods
CREATE OR REPLACE FUNCTION transition_period_status(
  p_period_id uuid,
  p_new_status text,
  p_transition_type text DEFAULT 'manual',
  p_notes text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_current_status text;
  v_valid_transition boolean := false;
BEGIN
  -- Get current status
  SELECT period_status INTO v_current_status
  FROM budget_periods
  WHERE id = p_period_id;
  
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Dönem bulunamadı';
  END IF;
  
  -- Validate transitions based on type
  IF p_transition_type = 'manual' THEN
    -- For manual transitions, allow all status changes
    -- This allows admins to reopen closed periods or make corrections
    v_valid_transition := p_new_status IN ('draft', 'preparation', 'approval', 'approved', 'active', 'executing', 'closed');
  ELSE
    -- For automatic transitions, only allow forward progression
    v_valid_transition := CASE
      WHEN v_current_status = 'draft' AND p_new_status = 'preparation' THEN true
      WHEN v_current_status = 'preparation' AND p_new_status = 'approval' THEN true
      WHEN v_current_status = 'approval' AND p_new_status = 'approved' THEN true
      WHEN v_current_status = 'approved' AND p_new_status = 'active' THEN true
      WHEN v_current_status = 'active' AND p_new_status = 'executing' THEN true
      WHEN v_current_status = 'executing' AND p_new_status = 'closed' THEN true
      ELSE false
    END;
  END IF;
  
  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Geçersiz durum geçişi: % -> % (geçiş tipi: %)', v_current_status, p_new_status, p_transition_type;
  END IF;
  
  -- Update period
  UPDATE budget_periods
  SET 
    period_status = p_new_status,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = p_period_id;
  
  -- Log transition
  INSERT INTO budget_period_transitions (
    period_id,
    from_status,
    to_status,
    transition_type,
    notes,
    performed_by
  ) VALUES (
    p_period_id,
    v_current_status,
    p_new_status,
    p_transition_type,
    p_notes,
    auth.uid()
  );
  
  -- Send notification
  INSERT INTO budget_period_notifications (
    period_id,
    notification_type,
    title,
    message
  )
  SELECT
    p_period_id,
    'status_changed',
    'Dönem Durumu Değişti',
    bp.budget_year || ' mali yılı bütçe dönemi durumu "' || p_new_status || '" olarak güncellendi.'
  FROM budget_periods bp
  WHERE bp.id = p_period_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;