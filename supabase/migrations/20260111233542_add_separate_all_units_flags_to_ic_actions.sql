/*
  # Sorumlu ve İş Birliği İçin Ayrı "Tüm Birimler" Bayrakları Ekleme

  1. Değişiklikler
    - `all_units_responsible`: Sorumlu birim için "tüm birimler" bayrağı
    - `all_units_collaborating`: İş birliği yapılacak birimler için "tüm birimler" bayrağı
    - Mevcut `applies_to_all_units` kolonu korunur (geriye uyumluluk için)

  2. Notlar
    - Bu ayrım, sorumlu birimler ve iş birliği yapılacak birimler için ayrı ayrı "tüm birimler" seçeneği sunar
    - Mevcut veriler korunur
*/

-- Add new columns
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS all_units_responsible boolean DEFAULT false;
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS all_units_collaborating boolean DEFAULT false;

-- Migrate existing data: if applies_to_all_units is true, set both flags
UPDATE ic_actions 
SET 
  all_units_responsible = applies_to_all_units,
  all_units_collaborating = false
WHERE applies_to_all_units = true 
  AND all_units_responsible IS NULL;

-- Add comments
COMMENT ON COLUMN ic_actions.all_units_responsible IS 'Tüm birimler sorumlu mu?';
COMMENT ON COLUMN ic_actions.all_units_collaborating IS 'Tüm birimler iş birliği yapacak mı?';
