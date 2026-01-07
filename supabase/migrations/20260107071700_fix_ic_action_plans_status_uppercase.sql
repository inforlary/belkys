/*
  # İç Kontrol Eylem Planları Status Değerlerini Büyük Harfe Çevir
  
  1. Değişiklikler
    - Mevcut status değerlerini büyük harfe çevir
    - Status constraint'ini büyük harflerle güncelle
    
  2. Status Değerleri
    - draft -> DRAFT
    - active -> ACTIVE
    - completed -> COMPLETED
    - cancelled -> CANCELLED
*/

-- Önce constraint'i kaldır
ALTER TABLE ic_action_plans DROP CONSTRAINT IF EXISTS ic_action_plans_status_check;

-- Mevcut status değerlerini büyük harfe çevir
UPDATE ic_action_plans 
SET status = UPPER(status)
WHERE status IN ('draft', 'active', 'completed', 'cancelled');

-- Yeni constraint'i büyük harflerle ekle
ALTER TABLE ic_action_plans 
ADD CONSTRAINT ic_action_plans_status_check 
CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'));

-- Default değeri de güncelle
ALTER TABLE ic_action_plans 
ALTER COLUMN status SET DEFAULT 'DRAFT';
