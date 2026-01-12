/*
  # Bütçe Dönemi Takip Tablolarını Geri Yükleme

  ## Genel Bakış
  20260106122756 migration'ında yanlışlıkla silinen ancak aktif olarak kullanılan
  bütçe dönemi takip tablolarını geri yükler.

  ## Yeni Tablolar

  ### budget_period_transitions
    - Bütçe dönemi durum geçiş logları
    - Hangi durumdan hangi duruma geçildiğini kaydeder
    - Manuel, otomatik ve sistem geçişlerini takip eder

  ### budget_period_notifications
    - Bütçe dönemi bildirimleri
    - Dönem başlangıç, bitiş, onay ve durum değişikliklerini bildirir
    - Rol bazlı bildirim gönderimi

  ## Güvenlik
    - RLS ile organizasyon izolasyonu
    - Authenticated kullanıcılar kendi organizasyonlarının kayıtlarını görebilir
    - System ve authenticated kullanıcılar kayıt ekleyebilir
*/

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
CREATE INDEX IF NOT EXISTS idx_period_transitions_period ON budget_period_transitions(period_id);
CREATE INDEX IF NOT EXISTS idx_period_transitions_date ON budget_period_transitions(transition_date);

CREATE INDEX IF NOT EXISTS idx_period_notifications_period ON budget_period_notifications(period_id);
CREATE INDEX IF NOT EXISTS idx_period_notifications_type ON budget_period_notifications(notification_type);

-- Enable RLS
ALTER TABLE budget_period_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_period_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_period_transitions

-- SELECT: Users can view transitions in their organization
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

-- SELECT: Super admins can view all transitions
CREATE POLICY "Super admins can view all transitions"
  ON budget_period_transitions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- INSERT: System can insert transitions
CREATE POLICY "System can insert transitions"
  ON budget_period_transitions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for budget_period_notifications

-- SELECT: Users can view notifications in their organization
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

-- SELECT: Super admins can view all notifications
CREATE POLICY "Super admins can view all notifications"
  ON budget_period_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- INSERT: System can insert notifications
CREATE POLICY "System can insert notifications"
  ON budget_period_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
