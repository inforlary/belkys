/*
  # İç Kontrol Eylem Planları Tablo Yapısını Güncelle

  1. Değişiklikler
    - Eski ic_action_plans tablosunu ic_action_plans_old olarak yeniden adlandır
    - Yeni yapıda ic_action_plans tablosu oluştur
    - Mevcut verileri yeni yapıya taşı
    
  2. Yeni Kolonlar
    - name (plan adı)
    - description (açıklama)
    - start_date (başlangıç tarihi)
    - end_date (bitiş tarihi)
    - status (durum: draft, active, completed, cancelled)
    
  3. Security
    - RLS politikalarını yeni tablo için yeniden oluştur
*/

-- Önce mevcut indeksleri kaldır
DROP INDEX IF EXISTS idx_ic_action_plans_org;
DROP INDEX IF EXISTS idx_ic_action_plans_status;

-- Eski tabloyu yedekle
ALTER TABLE IF EXISTS ic_action_plans RENAME TO ic_action_plans_old;

-- Yeni yapıda tabloyu oluştur
CREATE TABLE ic_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  description text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- İndeksleri oluştur
CREATE INDEX idx_ic_action_plans_org ON ic_action_plans(organization_id);
CREATE INDEX idx_ic_action_plans_status ON ic_action_plans(status);

-- RLS'i etkinleştir
ALTER TABLE ic_action_plans ENABLE ROW LEVEL SECURITY;

-- RLS Politikaları
CREATE POLICY "Users can view action plans in their organization"
  ON ic_action_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert action plans"
  ON ic_action_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = ic_action_plans.organization_id
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins can update action plans"
  ON ic_action_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = ic_action_plans.organization_id
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins can delete action plans"
  ON ic_action_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = ic_action_plans.organization_id
      AND role IN ('admin', 'director')
    )
  );

-- Eski verilerden basit plan bilgilerini taşı (varsa)
INSERT INTO ic_action_plans (
  id,
  organization_id,
  name,
  start_date,
  end_date,
  status,
  description,
  created_by,
  created_at,
  updated_at
)
SELECT 
  id,
  organization_id,
  COALESCE(plan_code, 'Plan ' || substring(id::text from 1 for 8)) as name,
  COALESCE(created_at::date, CURRENT_DATE) as start_date,
  COALESCE(completion_date, CURRENT_DATE + interval '1 year') as end_date,
  CASE 
    WHEN status = 'completed' THEN 'completed'
    WHEN status = 'cancelled' THEN 'cancelled'
    WHEN status = 'in_progress' THEN 'active'
    ELSE 'draft'
  END as status,
  COALESCE(notes, current_situation) as description,
  created_by,
  created_at,
  updated_at
FROM ic_action_plans_old
WHERE EXISTS (
  SELECT 1 FROM organizations WHERE id = ic_action_plans_old.organization_id
)
ON CONFLICT (id) DO NOTHING;