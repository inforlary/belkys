/*
  # Bütçe Dönemi Yaşam Döngüsü Yönetim Sistemi

  ## Genel Bakış
  Kamuda N yılında N+1 yılı bütçesinin hazırlandığı gerçeğine dayanan,
  otomatik yaşam döngüsü yönetimi sunan kapsamlı bütçe dönemi sistemi.

  ## 1. Yeni Tablolar

  ### budget_periods
    - Her bütçe dönemi için kayıt (örn: 2025'te hazırlanan 2026 bütçesi)
    - Dönem durumu: draft, preparation, approval, approved, active, executing, closed
    - Önemli tarihler: hazırlık başlangıcı, onay tarihi, yürürlük tarihleri
    - Dönem ayarları ve metadata

  ## 2. Dönem Durumları (Yaşam Döngüsü)
  
  | Durum | Açıklama | Örnek Tarih |
  |-------|----------|-------------|
  | draft | Dönem henüz başlatılmadı | - |
  | preparation | Bütçe hazırlanıyor, veri girişi devam ediyor | Ekim-Kasım 2025 |
  | approval | 3 aşamalı onay süreci (Müdür→VP→Admin) | Aralık 2025 |
  | approved | Tüm onaylar tamamlandı, TBMM'ye gönderildi | Ocak 2026 |
  | active | Bütçe yürürlüğe girdi, gerçekleşme başladı | 1 Ocak 2026 |
  | executing | Bütçe uygulanıyor, gerçekleşmeler kaydediliyor | 2026 yılı boyunca |
  | closed | Dönem kapandı, sadece raporlama | 1 Ocak 2027+ |

  ## 3. Özellikler
    - Otomatik dönem başlatma (her yıl Ekim)
    - Önceki yıl verilerini klonlama
    - Dönem bazlı erişim kontrolü
    - Tarih bazlı otomatik durum geçişleri
    - Bildirim sistemi entegrasyonu
    - Çok yıllı bütçe görünümü

  ## 4. Güvenlik
    - RLS ile organizasyon izolasyonu
    - Dönem durumuna göre CRUD kısıtlamaları
    - Sadece admin ve super_admin dönem yönetimi yapabilir
*/

-- Budget Periods Table
CREATE TABLE IF NOT EXISTS budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Yıl bilgileri
  preparation_year integer NOT NULL, -- Hazırlık yılı (örn: 2025)
  budget_year integer NOT NULL,      -- Bütçe yılı (örn: 2026)
  
  -- Dönem durumu
  period_status text NOT NULL DEFAULT 'draft' CHECK (period_status IN (
    'draft',           -- Dönem oluşturuldu, henüz başlamadı
    'preparation',     -- Hazırlanıyor (veri girişi, düzenleme)
    'approval',        -- Onay sürecinde (3 aşamalı onay)
    'approved',        -- Onaylandı (TBMM onayı bekleniyor/alındı)
    'active',          -- Aktif/Yürürlükte (mali yıl başladı)
    'executing',       -- Gerçekleşiyor (yıl içinde)
    'closed'           -- Kapandı (sadece raporlama)
  )),
  
  -- Önemli tarihler
  preparation_start_date date,       -- Hazırlık başlangıcı (örn: 1 Ekim 2025)
  preparation_end_date date,         -- Hazırlık sonu (örn: 30 Kasım 2025)
  approval_start_date date,          -- Onay süreci başlangıcı (örn: 1 Aralık 2025)
  approval_deadline_date date,       -- Onay son tarihi (örn: 31 Aralık 2025)
  execution_start_date date,         -- Yürürlük başlangıcı (örn: 1 Ocak 2026)
  execution_end_date date,           -- Yürürlük bitişi (örn: 31 Aralık 2026)
  closing_date date,                 -- Kapanış tarihi (örn: 31 Mart 2027)
  
  -- Durum
  is_active boolean DEFAULT true,    -- Aktif dönem mi?
  is_current boolean DEFAULT false,  -- Şu an üzerinde çalışılan dönem mi?
  
  -- Ayarlar ve metadata
  settings jsonb DEFAULT '{}'::jsonb, -- Dönem özel ayarları
  notes text,                        -- Notlar
  
  -- Otomatik geçiş ayarları
  auto_transition_enabled boolean DEFAULT true, -- Otomatik durum geçişi
  
  -- Klonlama bilgisi
  cloned_from_period_id uuid REFERENCES budget_periods(id),
  cloned_at timestamptz,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  
  -- Aynı organizasyonda aynı yıl bir kez
  CONSTRAINT unique_org_budget_year UNIQUE (organization_id, budget_year),
  
  -- Hazırlık yılı bütçe yılından küçük olmalı
  CONSTRAINT valid_year_sequence CHECK (preparation_year < budget_year),
  
  -- Sadece bir dönem current olabilir
  CONSTRAINT only_one_current_period UNIQUE (organization_id, is_current) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Period Transition History Table (Dönem geçiş logları)
CREATE TABLE IF NOT EXISTS budget_period_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  
  -- Geçiş bilgileri
  from_status text NOT NULL,
  to_status text NOT NULL,
  transition_date timestamptz DEFAULT now(),
  
  -- Geçiş nedeni
  transition_type text NOT NULL CHECK (transition_type IN (
    'manual',      -- Manuel olarak değiştirildi
    'automatic',   -- Otomatik tarih bazlı geçiş
    'system'       -- Sistem tarafından (onay tamamlandı, vb)
  )),
  
  -- Detaylar
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Kim yaptı
  performed_by uuid REFERENCES profiles(id),
  
  created_at timestamptz DEFAULT now()
);

-- Period Notifications Table (Dönem bildirimleri)
CREATE TABLE IF NOT EXISTS budget_period_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  
  -- Bildirim detayları
  notification_type text NOT NULL CHECK (notification_type IN (
    'period_started',        -- Dönem başladı
    'period_ending_soon',    -- Dönem yakında bitiyor
    'approval_required',     -- Onay gerekiyor
    'period_closed',         -- Dönem kapandı
    'deadline_approaching',  -- Son tarih yaklaşıyor
    'status_changed'         -- Durum değişti
  )),
  
  title text NOT NULL,
  message text NOT NULL,
  
  -- Gönderim bilgileri
  sent_at timestamptz DEFAULT now(),
  sent_to_roles text[] DEFAULT ARRAY['admin', 'vice_president', 'manager'],
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_periods_org ON budget_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_periods_budget_year ON budget_periods(budget_year);
CREATE INDEX IF NOT EXISTS idx_budget_periods_prep_year ON budget_periods(preparation_year);
CREATE INDEX IF NOT EXISTS idx_budget_periods_status ON budget_periods(period_status);
CREATE INDEX IF NOT EXISTS idx_budget_periods_current ON budget_periods(organization_id, is_current) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_period_transitions_period ON budget_period_transitions(period_id);
CREATE INDEX IF NOT EXISTS idx_period_transitions_date ON budget_period_transitions(transition_date);

CREATE INDEX IF NOT EXISTS idx_period_notifications_period ON budget_period_notifications(period_id);
CREATE INDEX IF NOT EXISTS idx_period_notifications_type ON budget_period_notifications(notification_type);

-- Enable RLS
ALTER TABLE budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_period_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_period_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_periods

-- SELECT: Users can view periods in their organization
CREATE POLICY "Users can view periods in their organization"
  ON budget_periods FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- SELECT: Super admins can view all periods
CREATE POLICY "Super admins can view all periods"
  ON budget_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- INSERT: Only admins and super admins can create periods
CREATE POLICY "Admins can create periods"
  ON budget_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_periods.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Super admins can create periods"
  ON budget_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- UPDATE: Admins and super admins can update periods
CREATE POLICY "Admins can update periods"
  ON budget_periods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = budget_periods.organization_id
      AND role = 'admin'
    )
  );

CREATE POLICY "Super admins can update periods"
  ON budget_periods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- DELETE: Only super admins can delete periods
CREATE POLICY "Super admins can delete periods"
  ON budget_periods FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- RLS Policies for budget_period_transitions
CREATE POLICY "Users can view transitions in their organization"
  ON budget_period_transitions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_periods bp
      JOIN profiles p ON p.organization_id = bp.organization_id
      WHERE bp.id = budget_period_transitions.period_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all transitions"
  ON budget_period_transitions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "System can insert transitions"
  ON budget_period_transitions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for budget_period_notifications
CREATE POLICY "Users can view notifications in their organization"
  ON budget_period_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_periods bp
      JOIN profiles p ON p.organization_id = bp.organization_id
      WHERE bp.id = budget_period_notifications.period_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all notifications"
  ON budget_period_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "System can insert notifications"
  ON budget_period_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function: Create a new budget period
CREATE OR REPLACE FUNCTION create_budget_period(
  p_organization_id uuid,
  p_preparation_year integer,
  p_budget_year integer,
  p_auto_start boolean DEFAULT false
)
RETURNS uuid AS $$
DECLARE
  v_period_id uuid;
  v_start_date date;
BEGIN
  -- Validation
  IF p_preparation_year >= p_budget_year THEN
    RAISE EXCEPTION 'Hazırlık yılı bütçe yılından küçük olmalıdır';
  END IF;
  
  -- Calculate dates (Kamu bütçe takvimi)
  v_start_date := make_date(p_preparation_year, 10, 1); -- 1 Ekim
  
  -- Create period
  INSERT INTO budget_periods (
    organization_id,
    preparation_year,
    budget_year,
    period_status,
    preparation_start_date,
    preparation_end_date,
    approval_start_date,
    approval_deadline_date,
    execution_start_date,
    execution_end_date,
    closing_date,
    is_active,
    is_current,
    created_by
  ) VALUES (
    p_organization_id,
    p_preparation_year,
    p_budget_year,
    CASE WHEN p_auto_start THEN 'preparation' ELSE 'draft' END,
    make_date(p_preparation_year, 10, 1),  -- 1 Ekim - Hazırlık başlar
    make_date(p_preparation_year, 11, 30), -- 30 Kasım - Hazırlık biter
    make_date(p_preparation_year, 12, 1),  -- 1 Aralık - Onay başlar
    make_date(p_preparation_year, 12, 31), -- 31 Aralık - Onay biter
    make_date(p_budget_year, 1, 1),        -- 1 Ocak - Yürürlük başlar
    make_date(p_budget_year, 12, 31),      -- 31 Aralık - Yürürlük biter
    make_date(p_budget_year + 1, 3, 31),   -- 31 Mart - Kapanış
    true,
    p_auto_start, -- Otomatik başlatılırsa current olur
    auth.uid()
  ) RETURNING id INTO v_period_id;
  
  -- Log transition
  INSERT INTO budget_period_transitions (
    period_id,
    from_status,
    to_status,
    transition_type,
    notes,
    performed_by
  ) VALUES (
    v_period_id,
    'none',
    CASE WHEN p_auto_start THEN 'preparation' ELSE 'draft' END,
    'system',
    'Dönem oluşturuldu',
    auth.uid()
  );
  
  -- Send notification
  IF p_auto_start THEN
    INSERT INTO budget_period_notifications (
      period_id,
      notification_type,
      title,
      message,
      sent_to_roles
    ) VALUES (
      v_period_id,
      'period_started',
      p_budget_year || ' Mali Yılı Bütçe Hazırlığı Başladı',
      p_budget_year || ' mali yılı bütçe hazırlık dönemi ' || to_char(v_start_date, 'DD.MM.YYYY') || ' tarihinde başlamıştır. Lütfen bütçe verilerinizi girerek onaya sununuz.',
      ARRAY['admin', 'vice_president', 'manager']
    );
  END IF;
  
  -- Initialize year settings
  INSERT INTO budget_year_settings (organization_id, year, year_type, is_active)
  VALUES (p_organization_id, p_budget_year, 'budget', true)
  ON CONFLICT (organization_id, year) DO NOTHING;
  
  RETURN v_period_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Transition period status
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
  
  -- Validate transitions
  v_valid_transition := CASE
    WHEN v_current_status = 'draft' AND p_new_status = 'preparation' THEN true
    WHEN v_current_status = 'preparation' AND p_new_status = 'approval' THEN true
    WHEN v_current_status = 'approval' AND p_new_status = 'approved' THEN true
    WHEN v_current_status = 'approved' AND p_new_status = 'active' THEN true
    WHEN v_current_status = 'active' AND p_new_status = 'executing' THEN true
    WHEN v_current_status = 'executing' AND p_new_status = 'closed' THEN true
    -- Allow going back to previous states (for corrections)
    WHEN p_new_status IN ('draft', 'preparation', 'approval') AND v_current_status != 'closed' THEN true
    ELSE false
  END;
  
  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Geçersiz durum geçişi: % -> %', v_current_status, p_new_status;
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

-- Function: Start budget preparation for next year (Otomatik yıllık çalışma)
CREATE OR REPLACE FUNCTION start_next_year_budget_preparation(
  p_organization_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_current_period record;
  v_new_period_id uuid;
  v_clone_result jsonb;
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
  
  IF v_current_period IS NULL THEN
    RAISE EXCEPTION 'Önceki dönem bulunamadı. Lütfen önce bir dönem oluşturun.';
  END IF;
  
  -- Create next period
  v_new_period_id := create_budget_period(
    p_organization_id,
    v_current_period.budget_year,           -- Mevcut bütçe yılı hazırlık yılı olur
    v_current_period.budget_year + 1,       -- Bir sonraki yıl
    true                                     -- Auto-start
  );
  
  -- Clone data from previous year
  v_clone_result := clone_budget_for_next_year(
    p_organization_id,
    v_current_period.budget_year,
    v_current_period.budget_year + 1
  );
  
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
    'previous_budget_year', v_current_period.budget_year,
    'new_budget_year', v_current_period.budget_year + 1,
    'clone_result', v_clone_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get current budget period for organization
CREATE OR REPLACE FUNCTION get_current_budget_period(p_organization_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_period record;
BEGIN
  SELECT * INTO v_period
  FROM budget_periods
  WHERE organization_id = p_organization_id
  AND is_current = true
  LIMIT 1;
  
  IF v_period IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN to_jsonb(v_period);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_budget_period TO authenticated;
GRANT EXECUTE ON FUNCTION transition_period_status TO authenticated;
GRANT EXECUTE ON FUNCTION start_next_year_budget_preparation TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_budget_period TO authenticated;
