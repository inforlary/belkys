/*
  # Bütçe Dönemi is_current Constraint Düzeltmesi

  ## Sorun
  Mevcut `only_one_current_period` constraint'i yanlış yapılandırılmış.
  `(organization_id, is_current)` kombinasyonu tüm kayıtlar için unique olmalı değil,
  sadece `is_current = true` olan kayıtlar için unique olmalı.

  ## Çözüm
  1. Mevcut constraint'i kaldır
  2. Partial unique index ekle (sadece is_current = true için)
  
  ## Değişiklikler
    - `only_one_current_period` unique constraint kaldırıldı
    - `idx_budget_periods_unique_current` partial unique index eklendi
*/

-- Drop the problematic constraint
ALTER TABLE budget_periods 
DROP CONSTRAINT IF EXISTS only_one_current_period;

-- Create a partial unique index that only applies when is_current = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_periods_unique_current 
ON budget_periods(organization_id) 
WHERE is_current = true;
