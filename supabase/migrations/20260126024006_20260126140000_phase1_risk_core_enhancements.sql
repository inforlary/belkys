/*
  # Faz 1: Risk Yönetimi Temel Altyapı Güncellemeleri

  Bu migration, risk yönetimi sistemine temel altyapı özelliklerini ekler.
  Mevcut 12 risk kaydı etkilenmez, sadece yeni tablolar ve özellikler eklenir.

  ## 1. Yeni Tablolar
    - `risk_versions` - Risk kayıtlarının versiyonları (değişiklik geçmişi)
    - `risk_events` - Risk üzerindeki tüm olaylar (audit trail)
    - `risk_approval_chain` - Çok aşamalı onay zinciri
    - `risk_comments` - Risk yorumları ve notları

  ## 2. Güvenlik
    - Tüm tablolar için RLS aktif
    - Organization ve department bazlı erişim kontrolleri
    - Super admin, admin, director, user rolleri desteklenir

  ## 3. Özellikler
    - Otomatik versiyon oluşturma (trigger ile)
    - Olay kaydı (event logging)
    - Yorum sistemi (threading desteği ile)
    - Gelişmiş onay iş akışı
*/

-- ═════════════════════════════════════════════════════════════════════════
-- 1. RISK VERSİYONLAMA SİSTEMİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  -- Risk verisi snapshot (JSONB olarak tüm risk verisi)
  risk_data JSONB NOT NULL,

  -- Değişiklik bilgileri
  change_summary TEXT,
  changed_fields TEXT[],

  -- Kim değiştirdi
  changed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Değişiklik nedeni/açıklaması
  change_reason TEXT,

  -- Önceki versiyon
  previous_version_id UUID REFERENCES risk_versions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(risk_id, version_number)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_risk_versions_risk_id ON risk_versions(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_versions_changed_by ON risk_versions(changed_by_id);
CREATE INDEX IF NOT EXISTS idx_risk_versions_changed_at ON risk_versions(changed_at DESC);

-- ═════════════════════════════════════════════════════════════════════════
-- 2. RİSK OLAY KAYDI (EVENT LOG)
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,

  -- Olay tipi
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'CREATED', 'UPDATED', 'DELETED',
    'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'REJECTED',
    'STATUS_CHANGED', 'SCORE_CHANGED', 'OWNER_CHANGED',
    'CONTROL_ADDED', 'CONTROL_UPDATED', 'CONTROL_REMOVED',
    'TREATMENT_ADDED', 'TREATMENT_UPDATED', 'TREATMENT_COMPLETED',
    'INDICATOR_ADDED', 'INDICATOR_THRESHOLD_BREACH',
    'REVIEW_COMPLETED', 'COMMENT_ADDED',
    'APPETITE_BREACH', 'ESCALATED', 'CLOSED', 'REOPENED'
  )),

  -- Olay detayları
  event_title VARCHAR(300) NOT NULL,
  event_description TEXT,

  -- Olay verisi (JSON)
  event_data JSONB,

  -- Önceki ve yeni değerler (değişiklik takibi için)
  old_value TEXT,
  new_value TEXT,

  -- Kim yaptı
  triggered_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Otomatik mi manuel mi
  is_system_generated BOOLEAN DEFAULT false,

  -- Önem seviyesi
  severity VARCHAR(20) DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_risk_events_risk_id ON risk_events(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(event_type);
CREATE INDEX IF NOT EXISTS idx_risk_events_triggered_at ON risk_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity) WHERE severity IN ('WARNING', 'CRITICAL');

-- ═════════════════════════════════════════════════════════════════════════
-- 3. RİSK ONAY ZİNCİRİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_approval_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,

  -- Onay aşaması
  approval_step INT NOT NULL,
  step_name VARCHAR(100) NOT NULL,

  -- Onayci
  approver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approver_role VARCHAR(50),
  approver_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Durum
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'CANCELLED'
  )),

  -- Karar
  decision_date TIMESTAMPTZ,
  decision_comments TEXT,

  -- Yetki devraldıysa
  delegated_from_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delegation_reason TEXT,

  -- Sıralama ve koşullar
  is_required BOOLEAN DEFAULT true,
  can_be_parallel BOOLEAN DEFAULT false,
  requires_all_if_parallel BOOLEAN DEFAULT true,

  -- SLA
  due_date TIMESTAMPTZ,
  is_overdue BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(risk_id, approval_step, approver_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_risk_approval_chain_risk_id ON risk_approval_chain(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_approval_chain_approver ON risk_approval_chain(approver_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_risk_approval_chain_status ON risk_approval_chain(status);
CREATE INDEX IF NOT EXISTS idx_risk_approval_chain_overdue ON risk_approval_chain(is_overdue) WHERE is_overdue = true;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. RİSK YORUMLARI
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,

  -- Yorum içeriği
  comment_text TEXT NOT NULL,

  -- Yorum tipi
  comment_type VARCHAR(20) DEFAULT 'GENERAL' CHECK (comment_type IN (
    'GENERAL', 'ASSESSMENT', 'CONTROL', 'TREATMENT',
    'APPROVAL', 'REVIEW', 'ESCALATION'
  )),

  -- Thread desteği (cevap zincirleri)
  parent_comment_id UUID REFERENCES risk_comments(id) ON DELETE CASCADE,
  thread_level INT DEFAULT 0,

  -- Kim yazdı
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Etiketler ve mention
  mentioned_user_ids UUID[],
  tags TEXT[],

  -- Dosya eki
  attachment_urls TEXT[],

  -- Durum
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,

  -- İşaretleme
  is_pinned BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_risk_comments_risk_id ON risk_comments(risk_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_risk_comments_author ON risk_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_risk_comments_parent ON risk_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_risk_comments_type ON risk_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_risk_comments_created ON risk_comments(created_at DESC);

-- ═════════════════════════════════════════════════════════════════════════
-- 5. OTOMATIK VERSİYONLAMA TETİKLEYİCİSİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_risk_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_number INT;
  v_changed_fields TEXT[];
  v_risk_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_version_number := 1;
    v_changed_fields := ARRAY['INITIAL_VERSION'];
    v_risk_data := to_jsonb(NEW);

    INSERT INTO risk_versions (
      risk_id, version_number, risk_data,
      change_summary, changed_fields, changed_by_id, change_reason
    ) VALUES (
      NEW.id, v_version_number, v_risk_data,
      'Risk kaydı oluşturuldu', v_changed_fields,
      NEW.identified_by_id, 'İlk versiyon'
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM risk_versions
    WHERE risk_id = NEW.id;

    v_changed_fields := ARRAY[]::TEXT[];

    IF OLD.name != NEW.name THEN v_changed_fields := array_append(v_changed_fields, 'name'); END IF;
    IF OLD.description IS DISTINCT FROM NEW.description THEN v_changed_fields := array_append(v_changed_fields, 'description'); END IF;
    IF OLD.inherent_likelihood != NEW.inherent_likelihood THEN v_changed_fields := array_append(v_changed_fields, 'inherent_likelihood'); END IF;
    IF OLD.inherent_impact != NEW.inherent_impact THEN v_changed_fields := array_append(v_changed_fields, 'inherent_impact'); END IF;
    IF OLD.residual_likelihood != NEW.residual_likelihood THEN v_changed_fields := array_append(v_changed_fields, 'residual_likelihood'); END IF;
    IF OLD.residual_impact != NEW.residual_impact THEN v_changed_fields := array_append(v_changed_fields, 'residual_impact'); END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN v_changed_fields := array_append(v_changed_fields, 'status'); END IF;
    IF OLD.risk_response IS DISTINCT FROM NEW.risk_response THEN v_changed_fields := array_append(v_changed_fields, 'risk_response'); END IF;
    IF OLD.owner_department_id IS DISTINCT FROM NEW.owner_department_id THEN v_changed_fields := array_append(v_changed_fields, 'owner_department_id'); END IF;

    IF array_length(v_changed_fields, 1) > 0 THEN
      v_risk_data := to_jsonb(NEW);

      INSERT INTO risk_versions (
        risk_id, version_number, risk_data,
        change_summary, changed_fields, changed_by_id
      ) VALUES (
        NEW.id, v_version_number, v_risk_data,
        'Risk güncellendi: ' || array_to_string(v_changed_fields, ', '),
        v_changed_fields,
        auth.uid()
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_risk_version ON risks;
CREATE TRIGGER trigger_create_risk_version
  AFTER INSERT OR UPDATE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION create_risk_version();

-- ═════════════════════════════════════════════════════════════════════════
-- 6. OTOMATIK OLAY KAYDI TETİKLEYİCİSİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_risk_event()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_type VARCHAR(50);
  v_event_title VARCHAR(300);
  v_event_description TEXT;
  v_severity VARCHAR(20) := 'INFO';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'CREATED';
    v_event_title := 'Risk kaydı oluşturuldu: ' || NEW.name;
    v_event_description := 'Yeni risk kaydı sisteme eklendi';

    INSERT INTO risk_events (
      risk_id, event_type, event_title, event_description,
      triggered_by_id, is_system_generated, severity
    ) VALUES (
      NEW.id, v_event_type, v_event_title, v_event_description,
      NEW.identified_by_id, true, v_severity
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_event_type := 'STATUS_CHANGED';
      v_event_title := 'Risk durumu değişti: ' || COALESCE(OLD.status, 'YOK') || ' → ' || COALESCE(NEW.status, 'YOK');
      v_event_description := 'Risk durumu güncellendi';

      INSERT INTO risk_events (
        risk_id, event_type, event_title, event_description,
        old_value, new_value, triggered_by_id, is_system_generated, severity
      ) VALUES (
        NEW.id, v_event_type, v_event_title, v_event_description,
        OLD.status, NEW.status, auth.uid(), true, 'INFO'
      );
    END IF;

    IF (OLD.inherent_score IS DISTINCT FROM NEW.inherent_score) OR
       (OLD.residual_score IS DISTINCT FROM NEW.residual_score) THEN
      v_event_type := 'SCORE_CHANGED';
      v_event_title := 'Risk skoru değişti';
      v_event_description := format(
        'İçsel Risk: %s → %s, Artık Risk: %s → %s',
        COALESCE(OLD.inherent_score::TEXT, '0'),
        COALESCE(NEW.inherent_score::TEXT, '0'),
        COALESCE(OLD.residual_score::TEXT, '0'),
        COALESCE(NEW.residual_score::TEXT, '0')
      );
      v_severity := CASE
        WHEN NEW.residual_score >= 16 THEN 'CRITICAL'
        WHEN NEW.residual_score >= 12 THEN 'WARNING'
        ELSE 'INFO'
      END;

      INSERT INTO risk_events (
        risk_id, event_type, event_title, event_description,
        event_data, triggered_by_id, is_system_generated, severity
      ) VALUES (
        NEW.id, v_event_type, v_event_title, v_event_description,
        jsonb_build_object(
          'old_inherent', OLD.inherent_score,
          'new_inherent', NEW.inherent_score,
          'old_residual', OLD.residual_score,
          'new_residual', NEW.residual_score
        ),
        auth.uid(), true, v_severity
      );
    END IF;

    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      v_event_type := CASE NEW.approval_status
        WHEN 'APPROVED' THEN 'APPROVED'
        WHEN 'REJECTED' THEN 'REJECTED'
        WHEN 'PENDING_APPROVAL' THEN 'SUBMITTED_FOR_APPROVAL'
        ELSE 'UPDATED'
      END;
      v_event_title := 'Onay durumu: ' || COALESCE(NEW.approval_status, 'YOK');
      v_event_description := 'Risk onay durumu güncellendi';

      INSERT INTO risk_events (
        risk_id, event_type, event_title, event_description,
        old_value, new_value, triggered_by_id, is_system_generated, severity
      ) VALUES (
        NEW.id, v_event_type, v_event_title, v_event_description,
        OLD.approval_status::TEXT, NEW.approval_status::TEXT,
        auth.uid(), true, 'INFO'
      );
    END IF;

    IF OLD.owner_department_id IS DISTINCT FROM NEW.owner_department_id THEN
      v_event_type := 'OWNER_CHANGED';
      v_event_title := 'Risk sahibi departman değişti';
      v_event_description := 'Risk sorumlusu güncellendi';

      INSERT INTO risk_events (
        risk_id, event_type, event_title, event_description,
        triggered_by_id, is_system_generated, severity
      ) VALUES (
        NEW.id, v_event_type, v_event_title, v_event_description,
        auth.uid(), true, 'WARNING'
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_risk_event ON risks;
CREATE TRIGGER trigger_log_risk_event
  AFTER INSERT OR UPDATE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION log_risk_event();

-- ═════════════════════════════════════════════════════════════════════════
-- 7. RLS POLİTİKALARI
-- ═════════════════════════════════════════════════════════════════════════

ALTER TABLE risk_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk versions of their organization"
  ON risk_versions FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create risk versions"
  ON risk_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk events of their organization"
  ON risk_events FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create risk events"
  ON risk_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE risk_approval_chain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval chain"
  ON risk_approval_chain FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage approval chain"
  ON risk_approval_chain FOR ALL
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

CREATE POLICY "Approvers can update their own steps"
  ON risk_approval_chain FOR UPDATE
  TO authenticated
  USING (approver_id = auth.uid())
  WITH CHECK (approver_id = auth.uid());

ALTER TABLE risk_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments of their organization"
  ON risk_comments FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND is_deleted = false
  );

CREATE POLICY "Users can insert comments"
  ON risk_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND author_id = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON risk_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Admins can delete any comments"
  ON risk_comments FOR UPDATE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
      )
    )
  );

-- ═════════════════════════════════════════════════════════════════════════
-- 8. YARDIMCI FONKSİYONLAR
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_risk_history(p_risk_id UUID)
RETURNS TABLE (
  entry_type TEXT,
  entry_date TIMESTAMPTZ,
  entry_title TEXT,
  entry_description TEXT,
  changed_by_name TEXT,
  version_number INT,
  event_type TEXT,
  severity TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'VERSION'::TEXT as entry_type,
    rv.changed_at as entry_date,
    ('Versiyon ' || rv.version_number::TEXT)::TEXT as entry_title,
    rv.change_summary as entry_description,
    p.full_name as changed_by_name,
    rv.version_number,
    NULL::TEXT as event_type,
    NULL::TEXT as severity
  FROM risk_versions rv
  LEFT JOIN profiles p ON p.id = rv.changed_by_id
  WHERE rv.risk_id = p_risk_id

  UNION ALL

  SELECT
    'EVENT'::TEXT as entry_type,
    re.triggered_at as entry_date,
    re.event_title as entry_title,
    re.event_description as entry_description,
    p.full_name as changed_by_name,
    NULL::INT as version_number,
    re.event_type,
    re.severity
  FROM risk_events re
  LEFT JOIN profiles p ON p.id = re.triggered_by_id
  WHERE re.risk_id = p_risk_id

  ORDER BY entry_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_comment_thread(p_comment_id UUID)
RETURNS TABLE (
  id UUID,
  comment_text TEXT,
  author_name TEXT,
  thread_level INT,
  created_at TIMESTAMPTZ,
  is_edited BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    SELECT
      c.id, c.comment_text, c.author_id, c.thread_level,
      c.created_at, c.is_edited, c.parent_comment_id
    FROM risk_comments c
    WHERE c.id = p_comment_id AND c.is_deleted = false

    UNION ALL

    SELECT
      c.id, c.comment_text, c.author_id, c.thread_level,
      c.created_at, c.is_edited, c.parent_comment_id
    FROM risk_comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.is_deleted = false
  )
  SELECT
    ct.id,
    ct.comment_text,
    p.full_name as author_name,
    ct.thread_level,
    ct.created_at,
    ct.is_edited
  FROM comment_tree ct
  LEFT JOIN profiles p ON p.id = ct.author_id
  ORDER BY ct.thread_level, ct.created_at;
END;
$$;