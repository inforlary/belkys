/*
  # Belediyeler için Modül Erişim Yönetimi
  
  1. Değişiklikler
    - organizations tablosuna modül aktiflik alanları eklenir
    - 4 modül: Stratejik Plan, Faaliyet Raporu, Bütçe ve Performans, İç Kontrol
    - Varsayılan olarak tüm modüller aktif
    
  2. Modüller
    - module_strategic_planning: Stratejik Plan modülü
    - module_activity_reports: Faaliyet Raporu modülü
    - module_budget_performance: Bütçe ve Performans modülü
    - module_internal_control: İç Kontrol modülü
*/

-- Add module access columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS module_strategic_planning BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS module_activity_reports BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS module_budget_performance BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS module_internal_control BOOLEAN DEFAULT true;

-- Update existing organizations to have all modules enabled
UPDATE organizations
SET 
  module_strategic_planning = true,
  module_activity_reports = true,
  module_budget_performance = true,
  module_internal_control = true
WHERE 
  module_strategic_planning IS NULL 
  OR module_activity_reports IS NULL 
  OR module_budget_performance IS NULL 
  OR module_internal_control IS NULL;

-- Add comment to document the columns
COMMENT ON COLUMN organizations.module_strategic_planning IS 'Stratejik Plan modülü erişim izni';
COMMENT ON COLUMN organizations.module_activity_reports IS 'Faaliyet Raporu modülü erişim izni';
COMMENT ON COLUMN organizations.module_budget_performance IS 'Bütçe ve Performans modülü erişim izni';
COMMENT ON COLUMN organizations.module_internal_control IS 'İç Kontrol modülü erişim izni';
