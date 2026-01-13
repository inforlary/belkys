/*
  # Create Role and Permission Management System (v2)

  1. New Tables
    - `roles` - Organization-specific roles
    - `permissions` - Global permissions
    - `role_permissions` - Junction table (recreated)
    - `user_roles` - User role assignments

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on their organization

  3. Initial Data
    - Insert default permissions for all modules
*/

-- Drop existing role_permissions table if it exists
DROP TABLE IF EXISTS role_permissions CASCADE;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, code)
);

-- Create role_permissions junction table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_organization ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert roles"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update roles"
  ON roles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete non-system roles"
  ON roles FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for permissions table
CREATE POLICY "All users can view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions table
CREATE POLICY "Users can view role permissions in their organization"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR role_id IN (
      SELECT id FROM roles 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- Insert default permissions
INSERT INTO permissions (module, code, name, description, category) VALUES
('strategic-plan', 'sp.view', 'Stratejik Plan Görüntüleme', 'Stratejik planları görüntüleme yetkisi', 'Okuma'),
('strategic-plan', 'sp.create', 'Stratejik Plan Oluşturma', 'Yeni stratejik plan oluşturma yetkisi', 'Yazma'),
('strategic-plan', 'sp.edit', 'Stratejik Plan Düzenleme', 'Mevcut stratejik planları düzenleme yetkisi', 'Yazma'),
('strategic-plan', 'sp.delete', 'Stratejik Plan Silme', 'Stratejik planları silme yetkisi', 'Silme'),
('strategic-plan', 'sp.approve', 'Stratejik Plan Onaylama', 'Stratejik planları onaylama yetkisi', 'Onay'),
('risk-management', 'risk.view', 'Risk Görüntüleme', 'Riskleri görüntüleme yetkisi', 'Okuma'),
('risk-management', 'risk.create', 'Risk Oluşturma', 'Yeni risk oluşturma yetkisi', 'Yazma'),
('risk-management', 'risk.edit', 'Risk Düzenleme', 'Mevcut riskleri düzenleme yetkisi', 'Yazma'),
('risk-management', 'risk.delete', 'Risk Silme', 'Riskleri silme yetkisi', 'Silme'),
('risk-management', 'risk.settings', 'Risk Ayarları Yönetimi', 'Risk ayarlarını yönetme yetkisi', 'Yönetim'),
('internal-control', 'ic.view', 'İç Kontrol Görüntüleme', 'İç kontrol kayıtlarını görüntüleme yetkisi', 'Okuma'),
('internal-control', 'ic.create', 'İç Kontrol Kaydı Oluşturma', 'Yeni iç kontrol kaydı oluşturma yetkisi', 'Yazma'),
('internal-control', 'ic.edit', 'İç Kontrol Düzenleme', 'Mevcut iç kontrol kayıtlarını düzenleme yetkisi', 'Yazma'),
('internal-control', 'ic.delete', 'İç Kontrol Silme', 'İç kontrol kayıtlarını silme yetkisi', 'Silme'),
('internal-control', 'ic.assess', 'Değerlendirme Yapma', 'İç kontrol değerlendirmesi yapma yetkisi', 'Değerlendirme'),
('quality-management', 'qm.view', 'Kalite Kayıtlarını Görüntüleme', 'Kalite kayıtlarını görüntüleme yetkisi', 'Okuma'),
('quality-management', 'qm.create', 'Kalite Kaydı Oluşturma', 'Yeni kalite kaydı oluşturma yetkisi', 'Yazma'),
('quality-management', 'qm.edit', 'Kalite Kaydı Düzenleme', 'Mevcut kalite kayıtlarını düzenleme yetkisi', 'Yazma'),
('quality-management', 'qm.delete', 'Kalite Kaydı Silme', 'Kalite kayıtlarını silme yetkisi', 'Silme'),
('quality-management', 'qm.audit', 'İç Tetkik Yapma', 'İç tetkik yapma yetkisi', 'Tetkik'),
('quality-management', 'qm.dof', 'DÖF Yönetimi', 'DÖF yönetimi yetkisi', 'DÖF'),
('admin', 'admin.users', 'Kullanıcı Yönetimi', 'Kullanıcıları yönetme yetkisi', 'Yönetim'),
('admin', 'admin.roles', 'Rol Yönetimi', 'Rolleri ve yetkileri yönetme yetkisi', 'Yönetim'),
('admin', 'admin.departments', 'Birim Yönetimi', 'Birimleri yönetme yetkisi', 'Yönetim'),
('admin', 'admin.settings', 'Sistem Ayarları', 'Sistem ayarlarını yönetme yetkisi', 'Yönetim'),
('admin', 'admin.logs', 'Log Görüntüleme', 'Sistem loglarını görüntüleme yetkisi', 'Yönetim'),
('budget', 'budget.view', 'Bütçe Görüntüleme', 'Bütçe kayıtlarını görüntüleme yetkisi', 'Okuma'),
('budget', 'budget.create', 'Bütçe Oluşturma', 'Yeni bütçe kaydı oluşturma yetkisi', 'Yazma'),
('budget', 'budget.edit', 'Bütçe Düzenleme', 'Mevcut bütçe kayıtlarını düzenleme yetkisi', 'Yazma'),
('budget', 'budget.delete', 'Bütçe Silme', 'Bütçe kayıtlarını silme yetkisi', 'Silme'),
('budget', 'budget.approve', 'Bütçe Onaylama', 'Bütçe kayıtlarını onaylama yetkisi', 'Onay'),
('indicators', 'indicator.view', 'Gösterge Görüntüleme', 'Göstergeleri görüntüleme yetkisi', 'Okuma'),
('indicators', 'indicator.create', 'Gösterge Oluşturma', 'Yeni gösterge oluşturma yetkisi', 'Yazma'),
('indicators', 'indicator.edit', 'Gösterge Düzenleme', 'Mevcut göstergeleri düzenleme yetkisi', 'Yazma'),
('indicators', 'indicator.delete', 'Gösterge Silme', 'Göstergeleri silme yetkisi', 'Silme'),
('indicators', 'indicator.data-entry', 'Veri Girişi', 'Gösterge verisi girme yetkisi', 'Veri Girişi'),
('indicators', 'indicator.data-approve', 'Veri Onaylama', 'Gösterge verisini onaylama yetkisi', 'Onay')
ON CONFLICT (module, code) DO NOTHING;
