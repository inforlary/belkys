/*
  # Super Admin Şifre Saklama Tablosu

  1. Yeni Tablo
    - `super_admin_credentials`
      - Super admin'lerin belediye yöneticilerinin şifrelerini görebilmesi için
      - Sadece super admin'ler erişebilir
      - Organization ve user bazlı şifre saklama

  2. Güvenlik
    - RLS aktif
    - Sadece super admin'ler okuyabilir
    - Sistem otomatik yazabilir
*/

CREATE TABLE IF NOT EXISTS super_admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_super_admin_credentials_org ON super_admin_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_credentials_user ON super_admin_credentials(user_id);

-- RLS
ALTER TABLE super_admin_credentials ENABLE ROW LEVEL SECURITY;

-- Sadece super admin'ler okuyabilir
CREATE POLICY "Super admins can view all credentials"
  ON super_admin_credentials FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_super_admin = true
    )
  );

-- Sistem/Super admin yazabilir
CREATE POLICY "Super admins can insert credentials"
  ON super_admin_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_super_admin = true
    )
  );

-- Sistem/Super admin güncelleyebilir
CREATE POLICY "Super admins can update credentials"
  ON super_admin_credentials FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_super_admin = true
    )
  );