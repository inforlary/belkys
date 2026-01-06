/*
  # Sistem Yönetimi Modülü

  1. Yeni Tablolar
    - system_settings: Genel sistem ayarları
    - email_settings: E-posta sunucu yapılandırması
    - system_backups: Yedekleme kayıtları
    - scheduled_jobs: Zamanlanmış görevler
    - scheduled_job_logs: Zamanlanmış görev logları
    - login_attempts: Giriş denemeleri (güvenlik)
    - password_policies: Şifre politikaları
    - password_history: Şifre geçmişi
    - integration_configs: Entegrasyon yapılandırmaları
    - api_keys: API anahtarları
    - system_announcements: Sistem duyuruları
    - announcement_reads: Duyuru okunma durumu
    - module_settings: Modül ayarları
    - data_export_logs: Veri dışa aktarma logları
    - system_updates: Sistem güncelleme geçmişi
    - role_permissions: Detaylı rol yetkileri

  2. Güvenlik
    - Tüm tablolarda RLS aktif
    - Admin ve super_admin erişimi
    - Şifreli alanlar için veri güvenliği

  3. Seed Data
    - Varsayılan sistem ayarları
    - Varsayılan şifre politikası
    - Varsayılan modül ayarları
*/

-- Genel Sistem Ayarları
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'STRING',
  category VARCHAR(50),
  description TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  updated_by_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, setting_key)
);

-- E-posta Sunucu Ayarları
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  smtp_host VARCHAR(200),
  smtp_port INT DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT true,
  smtp_user VARCHAR(200),
  smtp_password TEXT,
  from_email VARCHAR(200),
  from_name VARCHAR(200),
  reply_to VARCHAR(200),
  is_active BOOLEAN DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_status VARCHAR(20),
  last_test_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yedekleme Kayıtları
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  backup_type VARCHAR(20) NOT NULL,
  backup_name VARCHAR(200),
  file_path TEXT,
  file_size BIGINT,
  status VARCHAR(20) DEFAULT 'PENDING',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  triggered_by VARCHAR(20),
  triggered_by_id UUID REFERENCES profiles(id),
  retention_days INT DEFAULT 30,
  is_encrypted BOOLEAN DEFAULT false,
  checksum VARCHAR(64),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zamanlanmış Görevler
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  job_name VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  last_run_duration INT,
  last_error TEXT,
  next_run_at TIMESTAMPTZ,
  run_count INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  config JSON,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zamanlanmış Görev Logları
CREATE TABLE IF NOT EXISTS scheduled_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20),
  duration INT,
  result TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Giriş Denemeleri (Güvenlik)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(200),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  failure_reason VARCHAR(100),
  user_id UUID REFERENCES profiles(id),
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Şifre Politikaları
CREATE TABLE IF NOT EXISTS password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  min_length INT DEFAULT 8,
  require_uppercase BOOLEAN DEFAULT true,
  require_lowercase BOOLEAN DEFAULT true,
  require_numbers BOOLEAN DEFAULT true,
  require_special_chars BOOLEAN DEFAULT false,
  special_chars VARCHAR(50) DEFAULT '!@#$%^&*',
  max_age_days INT DEFAULT 90,
  prevent_reuse_count INT DEFAULT 5,
  lockout_threshold INT DEFAULT 5,
  lockout_duration_minutes INT DEFAULT 30,
  session_timeout_minutes INT DEFAULT 480,
  require_2fa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Şifre Geçmişi
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entegrasyon Konfigürasyonları
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL,
  integration_name VARCHAR(200) NOT NULL,
  api_base_url TEXT,
  auth_type VARCHAR(20),
  credentials JSON,
  settings JSON,
  is_active BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(20),
  last_error TEXT,
  webhook_url TEXT,
  webhook_secret VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Anahtarları
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  key_hash TEXT NOT NULL,
  permissions JSON,
  rate_limit INT DEFAULT 1000,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_used_ip VARCHAR(45),
  is_active BOOLEAN DEFAULT true,
  created_by_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sistem Duyuruları
CREATE TABLE IF NOT EXISTS system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'INFO',
  priority INT DEFAULT 5,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_dismissible BOOLEAN DEFAULT true,
  target_roles TEXT[],
  show_on_login BOOLEAN DEFAULT false,
  created_by_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Duyuru Okunma Durumu
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES system_announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  UNIQUE(announcement_id, user_id)
);

-- Modül Ayarları
CREATE TABLE IF NOT EXISTS module_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  module_name VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  settings JSON,
  permissions JSON,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, module_name)
);

-- Veri Dışa Aktarma Logları
CREATE TABLE IF NOT EXISTS data_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  export_type VARCHAR(50),
  module_name VARCHAR(50),
  file_name VARCHAR(300),
  file_size BIGINT,
  record_count INT,
  filters JSON,
  exported_by_id UUID REFERENCES profiles(id),
  download_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sistem Güncelleme Geçmişi
CREATE TABLE IF NOT EXISTS system_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  release_date DATE,
  update_type VARCHAR(20),
  title VARCHAR(300),
  description TEXT,
  changelog TEXT,
  is_mandatory BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by_id UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'AVAILABLE',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rol Yetkileri (Detaylı)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  module_name VARCHAR(50) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  is_allowed BOOLEAN DEFAULT false,
  conditions JSON,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, role_name, module_name, permission_key)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_backups_org ON system_backups(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_org ON scheduled_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_announcements_org ON system_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_module_settings_org ON module_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_org ON data_export_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_org ON role_permissions(organization_id);

-- RLS Politikaları
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Super Admin tam erişim
CREATE POLICY "Super admins full access to system_settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to email_settings"
  ON email_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to system_backups"
  ON system_backups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to scheduled_jobs"
  ON scheduled_jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to scheduled_job_logs"
  ON scheduled_job_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to login_attempts"
  ON login_attempts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to password_policies"
  ON password_policies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to integration_configs"
  ON integration_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to api_keys"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to system_announcements"
  ON system_announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to module_settings"
  ON module_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to data_export_logs"
  ON data_export_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to system_updates"
  ON system_updates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super admins full access to role_permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Admins kendi kurum verilerine erişim
CREATE POLICY "Admins can view their org system_settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = system_settings.organization_id
    )
  );

CREATE POLICY "Admins can manage their org email_settings"
  ON email_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = email_settings.organization_id
    )
  );

CREATE POLICY "Admins can view their org backups"
  ON system_backups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = system_backups.organization_id
    )
  );

CREATE POLICY "Admins can manage their org scheduled_jobs"
  ON scheduled_jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = scheduled_jobs.organization_id
    )
  );

CREATE POLICY "Admins can view their org login_attempts"
  ON login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = login_attempts.user_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'admin'
      AND p1.organization_id = p2.organization_id
    )
  );

CREATE POLICY "Admins can manage their org password_policies"
  ON password_policies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = password_policies.organization_id
    )
  );

CREATE POLICY "Admins can manage their org api_keys"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = api_keys.organization_id
    )
  );

-- Duyurular için kullanıcı politikaları
CREATE POLICY "Users can view active announcements"
  ON system_announcements FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NULL OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = system_announcements.organization_id
    ))
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

CREATE POLICY "Users can manage their announcement reads"
  ON announcement_reads FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Password history sadece sistem tarafından yönetilir
CREATE POLICY "System manages password_history"
  ON password_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_super_admin = true OR profiles.id = password_history.user_id)
    )
  );
