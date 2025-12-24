/*
  # Belediye Bazlı KİKS Alt Standart Durumları Tablosu

  ## Değişiklikler
  
  1. Yeni Tablo: `ic_kiks_sub_standard_statuses`
    - Her belediyenin her alt standart için kendi mevcut durum açıklaması
    - Belediye bazlı "makul güvence sağlıyor mu?" bilgisi
    - organization_id ve sub_standard_id kombinasyonu unique
    
  2. Alanlar:
    - `sub_standard_id` (FK to ic_kiks_sub_standards)
    - `organization_id` (FK to organizations)
    - `current_status` (text) - Belediyenin mevcut durum açıklaması
    - `provides_reasonable_assurance` (boolean) - Makul güvence sağlıyor mu?
    
  3. RLS Politikaları:
    - Kullanıcılar kendi organizasyonlarının kayıtlarını görür
    - Admin ve VP'ler kendi organizasyonlarının kayıtlarını yönetebilir
    
  4. Güvenlik:
    - Her belediye sadece kendi kayıtlarını görebilir ve düzenleyebilir
    - Super admin tüm kayıtları görebilir
*/

-- Belediye bazlı alt standart durumları tablosu
CREATE TABLE IF NOT EXISTS ic_kiks_sub_standard_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_standard_id uuid NOT NULL REFERENCES ic_kiks_sub_standards(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_status text,
  provides_reasonable_assurance boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sub_standard_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_kiks_sub_standard_statuses_sub ON ic_kiks_sub_standard_statuses(sub_standard_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_sub_standard_statuses_org ON ic_kiks_sub_standard_statuses(organization_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_ic_kiks_sub_standard_statuses_updated_at ON ic_kiks_sub_standard_statuses;
CREATE TRIGGER update_ic_kiks_sub_standard_statuses_updated_at
  BEFORE UPDATE ON ic_kiks_sub_standard_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Politikaları
ALTER TABLE ic_kiks_sub_standard_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sub standard statuses in their org"
  ON ic_kiks_sub_standard_statuses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert sub standard statuses"
  ON ic_kiks_sub_standard_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Admins can update sub standard statuses"
  ON ic_kiks_sub_standard_statuses FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Admins can delete sub standard statuses"
  ON ic_kiks_sub_standard_statuses FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- Super admin politikaları
CREATE POLICY "Super admins can view all sub standard statuses"
  ON ic_kiks_sub_standard_statuses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ic_kiks_sub_standards tablosundan current_status ve provides_reasonable_assurance alanlarını kaldır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_sub_standards' AND column_name = 'provides_reasonable_assurance'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards DROP COLUMN provides_reasonable_assurance;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_kiks_sub_standards' AND column_name = 'current_status'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards DROP COLUMN current_status;
  END IF;
END $$;