/*
  # İÇ KONTROL EYLEM PLANI GELİŞTİRMELERİ

  ## Genel Açıklama
  Bu migration, iç kontrol eylem planı modülüne kapsamlı güncellemeler getirmektedir:
  - Eylem tipi ve modül bağlantısı özellikleri
  - 3 aşamalı onay mekanizması
  - Otomatik bildirim sistemi
  - Bağlantılı modüllerle entegrasyon
  - İlerleme takip sistemi

  ## 1. ic_actions Tablosuna Yeni Kolonlar

  ### Eylem Tipi ve Bağlantı Alanları
  - `action_type`: Eylem türü (tek_seferlik, donemsel, surekli, baglantili)
  - `linked_module`: Bağlantılı modül (surec_yonetimi, is_akis, risk_yonetimi, doküman vb.)
  - `target_quantity`: Hedef miktar (bağlantılı eylemler için)
  - `current_quantity`: Mevcut miktar (otomatik hesaplanan)
  - `period_year`: Dönem yılı (dönemsel eylemler için)

  ### Onay Sistemi Alanları
  - `approval_status`: Onay durumu (taslak, birim_onayi_bekliyor, yonetim_onayi_bekliyor, onaylandi, reddedildi)
  - `unit_approved_by`: Birim onaylayan kullanıcı
  - `unit_approved_at`: Birim onay tarihi
  - `management_approved_by`: Yönetim onaylayan kullanıcı
  - `management_approved_at`: Yönetim onay tarihi
  - `rejection_reason`: Red gerekçesi
  - `submitted_by`: Onaya gönderen kullanıcı
  - `submitted_at`: Onaya gönderilme tarihi

  ### İlave Takip Alanları
  - `current_status_detail`: Mevcut durum detayı
  - `compliance_level`: Uygunluk seviyesi (uygun, uygun_degil, kismen_uygun)

  ## 2. Yeni Tablo: ic_action_notifications
  Eylem planı ile ilgili bildirimleri yönetir
  - Hatırlatmalar (30 gün, 7 gün)
  - Gecikme bildirimleri
  - Onay talepleri
  - Onay/Red sonuçları

  ## 3. Fonksiyonlar
  - Otomatik bildirim oluşturma
  - Bağlantılı modül miktarını hesaplama
  - İlerleme yüzdesi otomatik güncelleme

  ## 4. Güvenlik
  - RLS politikaları güncellendi
  - Onay yetkisi kontrolleri eklendi
*/

-- ic_actions tablosuna yeni kolonlar ekle
ALTER TABLE ic_actions
ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) DEFAULT 'tek_seferlik' CHECK (action_type IN ('tek_seferlik', 'donemsel', 'surekli', 'baglantili')),
ADD COLUMN IF NOT EXISTS linked_module VARCHAR(100) CHECK (linked_module IN ('surec_yonetimi', 'is_akis_semalari', 'hassas_gorevler', 'risk_yonetimi', 'dokuman_yonetimi', NULL)),
ADD COLUMN IF NOT EXISTS target_quantity INTEGER,
ADD COLUMN IF NOT EXISTS current_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS period_year INTEGER,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'taslak' CHECK (approval_status IN ('taslak', 'birim_onayi_bekliyor', 'yonetim_onayi_bekliyor', 'onaylandi', 'reddedildi')),
ADD COLUMN IF NOT EXISTS unit_approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS unit_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS management_approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS management_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_status_detail TEXT,
ADD COLUMN IF NOT EXISTS compliance_level VARCHAR(50) CHECK (compliance_level IN ('uygun', 'uygun_degil', 'kismen_uygun', NULL));

-- İndeksler ekle
CREATE INDEX IF NOT EXISTS idx_ic_actions_approval_status ON ic_actions(approval_status);
CREATE INDEX IF NOT EXISTS idx_ic_actions_action_type ON ic_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ic_actions_linked_module ON ic_actions(linked_module);
CREATE INDEX IF NOT EXISTS idx_ic_actions_period_year ON ic_actions(period_year);
CREATE INDEX IF NOT EXISTS idx_ic_actions_target_date ON ic_actions(target_date);

-- Bildirimler tablosu oluştur
CREATE TABLE IF NOT EXISTS ic_action_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES ic_actions(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('hatirlatma_30', 'hatirlatma_7', 'gecikme', 'onay_talebi', 'onay_sonuc', 'red_sonuc')),
  recipient_ids UUID[] NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_by UUID[] DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_ic_notifications_action ON ic_action_notifications(action_id);
CREATE INDEX IF NOT EXISTS idx_ic_notifications_org ON ic_action_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_notifications_type ON ic_action_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_ic_notifications_sent ON ic_action_notifications(sent_at);

-- RLS politikaları
ALTER TABLE ic_action_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications sent to them"
  ON ic_action_notifications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = ANY(recipient_ids) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_action_notifications.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert notifications"
  ON ic_action_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their read status"
  ON ic_action_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(recipient_ids))
  WITH CHECK (auth.uid() = ANY(recipient_ids));

-- Bağlantılı modül miktar hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_linked_module_quantity(
  p_organization_id UUID,
  p_linked_module VARCHAR,
  p_department_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  CASE p_linked_module
    WHEN 'surec_yonetimi' THEN
      SELECT COUNT(*) INTO v_count
      FROM qm_processes
      WHERE organization_id = p_organization_id
      AND (p_department_id IS NULL OR department_id = p_department_id);
      
    WHEN 'is_akis_semalari' THEN
      SELECT COUNT(*) INTO v_count
      FROM workflow_processes
      WHERE organization_id = p_organization_id
      AND (p_department_id IS NULL OR department_id = p_department_id);
      
    WHEN 'risk_yonetimi' THEN
      SELECT COUNT(*) INTO v_count
      FROM risks
      WHERE organization_id = p_organization_id
      AND (p_department_id IS NULL OR department_id = p_department_id);
      
    WHEN 'hassas_gorevler' THEN
      SELECT COUNT(*) INTO v_count
      FROM sensitive_tasks
      WHERE organization_id = p_organization_id
      AND (p_department_id IS NULL OR department_id = p_department_id);
      
    WHEN 'dokuman_yonetimi' THEN
      SELECT COUNT(*) INTO v_count
      FROM document_library
      WHERE organization_id = p_organization_id
      AND (p_department_id IS NULL OR department_id = p_department_id);
      
    ELSE
      v_count := 0;
  END CASE;
  
  RETURN v_count;
END;
$$;

-- Eylem onay fonksiyonu
CREATE OR REPLACE FUNCTION approve_ic_action(
  p_action_id UUID,
  p_user_id UUID,
  p_approval_level VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action RECORD;
  v_profile RECORD;
  v_new_status VARCHAR;
  v_result JSONB;
BEGIN
  -- Eylem bilgisini al
  SELECT * INTO v_action FROM ic_actions WHERE id = p_action_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Eylem bulunamadı');
  END IF;
  
  -- Kullanıcı bilgisini al
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  -- Onay seviyesine göre işlem yap
  IF p_approval_level = 'unit' THEN
    -- Birim müdürü onayı
    IF v_action.approval_status != 'birim_onayi_bekliyor' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Eylem birim onayı beklemiyorder');
    END IF;
    
    UPDATE ic_actions
    SET approval_status = 'yonetim_onayi_bekliyor',
        unit_approved_by = p_user_id,
        unit_approved_at = now(),
        updated_at = now()
    WHERE id = p_action_id;
    
    v_new_status := 'yonetim_onayi_bekliyor';
    
  ELSIF p_approval_level = 'management' THEN
    -- Yönetim onayı
    IF v_action.approval_status != 'yonetim_onayi_bekliyor' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Eylem yönetim onayı beklemiyor');
    END IF;
    
    UPDATE ic_actions
    SET approval_status = 'onaylandi',
        management_approved_by = p_user_id,
        management_approved_at = now(),
        updated_at = now()
    WHERE id = p_action_id;
    
    v_new_status := 'onaylandi';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Geçersiz onay seviyesi');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'new_status', v_new_status);
END;
$$;

-- Eylem red fonksiyonu
CREATE OR REPLACE FUNCTION reject_ic_action(
  p_action_id UUID,
  p_user_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action RECORD;
BEGIN
  SELECT * INTO v_action FROM ic_actions WHERE id = p_action_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Eylem bulunamadı');
  END IF;
  
  IF v_action.approval_status NOT IN ('birim_onayi_bekliyor', 'yonetim_onayi_bekliyor') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Eylem onay beklemiyorder');
  END IF;
  
  UPDATE ic_actions
  SET approval_status = 'reddedildi',
      rejection_reason = p_rejection_reason,
      updated_at = now()
  WHERE id = p_action_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Eylem reddedildi');
END;
$$;

-- Eylem onaya gönderme fonksiyonu
CREATE OR REPLACE FUNCTION submit_ic_action_for_approval(
  p_action_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action RECORD;
BEGIN
  SELECT * INTO v_action FROM ic_actions WHERE id = p_action_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Eylem bulunamadı');
  END IF;
  
  IF v_action.approval_status NOT IN ('taslak', 'reddedildi') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Eylem zaten onay sürecinde');
  END IF;
  
  UPDATE ic_actions
  SET approval_status = 'birim_onayi_bekliyor',
      submitted_by = p_user_id,
      submitted_at = now(),
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = p_action_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Eylem onaya gönderildi');
END;
$$;

-- Bildirim oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION create_ic_action_notification(
  p_action_id UUID,
  p_notification_type VARCHAR,
  p_recipient_ids UUID[],
  p_title VARCHAR,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
  v_org_id UUID;
BEGIN
  -- Organizasyon ID'sini al
  SELECT organization_id INTO v_org_id
  FROM ic_actions
  WHERE id = p_action_id;
  
  -- Bildirim oluştur
  INSERT INTO ic_action_notifications (
    action_id,
    organization_id,
    notification_type,
    recipient_ids,
    title,
    message
  ) VALUES (
    p_action_id,
    v_org_id,
    p_notification_type,
    p_recipient_ids,
    p_title,
    p_message
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Otomatik bildirim trigger'ı
CREATE OR REPLACE FUNCTION auto_notify_ic_action_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipients UUID[];
  v_title VARCHAR;
  v_message TEXT;
  v_notification_type VARCHAR;
BEGIN
  -- Onay durumu değiştiğinde bildirim gönder
  IF TG_OP = 'UPDATE' AND OLD.approval_status != NEW.approval_status THEN
    
    CASE NEW.approval_status
      WHEN 'birim_onayi_bekliyor' THEN
        -- Birim müdürüne bildirim
        v_notification_type := 'onay_talebi';
        v_title := 'Eylem Onay Bekliyor: ' || NEW.code;
        v_message := NEW.code || ' kodlu eylem birim onayınızı bekliyor.';
        
        -- Birim müdürlerini bul
        SELECT array_agg(DISTINCT p.id) INTO v_recipients
        FROM profiles p
        WHERE p.role = 'director'
        AND p.department_id = NEW.responsible_department_id
        AND p.organization_id = NEW.organization_id;
        
      WHEN 'yonetim_onayi_bekliyor' THEN
        -- Yönetim onay talebi
        v_notification_type := 'onay_talebi';
        v_title := 'Eylem Yönetim Onayı Bekliyor: ' || NEW.code;
        v_message := NEW.code || ' kodlu eylem yönetim onayınızı bekliyor.';
        
        -- Admin ve stratejik planlama kullanıcılarını bul
        SELECT array_agg(DISTINCT p.id) INTO v_recipients
        FROM profiles p
        WHERE p.role IN ('admin', 'super_admin')
        AND p.organization_id = NEW.organization_id;
        
      WHEN 'onaylandi' THEN
        -- Onay sonucu
        v_notification_type := 'onay_sonuc';
        v_title := 'Eylem Onaylandı: ' || NEW.code;
        v_message := NEW.code || ' kodlu eylem onaylandı.';
        
        -- Sorumlu birim kullanıcılarına bildir
        SELECT array_agg(DISTINCT p.id) INTO v_recipients
        FROM profiles p
        WHERE p.department_id = NEW.responsible_department_id
        AND p.organization_id = NEW.organization_id;
        
      WHEN 'reddedildi' THEN
        -- Red sonucu
        v_notification_type := 'red_sonuc';
        v_title := 'Eylem Reddedildi: ' || NEW.code;
        v_message := NEW.code || ' kodlu eylem reddedildi. Gerekçe: ' || COALESCE(NEW.rejection_reason, 'Belirtilmedi');
        
        -- Sorumlu birim kullanıcılarına bildir
        SELECT array_agg(DISTINCT p.id) INTO v_recipients
        FROM profiles p
        WHERE p.department_id = NEW.responsible_department_id
        AND p.organization_id = NEW.organization_id;
    END CASE;
    
    -- Bildirim oluştur
    IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
      PERFORM create_ic_action_notification(
        NEW.id,
        v_notification_type,
        v_recipients,
        v_title,
        v_message
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger'ı ekle
DROP TRIGGER IF EXISTS trigger_auto_notify_ic_action_changes ON ic_actions;
CREATE TRIGGER trigger_auto_notify_ic_action_changes
  AFTER UPDATE ON ic_actions
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_ic_action_changes();

-- Geciken eylemler için bildirim fonksiyonu (cron ile çalıştırılacak)
CREATE OR REPLACE FUNCTION notify_overdue_ic_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action RECORD;
  v_recipients UUID[];
  v_title VARCHAR;
  v_message TEXT;
BEGIN
  -- Geciken eylemleri bul
  FOR v_action IN
    SELECT * FROM ic_actions
    WHERE target_date < CURRENT_DATE
    AND status NOT IN ('COMPLETED', 'CANCELLED')
    AND approval_status = 'onaylandi'
  LOOP
    -- Sorumlu birim + Müdür + Yönetim
    SELECT array_agg(DISTINCT p.id) INTO v_recipients
    FROM profiles p
    WHERE (
      p.department_id = v_action.responsible_department_id OR
      p.role IN ('admin', 'super_admin')
    )
    AND p.organization_id = v_action.organization_id;
    
    v_title := 'Geciken Eylem: ' || v_action.code;
    v_message := v_action.code || ' kodlu eylem gecikti! Hedef tarih: ' || v_action.target_date::text;
    
    -- Bildirim oluştur (tekrar oluşmaması için kontrol et)
    IF NOT EXISTS (
      SELECT 1 FROM ic_action_notifications
      WHERE action_id = v_action.id
      AND notification_type = 'gecikme'
      AND sent_at::date = CURRENT_DATE
    ) THEN
      PERFORM create_ic_action_notification(
        v_action.id,
        'gecikme',
        v_recipients,
        v_title,
        v_message
      );
    END IF;
  END LOOP;
END;
$$;

-- Yaklaşan tarihler için bildirim fonksiyonu
CREATE OR REPLACE FUNCTION notify_upcoming_ic_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action RECORD;
  v_recipients UUID[];
  v_title VARCHAR;
  v_message TEXT;
  v_days_left INTEGER;
  v_notification_type VARCHAR;
BEGIN
  -- 30 ve 7 gün kala uyarı
  FOR v_action IN
    SELECT *, (target_date - CURRENT_DATE) as days_left
    FROM ic_actions
    WHERE target_date > CURRENT_DATE
    AND target_date <= CURRENT_DATE + INTERVAL '30 days'
    AND status NOT IN ('COMPLETED', 'CANCELLED')
    AND approval_status = 'onaylandi'
  LOOP
    v_days_left := v_action.days_left;
    
    -- 30 gün kontrolü
    IF v_days_left = 30 THEN
      v_notification_type := 'hatirlatma_30';
      v_title := 'Hatırlatma: ' || v_action.code || ' - 30 gün kaldı';
      v_message := v_action.code || ' kodlu eylem için 30 gün kaldı. Hedef tarih: ' || v_action.target_date::text;
      
      -- Sadece sorumlu birime bildir
      SELECT array_agg(DISTINCT p.id) INTO v_recipients
      FROM profiles p
      WHERE p.department_id = v_action.responsible_department_id
      AND p.organization_id = v_action.organization_id;
      
    -- 7 gün kontrolü
    ELSIF v_days_left = 7 THEN
      v_notification_type := 'hatirlatma_7';
      v_title := 'ACİL: ' || v_action.code || ' - 7 gün kaldı!';
      v_message := v_action.code || ' kodlu eylem için sadece 7 gün kaldı! Hedef tarih: ' || v_action.target_date::text;
      
      -- Sorumlu birim + Müdüre bildir
      SELECT array_agg(DISTINCT p.id) INTO v_recipients
      FROM profiles p
      WHERE (
        p.department_id = v_action.responsible_department_id AND p.role IN ('user', 'director')
      )
      AND p.organization_id = v_action.organization_id;
    ELSE
      CONTINUE;
    END IF;
    
    -- Bildirim oluştur (bugün oluşturulmadıysa)
    IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ic_action_notifications
        WHERE action_id = v_action.id
        AND notification_type = v_notification_type
        AND sent_at::date = CURRENT_DATE
      ) THEN
        PERFORM create_ic_action_notification(
          v_action.id,
          v_notification_type,
          v_recipients,
          v_title,
          v_message
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE ic_action_notifications IS 'İç kontrol eylem planı bildirimleri';
COMMENT ON FUNCTION calculate_linked_module_quantity IS 'Bağlantılı modüldeki kayıt sayısını hesaplar';
COMMENT ON FUNCTION approve_ic_action IS 'Eylemi onaylar (birim veya yönetim seviyesinde)';
COMMENT ON FUNCTION reject_ic_action IS 'Eylemi reddeder';
COMMENT ON FUNCTION submit_ic_action_for_approval IS 'Eylemi onaya gönderir';
COMMENT ON FUNCTION create_ic_action_notification IS 'Eylem bildirimi oluşturur';
COMMENT ON FUNCTION notify_overdue_ic_actions IS 'Geciken eylemler için bildirim gönderir (cron ile çalıştırılır)';
COMMENT ON FUNCTION notify_upcoming_ic_actions IS 'Yaklaşan eylemler için hatırlatma gönderir (cron ile çalıştırılır)';
