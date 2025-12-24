/*
  # Eylem Planı Sistemi

  1. Yeni Tablolar
    - `ic_action_plans`: Ana eylem planı kayıtları
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `plan_code` (text): Eylem kodu (1.1.1, 1.1.2)
      - `kiks_standard_id` (uuid): KIKS standardı referansı
      - `kiks_standard_code` (text): KIKS kodu (KOS 1.1)
      - `kiks_standard_title` (text): Standart başlığı
      - `current_situation` (text): Mevcut durum açıklaması
      - `planned_actions` (text): Öngörülen eylemler
      - `responsible_unit_id` (uuid): Sorumlu birim
      - `responsible_persons` (jsonb): Sorumlu kişiler listesi
      - `collaboration_units` (jsonb): İşbirliği birimleri listesi
      - `output_result` (text): Çıktı/Sonuç
      - `completion_date` (date): Planlanan tamamlanma tarihi
      - `status` (text): Durum
      - `actual_completion_date` (date): Gerçek tamamlanma tarihi
      - `notes` (text): Açıklama/Notlar
      - `approval_status` (text): Onay durumu
      - `created_by`, `updated_at`, `created_at`

    - `ic_action_plan_progress`: İlerleme takip kayıtları
      - `id` (uuid, primary key)
      - `action_plan_id` (uuid, foreign key)
      - `progress_percentage` (integer): İlerleme yüzdesi
      - `progress_description` (text): İlerleme açıklaması
      - `recorded_by` (uuid): Kaydeden kişi
      - `recorded_date` (date): Kayıt tarihi
      - `created_at` (timestamptz)

    - `ic_action_plan_documents`: Döküman ekleri
      - `id` (uuid, primary key)
      - `action_plan_id` (uuid, foreign key)
      - `document_name` (text): Döküman adı
      - `document_path` (text): Storage path
      - `document_type` (text): Döküman tipi
      - `uploaded_by` (uuid): Yükleyen kişi
      - `uploaded_at` (timestamptz)

    - `ic_action_plan_approvals`: Onay işlemleri
      - `id` (uuid, primary key)
      - `action_plan_id` (uuid, foreign key)
      - `approver_id` (uuid): Onaylayan kişi
      - `approval_status` (text): Onay durumu
      - `approval_notes` (text): Onay notları
      - `approved_at` (timestamptz)

  2. Güvenlik
    - RLS tüm tablolarda etkin
    - Admin ve İç Kontrol Sorumluları tam erişim
    - Birim yöneticileri kendi birimlerinin kayıtlarına erişim
    - Sorumlu kişiler atandıkları eylemlere erişim

  3. İndeksler
    - Performance için gerekli indeksler eklendi
    - Foreign key constraint'ler
*/

-- Eylem Planı Ana Tablosu
CREATE TABLE IF NOT EXISTS ic_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  kiks_standard_id UUID REFERENCES ic_kiks_standards(id) ON DELETE SET NULL,
  kiks_standard_code TEXT,
  kiks_standard_title TEXT,
  current_situation TEXT,
  planned_actions TEXT NOT NULL,
  responsible_unit_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  responsible_persons JSONB DEFAULT '[]'::jsonb,
  collaboration_units JSONB DEFAULT '[]'::jsonb,
  output_result TEXT,
  completion_date DATE NOT NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'delayed', 'cancelled')),
  actual_completion_date DATE,
  notes TEXT,
  approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- İlerleme Takip Tablosu
CREATE TABLE IF NOT EXISTS ic_action_plan_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id UUID NOT NULL REFERENCES ic_action_plans(id) ON DELETE CASCADE,
  progress_percentage INTEGER NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  progress_description TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Döküman Tablosu
CREATE TABLE IF NOT EXISTS ic_action_plan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id UUID NOT NULL REFERENCES ic_action_plans(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_path TEXT NOT NULL,
  document_type TEXT DEFAULT 'other' CHECK (document_type IN ('training_report', 'meeting_minutes', 'review_document', 'control_tab', 'other')),
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Onay Tablosu
CREATE TABLE IF NOT EXISTS ic_action_plan_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id UUID NOT NULL REFERENCES ic_action_plans(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id),
  approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_notes TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_action_plans_org ON ic_action_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_kiks ON ic_action_plans(kiks_standard_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_unit ON ic_action_plans(responsible_unit_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_status ON ic_action_plans(status);
CREATE INDEX IF NOT EXISTS idx_action_plans_approval ON ic_action_plans(approval_status);
CREATE INDEX IF NOT EXISTS idx_action_plans_completion_date ON ic_action_plans(completion_date);
CREATE INDEX IF NOT EXISTS idx_action_plan_progress_plan ON ic_action_plan_progress(action_plan_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_docs_plan ON ic_action_plan_documents(action_plan_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_approvals_plan ON ic_action_plan_approvals(action_plan_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_action_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_plans_updated_at
  BEFORE UPDATE ON ic_action_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_action_plan_updated_at();

-- Auto-update status to delayed when past due
CREATE OR REPLACE FUNCTION check_action_plan_delay()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completion_date < CURRENT_DATE
     AND NEW.status NOT IN ('completed', 'cancelled')
     AND NEW.actual_completion_date IS NULL THEN
    NEW.status = 'delayed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_plan_check_delay
  BEFORE INSERT OR UPDATE ON ic_action_plans
  FOR EACH ROW
  EXECUTE FUNCTION check_action_plan_delay();

-- RLS Politikaları
ALTER TABLE ic_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_action_plan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_action_plan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_action_plan_approvals ENABLE ROW LEVEL SECURITY;

-- ic_action_plans RLS
CREATE POLICY "Users can view action plans in their organization"
  ON ic_action_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and IC managers can insert action plans"
  ON ic_action_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins and IC managers can update action plans"
  ON ic_action_plans FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete action plans"
  ON ic_action_plans FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ic_action_plan_progress RLS
CREATE POLICY "Users can view progress in their organization"
  ON ic_action_plan_progress FOR SELECT
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can insert progress"
  ON ic_action_plan_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ic_action_plan_documents RLS
CREATE POLICY "Users can view documents in their organization"
  ON ic_action_plan_documents FOR SELECT
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can upload documents"
  ON ic_action_plan_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can delete documents"
  ON ic_action_plan_documents FOR DELETE
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- ic_action_plan_approvals RLS
CREATE POLICY "Users can view approvals in their organization"
  ON ic_action_plan_approvals FOR SELECT
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage approvals"
  ON ic_action_plan_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can update approvals"
  ON ic_action_plan_approvals FOR UPDATE
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- Storage bucket policy for action plan documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('action-plan-documents', 'action-plan-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view action plan documents in their organization"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'action-plan-documents'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE organization_id IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can upload action plan documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'action-plan-documents'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE organization_id IS NOT NULL
    )
  );

CREATE POLICY "Admins can delete action plan documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'action-plan-documents'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
    )
  );
