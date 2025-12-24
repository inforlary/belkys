/*
  # Belediye Silme için Cascade Delete Düzeltmesi
  
  1. Değişiklikler
    - profiles tablosundaki organization_id foreign key'ini CASCADE olarak güncelle
    - Belediye silindiğinde tüm profiller otomatik olarak silinsin
    
  2. Güvenlik
    - Mevcut RLS politikaları korunur
    - Super admin'ler belediye silebilir
*/

-- Drop existing foreign key constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;

-- Add new foreign key constraint with CASCADE delete
ALTER TABLE profiles
ADD CONSTRAINT profiles_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

-- Also update other tables that reference organizations
ALTER TABLE departments 
DROP CONSTRAINT IF EXISTS departments_organization_id_fkey;

ALTER TABLE departments
ADD CONSTRAINT departments_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

ALTER TABLE strategic_plans 
DROP CONSTRAINT IF EXISTS strategic_plans_organization_id_fkey;

ALTER TABLE strategic_plans
ADD CONSTRAINT strategic_plans_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

ALTER TABLE objectives 
DROP CONSTRAINT IF EXISTS objectives_organization_id_fkey;

ALTER TABLE objectives
ADD CONSTRAINT objectives_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

ALTER TABLE goals 
DROP CONSTRAINT IF EXISTS goals_organization_id_fkey;

ALTER TABLE goals
ADD CONSTRAINT goals_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

ALTER TABLE indicators 
DROP CONSTRAINT IF EXISTS indicators_organization_id_fkey;

ALTER TABLE indicators
ADD CONSTRAINT indicators_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;
