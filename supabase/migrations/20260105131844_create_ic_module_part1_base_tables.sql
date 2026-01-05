/*
  # İç Kontrol Modülü - Part 1: Temel Tablolar

  1. Yeni Tablolar
    - `ic_components` - 5 ana iç kontrol bileşeni (Kontrol Ortamı, Risk Değerlendirme, vb.)
    - `ic_standards` - 18 iç kontrol standardı (KOS1-KOS18)
    - `ic_action_plans` - İç kontrol eylem planları
    - `ic_actions` - Eylem planı eylemleri
    - `ic_action_progress` - Eylem ilerleme kayıtları
    - `ic_action_documents` - Eylem belgeleri ve kanıtlar

  2. Security
    - RLS tüm tablolarda aktif
    - Organization bazlı erişim kontrolü
    - Role bazlı yetkilendirme (admin, director, user)

  3. İş Kuralları
    - Eylem ilerleme otomatik durum güncelleme
    - Gecikme kontrolü ve bildirimleri
    - Belge yönetimi
*/

-- İç Kontrol Bileşenleri (5 ana bileşen)
CREATE TABLE IF NOT EXISTS ic_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  order_index int NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- İç Kontrol Standartları (18 standart)
CREATE TABLE IF NOT EXISTS ic_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES ic_components(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  general_conditions text,
  order_index int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_standards_component ON ic_standards(component_id);

-- İç Kontrol Eylem Planları
CREATE TABLE IF NOT EXISTS ic_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  description text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_action_plans_org ON ic_action_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_status ON ic_action_plans(status);

-- İç Kontrol Eylemleri
CREATE TABLE IF NOT EXISTS ic_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES ic_action_plans(id) ON DELETE CASCADE,
  standard_id uuid NOT NULL REFERENCES ic_standards(id) ON DELETE RESTRICT,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  responsible_unit_id uuid NOT NULL REFERENCES departments(id),
  related_unit_ids uuid[] DEFAULT ARRAY[]::uuid[],
  start_date date NOT NULL,
  target_date date NOT NULL,
  completed_date date,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'delayed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  resources text,
  outputs text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(action_plan_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_actions_plan ON ic_actions(action_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_actions_standard ON ic_actions(standard_id);
CREATE INDEX IF NOT EXISTS idx_ic_actions_responsible_unit ON ic_actions(responsible_unit_id);
CREATE INDEX IF NOT EXISTS idx_ic_actions_status ON ic_actions(status);
CREATE INDEX IF NOT EXISTS idx_ic_actions_target_date ON ic_actions(target_date);

-- İç Kontrol Eylem İlerleme Kayıtları
CREATE TABLE IF NOT EXISTS ic_action_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES ic_actions(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  reported_by uuid NOT NULL REFERENCES profiles(id),
  progress_percent int NOT NULL CHECK (progress_percent >= 0 AND progress_percent <= 100),
  description text NOT NULL,
  challenges text,
  next_steps text,
  status text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'delayed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_action_progress_action ON ic_action_progress(action_id);
CREATE INDEX IF NOT EXISTS idx_ic_action_progress_date ON ic_action_progress(report_date DESC);

-- İç Kontrol Eylem Belgeleri
CREATE TABLE IF NOT EXISTS ic_action_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES ic_actions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_action_documents_action ON ic_action_documents(action_id);

-- Otomatik durum güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_ic_action_status()
RETURNS TRIGGER AS $$
DECLARE
  latest_progress int;
  action_target_date date;
BEGIN
  -- En son ilerleme yüzdesini al
  SELECT progress_percent INTO latest_progress
  FROM ic_action_progress
  WHERE action_id = NEW.action_id
  ORDER BY report_date DESC, created_at DESC
  LIMIT 1;

  -- Eylem hedef tarihini al
  SELECT target_date INTO action_target_date
  FROM ic_actions
  WHERE id = NEW.action_id;

  -- Durumu güncelle
  IF latest_progress = 100 THEN
    UPDATE ic_actions
    SET status = 'completed',
        completed_date = NEW.report_date,
        updated_at = now()
    WHERE id = NEW.action_id;
  ELSIF latest_progress > 0 AND latest_progress < 100 THEN
    IF action_target_date < CURRENT_DATE THEN
      UPDATE ic_actions
      SET status = 'delayed',
          updated_at = now()
      WHERE id = NEW.action_id;
    ELSE
      UPDATE ic_actions
      SET status = 'in_progress',
          updated_at = now()
      WHERE id = NEW.action_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: İlerleme kaydedildiğinde durumu güncelle
DROP TRIGGER IF EXISTS trigger_update_ic_action_status ON ic_action_progress;
CREATE TRIGGER trigger_update_ic_action_status
  AFTER INSERT ON ic_action_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_action_status();

-- Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_ic_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ic_action_plans_updated_at ON ic_action_plans;
CREATE TRIGGER trigger_ic_action_plans_updated_at
  BEFORE UPDATE ON ic_action_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

DROP TRIGGER IF EXISTS trigger_ic_actions_updated_at ON ic_actions;
CREATE TRIGGER trigger_ic_actions_updated_at
  BEFORE UPDATE ON ic_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

-- RLS Policies

-- ic_components (global data, read-only for all)
ALTER TABLE ic_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view IC components"
  ON ic_components FOR SELECT
  TO authenticated
  USING (true);

-- ic_standards (global data, read-only for all)
ALTER TABLE ic_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view IC standards"
  ON ic_standards FOR SELECT
  TO authenticated
  USING (true);

-- ic_action_plans
ALTER TABLE ic_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC action plans in their organization"
  ON ic_action_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can insert IC action plans"
  ON ic_action_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update IC action plans"
  ON ic_action_plans FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete IC action plans"
  ON ic_action_plans FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ic_actions
ALTER TABLE ic_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC actions in their organization"
  ON ic_actions FOR SELECT
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins and directors can insert IC actions"
  ON ic_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    action_plan_id IN (
      SELECT id FROM ic_action_plans WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins and directors can update IC actions"
  ON ic_actions FOR UPDATE
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can delete IC actions"
  ON ic_actions FOR DELETE
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- ic_action_progress
ALTER TABLE ic_action_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC action progress in their organization"
  ON ic_action_progress FOR SELECT
  TO authenticated
  USING (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert IC action progress for their actions"
  ON ic_action_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      JOIN profiles p ON p.organization_id = iap.organization_id
      WHERE p.id = auth.uid()
      AND (
        ia.responsible_unit_id = p.department_id
        OR p.role IN ('admin', 'director', 'super_admin')
      )
    )
  );

-- ic_action_documents
ALTER TABLE ic_action_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC action documents in their organization"
  ON ic_action_documents FOR SELECT
  TO authenticated
  USING (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert IC action documents for their actions"
  ON ic_action_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      JOIN profiles p ON p.organization_id = iap.organization_id
      WHERE p.id = auth.uid()
      AND (
        ia.responsible_unit_id = p.department_id
        OR p.role IN ('admin', 'director', 'super_admin')
      )
    )
  );

CREATE POLICY "Users can delete their own IC action documents"
  ON ic_action_documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
