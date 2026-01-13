/*
  # Create Default Roles for Existing Organizations

  1. Actions
    - Insert default roles (ADMIN, DIRECTOR, USER, VIEWER) for all existing organizations
    - Skip if roles already exist for an organization

  2. Default Roles
    - ADMIN: Full access administrator
    - DIRECTOR: Department level manager
    - USER: Standard user with data entry and viewing
    - VIEWER: Read-only access
*/

-- Insert default roles for all existing organizations
INSERT INTO roles (organization_id, code, name, description, is_system, is_active)
SELECT 
  o.id as organization_id,
  'ADMIN' as code,
  'Yönetici' as name,
  'Kurum yöneticisi - Tüm modüllere tam erişim' as description,
  true as is_system,
  true as is_active
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM roles r 
  WHERE r.organization_id = o.id 
  AND r.code = 'ADMIN'
);

INSERT INTO roles (organization_id, code, name, description, is_system, is_active)
SELECT 
  o.id as organization_id,
  'DIRECTOR' as code,
  'Birim Müdürü' as name,
  'Birim düzeyinde yönetici' as description,
  true as is_system,
  true as is_active
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM roles r 
  WHERE r.organization_id = o.id 
  AND r.code = 'DIRECTOR'
);

INSERT INTO roles (organization_id, code, name, description, is_system, is_active)
SELECT 
  o.id as organization_id,
  'USER' as code,
  'Kullanıcı' as name,
  'Standart kullanıcı - Veri girişi ve görüntüleme' as description,
  true as is_system,
  true as is_active
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM roles r 
  WHERE r.organization_id = o.id 
  AND r.code = 'USER'
);

INSERT INTO roles (organization_id, code, name, description, is_system, is_active)
SELECT 
  o.id as organization_id,
  'VIEWER' as code,
  'İzleyici' as name,
  'Sadece görüntüleme yetkisi' as description,
  true as is_system,
  true as is_active
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM roles r 
  WHERE r.organization_id = o.id 
  AND r.code = 'VIEWER'
);

-- Create a trigger to automatically create default roles when a new organization is created
CREATE OR REPLACE FUNCTION create_default_roles_for_new_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO roles (organization_id, code, name, description, is_system, is_active) VALUES
  (NEW.id, 'ADMIN', 'Yönetici', 'Kurum yöneticisi - Tüm modüllere tam erişim', true, true),
  (NEW.id, 'DIRECTOR', 'Birim Müdürü', 'Birim düzeyinde yönetici', true, true),
  (NEW.id, 'USER', 'Kullanıcı', 'Standart kullanıcı - Veri girişi ve görüntüleme', true, true),
  (NEW.id, 'VIEWER', 'İzleyici', 'Sadece görüntüleme yetkisi', true, true);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_default_roles ON organizations;

CREATE TRIGGER trigger_create_default_roles
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_roles_for_new_org();
