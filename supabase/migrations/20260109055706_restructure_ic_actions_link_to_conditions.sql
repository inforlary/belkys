/*
  # İç Kontrol Eylemlerini Genel Şartlara Bağlama ve Veri Temizleme

  1. Değişiklikler
    - ic_actions tablosuna general_condition_id eklenir
    - ic_actions tablosundan standard_id kaldırılır
    - Eylemler artık doğrudan genel şartlara bağlanır

  2. Veri Temizleme
    - Tüm ic_actions kayıtları silinir
    - Tüm ic_general_conditions kayıtları silinir
    - Tüm ic_standards kayıtları silinir
    - Tüm ic_components kayıtları silinir
    - Tüm ic_action_plans kayıtları silinir
    - Temiz bir başlangıç için tüm veriler sıfırdan oluşturulacak

  3. Kod Numaralandırma
    - Genel şartlara kod numarası eklenir (örn: KOS 1.1, KOS 1.2)

  4. Security
    - Mevcut RLS politikaları korunur
*/

-- ic_general_conditions tablosuna code eklenir
ALTER TABLE ic_general_conditions
ADD COLUMN IF NOT EXISTS code text;

CREATE INDEX IF NOT EXISTS idx_ic_general_conditions_code ON ic_general_conditions(code);

-- Tüm IC verilerini temizle
DELETE FROM ic_action_progress;
DELETE FROM ic_action_documents;
DELETE FROM ic_actions;
DELETE FROM ic_action_plans;
DELETE FROM ic_general_conditions;
DELETE FROM ic_standards;
DELETE FROM ic_components;

-- ic_actions tablosundan standard_id'yi kaldır ve general_condition_id ekle
ALTER TABLE ic_actions
DROP CONSTRAINT IF EXISTS ic_actions_standard_id_fkey;

ALTER TABLE ic_actions
DROP COLUMN IF EXISTS standard_id;

ALTER TABLE ic_actions
ADD COLUMN IF NOT EXISTS general_condition_id uuid REFERENCES ic_general_conditions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ic_actions_general_condition ON ic_actions(general_condition_id);

-- Index'leri güncelle
DROP INDEX IF EXISTS idx_ic_actions_standard;