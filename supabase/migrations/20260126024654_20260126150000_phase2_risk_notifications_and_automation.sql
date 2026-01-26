/*
  # Faz 2: Risk Yönetimi Bildirimler ve Otomasyon

  Bu migration, risk yönetimi sistemine akıllı bildirimler ve otomasyon özellikleri ekler.

  ## 1. Yeni Tablolar
    - `risk_notifications` - Bildirim sistemi
    - `risk_escalation_rules` - Eskalasyon kuralları
    - `risk_sla_tracking` - SLA takip sistemi
    - `risk_recommendations` - Akıllı öneriler
    - `risk_notification_preferences` - Kullanıcı bildirim tercihleri

  ## 2. Özellikler
    - Gerçek zamanlı bildirimler
    - Otomatik eskalasyon
    - SLA uyarıları
    - Akıllı risk önerileri
    - Email entegrasyonu (hazır)

  ## 3. Güvenlik
    - RLS ile kullanıcı bazlı bildirimler
    - Organization izolasyonu
    - Rol bazlı erişim
*/

-- ═════════════════════════════════════════════════════════════════════════
-- 1. BİLDİRİM SİSTEMİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
  
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'RISK_CREATED', 'RISK_UPDATED', 'RISK_HIGH_SCORE',
    'REVIEW_DUE', 'REVIEW_OVERDUE', 'APPROVAL_REQUIRED',
    'APPROVAL_APPROVED', 'APPROVAL_REJECTED',
    'TREATMENT_DUE', 'TREATMENT_OVERDUE', 'TREATMENT_COMPLETED',
    'CONTROL_FAILURE', 'INDICATOR_BREACH',
    'ESCALATION', 'SLA_WARNING', 'SLA_BREACH',
    'COMMENT_MENTION', 'COMMENT_REPLY',
    'RECOMMENDATION', 'SYSTEM_ALERT'
  )),
  
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  
  priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN (
    'LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'
  )),
  
  requires_action BOOLEAN DEFAULT false,
  action_url TEXT,
  action_label VARCHAR(100),
  
  status VARCHAR(20) DEFAULT 'UNREAD' CHECK (status IN (
    'UNREAD', 'READ', 'ARCHIVED', 'ACTIONED'
  )),
  
  read_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  
  metadata JSONB,
  
  batch_id UUID,
  
  related_notification_id UUID REFERENCES risk_notifications(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_notifications_user_status 
  ON risk_notifications(user_id, status) WHERE status = 'UNREAD';
CREATE INDEX IF NOT EXISTS idx_risk_notifications_risk 
  ON risk_notifications(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_notifications_type 
  ON risk_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_risk_notifications_priority 
  ON risk_notifications(priority) WHERE priority IN ('URGENT', 'CRITICAL');
CREATE INDEX IF NOT EXISTS idx_risk_notifications_created 
  ON risk_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_notifications_org 
  ON risk_notifications(organization_id);

-- ═════════════════════════════════════════════════════════════════════════
-- 2. ESKALASYON KURALLARI
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(200) NOT NULL,
  description TEXT,
  
  trigger_condition VARCHAR(50) NOT NULL CHECK (trigger_condition IN (
    'HIGH_RISK_SCORE', 'REVIEW_OVERDUE', 'TREATMENT_OVERDUE',
    'NO_PROGRESS', 'REPEATED_FAILURE', 'SLA_BREACH',
    'INDICATOR_THRESHOLD', 'CONTROL_FAILURE', 'CUSTOM'
  )),
  
  threshold_value NUMERIC,
  threshold_unit VARCHAR(20),
  threshold_days INT,
  
  applies_to_risk_levels TEXT[],
  applies_to_categories UUID[],
  applies_to_departments UUID[],
  
  escalation_type VARCHAR(50) NOT NULL CHECK (escalation_type IN (
    'NOTIFY_MANAGER', 'NOTIFY_ADMIN', 'NOTIFY_DIRECTOR',
    'CHANGE_OWNER', 'INCREASE_PRIORITY', 'REQUIRE_APPROVAL',
    'CREATE_TASK', 'SEND_EMAIL', 'CUSTOM'
  )),
  
  escalate_to_role VARCHAR(50),
  escalate_to_users UUID[],
  escalate_to_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  
  delay_days INT DEFAULT 0,
  
  repeat_enabled BOOLEAN DEFAULT false,
  repeat_interval_days INT,
  max_repetitions INT,
  
  is_active BOOLEAN DEFAULT true,
  
  times_triggered INT DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_escalation_rules_org 
  ON risk_escalation_rules(organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_risk_escalation_rules_condition 
  ON risk_escalation_rules(trigger_condition) WHERE is_active = true;

-- ═════════════════════════════════════════════════════════════════════════
-- 3. SLA TAKİP SİSTEMİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  
  sla_type VARCHAR(50) NOT NULL CHECK (sla_type IN (
    'FIRST_RESPONSE', 'ASSESSMENT', 'TREATMENT_PLAN',
    'REVIEW', 'APPROVAL', 'RESOLUTION', 'CLOSURE'
  )),
  
  target_hours INT NOT NULL,
  warning_threshold_hours INT,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_date TIMESTAMPTZ NOT NULL,
  warning_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' CHECK (status IN (
    'IN_PROGRESS', 'WARNING', 'BREACHED', 'COMPLETED', 'CANCELLED', 'PAUSED'
  )),
  
  paused_at TIMESTAMPTZ,
  pause_reason TEXT,
  total_paused_hours INT DEFAULT 0,
  
  actual_hours INT,
  is_within_sla BOOLEAN,
  breach_hours INT,
  
  warning_notification_sent BOOLEAN DEFAULT false,
  breach_notification_sent BOOLEAN DEFAULT false,
  
  completion_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_sla_tracking_risk 
  ON risk_sla_tracking(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_sla_tracking_status 
  ON risk_sla_tracking(status) WHERE status IN ('IN_PROGRESS', 'WARNING');
CREATE INDEX IF NOT EXISTS idx_risk_sla_tracking_target 
  ON risk_sla_tracking(target_date) WHERE status = 'IN_PROGRESS';

-- ═════════════════════════════════════════════════════════════════════════
-- 4. AKILLI ÖNERİLER
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  
  recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
    'TREATMENT_SUGGESTION', 'CONTROL_SUGGESTION', 'REVIEW_FREQUENCY',
    'RISK_RESPONSE_CHANGE', 'CATEGORY_CHANGE', 'OWNER_CHANGE',
    'SIMILAR_RISKS', 'BEST_PRACTICE', 'REGULATORY_COMPLIANCE',
    'RESOURCE_ALLOCATION', 'PRIORITY_CHANGE', 'AUTOMATION'
  )),
  
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  
  suggested_action TEXT,
  expected_benefit TEXT,
  implementation_effort VARCHAR(20) CHECK (implementation_effort IN (
    'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'
  )),
  
  priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN (
    'LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'
  )),
  
  confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  related_risks UUID[],
  related_controls UUID[],
  related_treatments UUID[],
  
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'DISMISSED'
  )),
  
  reviewed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT,
  
  implemented_at TIMESTAMPTZ,
  
  metadata JSONB,
  
  is_system_generated BOOLEAN DEFAULT true,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  expires_at TIMESTAMPTZ,
  is_expired BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_recommendations_risk 
  ON risk_recommendations(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_recommendations_status 
  ON risk_recommendations(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_risk_recommendations_type 
  ON risk_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_risk_recommendations_priority 
  ON risk_recommendations(priority) WHERE priority IN ('HIGH', 'URGENT', 'CRITICAL');

-- ═════════════════════════════════════════════════════════════════════════
-- 5. KULLANICI BİLDİRİM TERCİHLERİ
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  email_enabled BOOLEAN DEFAULT true,
  email_frequency VARCHAR(20) DEFAULT 'IMMEDIATE' CHECK (email_frequency IN (
    'IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY', 'NEVER'
  )),
  email_digest_time TIME DEFAULT '09:00:00',
  
  notify_risk_created BOOLEAN DEFAULT true,
  notify_risk_updated BOOLEAN DEFAULT false,
  notify_high_risk BOOLEAN DEFAULT true,
  notify_review_due BOOLEAN DEFAULT true,
  notify_approval_required BOOLEAN DEFAULT true,
  notify_treatment_due BOOLEAN DEFAULT true,
  notify_escalation BOOLEAN DEFAULT true,
  notify_sla_warning BOOLEAN DEFAULT true,
  notify_mentions BOOLEAN DEFAULT true,
  notify_recommendations BOOLEAN DEFAULT false,
  
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  weekend_notifications_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ═════════════════════════════════════════════════════════════════════════
-- 6. YARDIMCI FONKSİYON: BİLDİRİM OLUŞTUR
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_risk_notification(
  p_user_id UUID,
  p_organization_id UUID,
  p_risk_id UUID,
  p_notification_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_priority VARCHAR DEFAULT 'MEDIUM',
  p_requires_action BOOLEAN DEFAULT false,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_notification_id UUID;
  v_prefs RECORD;
BEGIN
  SELECT * INTO v_prefs
  FROM risk_notification_preferences
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO risk_notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;
  
  IF (p_notification_type = 'RISK_CREATED' AND NOT v_prefs.notify_risk_created) OR
     (p_notification_type = 'RISK_UPDATED' AND NOT v_prefs.notify_risk_updated) OR
     (p_notification_type LIKE '%REVIEW%' AND NOT v_prefs.notify_review_due) OR
     (p_notification_type LIKE '%APPROVAL%' AND NOT v_prefs.notify_approval_required) OR
     (p_notification_type LIKE '%TREATMENT%' AND NOT v_prefs.notify_treatment_due) OR
     (p_notification_type = 'ESCALATION' AND NOT v_prefs.notify_escalation) OR
     (p_notification_type LIKE '%SLA%' AND NOT v_prefs.notify_sla_warning) OR
     (p_notification_type LIKE '%MENTION%' AND NOT v_prefs.notify_mentions) OR
     (p_notification_type = 'RECOMMENDATION' AND NOT v_prefs.notify_recommendations)
  THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO risk_notifications (
    user_id, organization_id, risk_id,
    notification_type, title, message,
    priority, requires_action, action_url, metadata
  ) VALUES (
    p_user_id, p_organization_id, p_risk_id,
    p_notification_type, p_title, p_message,
    p_priority, p_requires_action, p_action_url, p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 7. TETİKLEYİCİ: SLA KONTROLÜ
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_risk_sla()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  sla_record RECORD;
  risk_record RECORD;
BEGIN
  FOR sla_record IN
    SELECT * FROM risk_sla_tracking
    WHERE status = 'IN_PROGRESS'
    AND completed_at IS NULL
  LOOP
    SELECT * INTO risk_record FROM risks WHERE id = sla_record.risk_id;
    
    IF sla_record.warning_date IS NOT NULL 
       AND NOW() >= sla_record.warning_date
       AND sla_record.status != 'WARNING'
       AND NOT sla_record.warning_notification_sent
    THEN
      UPDATE risk_sla_tracking
      SET status = 'WARNING',
          warning_notification_sent = true,
          updated_at = NOW()
      WHERE id = sla_record.id;
      
      PERFORM create_risk_notification(
        (SELECT identified_by_id FROM risks WHERE id = sla_record.risk_id),
        risk_record.organization_id,
        sla_record.risk_id,
        'SLA_WARNING',
        'SLA Uyarısı: ' || risk_record.name,
        'SLA hedefi yaklaşıyor. ' || sla_record.sla_type || ' işlemi tamamlanmalı.',
        'HIGH',
        true,
        '/risk-management/detail/' || sla_record.risk_id::TEXT,
        jsonb_build_object('sla_id', sla_record.id, 'sla_type', sla_record.sla_type)
      );
    END IF;
    
    IF NOW() >= sla_record.target_date 
       AND sla_record.status != 'BREACHED'
       AND NOT sla_record.breach_notification_sent
    THEN
      UPDATE risk_sla_tracking
      SET status = 'BREACHED',
          breach_notification_sent = true,
          breach_hours = EXTRACT(EPOCH FROM (NOW() - target_date)) / 3600,
          updated_at = NOW()
      WHERE id = sla_record.id;
      
      PERFORM create_risk_notification(
        (SELECT identified_by_id FROM risks WHERE id = sla_record.risk_id),
        risk_record.organization_id,
        sla_record.risk_id,
        'SLA_BREACH',
        'SLA İhlali: ' || risk_record.name,
        'SLA hedefi aşıldı! ' || sla_record.sla_type || ' işlemi gecikmiş.',
        'CRITICAL',
        true,
        '/risk-management/detail/' || sla_record.risk_id::TEXT,
        jsonb_build_object('sla_id', sla_record.id, 'sla_type', sla_record.sla_type)
      );
      
      INSERT INTO risk_events (
        risk_id, event_type, event_title, event_description,
        severity, is_system_generated
      ) VALUES (
        sla_record.risk_id,
        'ESCALATED',
        'SLA İhlali',
        'SLA hedefi aşıldı: ' || sla_record.sla_type,
        'CRITICAL',
        true
      );
    END IF;
  END LOOP;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 8. TETİKLEYİCİ: OTOMATIK ESKALASYON
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_escalate_risks()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  rule_record RECORD;
  risk_record RECORD;
  should_trigger BOOLEAN;
  v_user_id UUID;
BEGIN
  FOR rule_record IN
    SELECT * FROM risk_escalation_rules
    WHERE is_active = true
  LOOP
    FOR risk_record IN
      SELECT r.* FROM risks r
      WHERE r.organization_id = rule_record.organization_id
      AND (rule_record.applies_to_departments IS NULL 
           OR r.owner_department_id = ANY(rule_record.applies_to_departments))
    LOOP
      should_trigger := false;
      
      CASE rule_record.trigger_condition
        WHEN 'HIGH_RISK_SCORE' THEN
          IF risk_record.residual_score >= COALESCE(rule_record.threshold_value, 16) THEN
            should_trigger := true;
          END IF;
          
        WHEN 'REVIEW_OVERDUE' THEN
          IF risk_record.next_review_date IS NOT NULL 
             AND risk_record.next_review_date < NOW() - (rule_record.threshold_days || ' days')::INTERVAL
          THEN
            should_trigger := true;
          END IF;
          
        WHEN 'NO_PROGRESS' THEN
          IF NOT EXISTS (
            SELECT 1 FROM risk_versions
            WHERE risk_id = risk_record.id
            AND changed_at >= NOW() - (COALESCE(rule_record.threshold_days, 30) || ' days')::INTERVAL
          ) THEN
            should_trigger := true;
          END IF;
      END CASE;
      
      IF should_trigger THEN
        UPDATE risk_escalation_rules
        SET times_triggered = times_triggered + 1,
            last_triggered_at = NOW()
        WHERE id = rule_record.id;
        
        CASE rule_record.escalation_type
          WHEN 'NOTIFY_MANAGER', 'NOTIFY_ADMIN', 'NOTIFY_DIRECTOR' THEN
            IF rule_record.escalate_to_users IS NOT NULL THEN
              FOREACH v_user_id IN ARRAY rule_record.escalate_to_users LOOP
                PERFORM create_risk_notification(
                  v_user_id,
                  risk_record.organization_id,
                  risk_record.id,
                  'ESCALATION',
                  'Risk Eskalasyonu: ' || risk_record.name,
                  'Risk otomatik olarak eskalasyon edildi: ' || rule_record.rule_name,
                  'URGENT',
                  true,
                  '/risk-management/detail/' || risk_record.id::TEXT,
                  jsonb_build_object('rule_id', rule_record.id, 'rule_name', rule_record.rule_name)
                );
              END LOOP;
            END IF;
        END CASE;
        
        INSERT INTO risk_events (
          risk_id, event_type, event_title, event_description,
          event_data, severity, is_system_generated
        ) VALUES (
          risk_record.id,
          'ESCALATED',
          'Otomatik Eskalasyon: ' || rule_record.rule_name,
          'Risk otomatik eskalasyon kuralı tarafından eskalasyon edildi',
          jsonb_build_object('rule_id', rule_record.id),
          'WARNING',
          true
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 9. RLS POLİTİKALARI
-- ═════════════════════════════════════════════════════════════════════════

ALTER TABLE risk_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON risk_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON risk_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON risk_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE risk_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view escalation rules"
  ON risk_escalation_rules FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage escalation rules"
  ON risk_escalation_rules FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

ALTER TABLE risk_sla_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SLA tracking"
  ON risk_sla_tracking FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can manage SLA tracking"
  ON risk_sla_tracking FOR ALL
  TO authenticated
  WITH CHECK (true);

ALTER TABLE risk_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recommendations"
  ON risk_recommendations FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update recommendations"
  ON risk_recommendations FOR UPDATE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create recommendations"
  ON risk_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE risk_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON risk_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own preferences"
  ON risk_notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());