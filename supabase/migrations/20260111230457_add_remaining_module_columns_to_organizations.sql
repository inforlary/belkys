/*
  # Eksik Modül Kolonlarını Organizations Tablosuna Ekle

  1. Yeni Kolonlar
    - module_risk_management: Risk Yönetimi modülü erişimi
    - module_quality_management: Kalite Yönetimi modülü erişimi
    - module_settings: Ayarlar modülü erişimi
    - module_administration: Yönetim modülü erişimi
    
  2. Varsayılan Değerler
    - Tüm yeni modüller için varsayılan değer: true (aktif)
    - Mevcut kuruluşlar için de true olarak ayarlanır
*/

-- Risk Yönetimi modülü ekle
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS module_risk_management boolean DEFAULT true NOT NULL;

-- Kalite Yönetimi modülü ekle
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS module_quality_management boolean DEFAULT true NOT NULL;

-- Ayarlar modülü ekle
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS module_settings boolean DEFAULT true NOT NULL;

-- Yönetim modülü ekle
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS module_administration boolean DEFAULT true NOT NULL;

-- Mevcut kuruluşlar için tüm yeni modülleri aktif yap
UPDATE organizations
SET 
  module_risk_management = true,
  module_quality_management = true,
  module_settings = true,
  module_administration = true
WHERE module_risk_management IS NULL 
   OR module_quality_management IS NULL
   OR module_settings IS NULL
   OR module_administration IS NULL;
