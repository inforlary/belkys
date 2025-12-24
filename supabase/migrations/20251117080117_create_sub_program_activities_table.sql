/*
  # Alt Program Faaliyetleri Tablosu

  1. Yeni Tablo
    - `sub_program_activities`
      - Her alt programa ait faaliyetler (01, 02, 03 gibi)
      - Faaliyet kodu ve adı
      - Bu faaliyetler sonra program_activity_mappings'te kullanılır

  2. Güvenlik
    - RLS aktif
    - Kullanıcılar kendi organizasyonlarındaki kayıtları görebilir
    - Admin ve yöneticiler ekleyip düzenleyebilir

  3. İlişkiler
    - Sub_programs ile bağlantı
    - Organizations ile dolaylı bağlantı (sub_program üzerinden)
*/

CREATE TABLE IF NOT EXISTS sub_program_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_program_id uuid NOT NULL REFERENCES sub_programs(id) ON DELETE CASCADE,
  activity_code text NOT NULL,
  activity_name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Her alt program için faaliyet kodu benzersiz
  UNIQUE(sub_program_id, activity_code)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_sub_program_activities_sub_program ON sub_program_activities(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_sub_program_activities_active ON sub_program_activities(is_active);

-- Trigger
DROP TRIGGER IF EXISTS update_sub_program_activities_updated_at ON sub_program_activities;
CREATE TRIGGER update_sub_program_activities_updated_at
  BEFORE UPDATE ON sub_program_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE sub_program_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities in their organization"
  ON sub_program_activities FOR SELECT
  TO authenticated
  USING (
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert activities"
  ON sub_program_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  );

CREATE POLICY "Admins can update activities"
  ON sub_program_activities FOR UPDATE
  TO authenticated
  USING (
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  )
  WITH CHECK (
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  );

CREATE POLICY "Admins can delete activities"
  ON sub_program_activities FOR DELETE
  TO authenticated
  USING (
    sub_program_id IN (
      SELECT sp.id FROM sub_programs sp
      INNER JOIN programs p ON p.id = sp.program_id
      INNER JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'finance_manager')
    )
  );
