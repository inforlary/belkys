/*
  # İç Kontrol Eylemlerine KİKS Alt Standart Bağlantısı Ekleme

  1. Yeni Kolonlar
    - `sub_standard_id` (uuid) - KİKS alt standardı (KOS 1.1, KOS 1.2 gibi) ile ilişkilendirme

  2. Değişiklikler
    - Mevcut standard_id kolonunu nullable yap (artık sub_standard_id kullanacağız)
    - sub_standard_id ile ic_kiks_sub_standards tablosuna foreign key ekle
    - Yeni eylemler için sub_standard_id zorunlu olabilir

  3. Not
    - Eski kayıtlar standard_id kullanmaya devam edecek
    - Yeni kayıtlar sub_standard_id kullanacak
*/

-- Make existing standard_id nullable
ALTER TABLE ic_actions ALTER COLUMN standard_id DROP NOT NULL;

-- Add sub_standard_id column
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS sub_standard_id uuid REFERENCES ic_kiks_sub_standards(id) ON DELETE RESTRICT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ic_actions_sub_standard ON ic_actions(sub_standard_id);

-- Add comment
COMMENT ON COLUMN ic_actions.sub_standard_id IS 'KİKS alt standardı (örn: KOS 1.1, KOS 2.3) - eylemler bu seviyeye bağlanır';
