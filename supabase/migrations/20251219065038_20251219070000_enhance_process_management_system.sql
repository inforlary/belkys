/*
  # Gelişmiş Süreç Yönetimi Sistemi

  1. Yeni Alanlar
    - `ic_processes` tablosuna yeni alanlar eklendi:
      - `inputs`: Süreç girdileri (doküman, veri, kaynak)
      - `outputs`: Süreç çıktıları (ürün, hizmet, doküman)
      - `performance_indicators`: Performans göstergeleri (KPI'lar)
      - `maturity_level`: Süreç olgunluk seviyesi (1-5)
      - `revision_number`: Revizyon numarası
      - `process_type`: Süreç tipi (main/support/management)
      - `flow_diagram`: Görsel akış şeması verisi (JSON)
      - `approved_by`: Onaylayan kişi
      - `approved_at`: Onay tarihi
      - `objectives`: Süreç hedefleri
      - `scope`: Süreç kapsamı

    - `ic_process_steps` tablosuna yeni alanlar:
      - `decision_points`: Karar noktaları
      - `risks`: Adım riskleri
      - `controls`: Adım kontrolleri
      - `is_automated`: Otomatik mi?
      - `system_used`: Kullanılan sistem
      - `dependencies`: Bağımlılıklar

  2. Yeni Tablolar
    - `ic_process_kpis`: Süreç performans göstergeleri
    - `ic_process_documents`: Süreç dokümanları (prosedür, talimat, form)
    - `ic_process_interactions`: Süreçler arası ilişkiler ve etkileşimler

  3. İndeksler
    - Performans için gerekli indeksler eklendi

  4. RLS Politikaları
    - Tüm tablolar için güvenlik politikaları yapılandırıldı
*/

-- ic_processes tablosuna yeni alanlar ekle
ALTER TABLE ic_processes
  ADD COLUMN IF NOT EXISTS inputs text,
  ADD COLUMN IF NOT EXISTS outputs text,
  ADD COLUMN IF NOT EXISTS performance_indicators text,
  ADD COLUMN IF NOT EXISTS maturity_level integer CHECK (maturity_level BETWEEN 1 AND 5) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS process_type text CHECK (process_type IN ('main', 'support', 'management')) DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS flow_diagram jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS objectives text,
  ADD COLUMN IF NOT EXISTS scope text;

-- ic_process_steps tablosuna yeni alanlar ekle
ALTER TABLE ic_process_steps
  ADD COLUMN IF NOT EXISTS decision_points text,
  ADD COLUMN IF NOT EXISTS risks text,
  ADD COLUMN IF NOT EXISTS controls text,
  ADD COLUMN IF NOT EXISTS is_automated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_used text,
  ADD COLUMN IF NOT EXISTS dependencies text;

-- SÜREÇ KPI'LARI
CREATE TABLE IF NOT EXISTS ic_process_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid NOT NULL REFERENCES ic_plans(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  kpi_description text,
  measurement_unit text,
  target_value numeric,
  current_value numeric,
  measurement_frequency text CHECK (measurement_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  responsible_user_id uuid REFERENCES profiles(id),
  last_measured_date date,
  status text CHECK (status IN ('on_track', 'at_risk', 'off_track')) DEFAULT 'on_track',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_process_kpis_org ON ic_process_kpis(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_kpis_plan ON ic_process_kpis(ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_kpis_process ON ic_process_kpis(process_id);

ALTER TABLE ic_process_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view process KPIs in their org" ON ic_process_kpis;
CREATE POLICY "Users can view process KPIs in their org"
  ON ic_process_kpis FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage process KPIs" ON ic_process_kpis;
CREATE POLICY "Users can manage process KPIs"
  ON ic_process_kpis FOR ALL
  TO authenticated
  USING (
    process_id IN (
      SELECT id FROM ic_processes
      WHERE department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      OR owner_user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- SÜREÇ DOKÜMANLARI
CREATE TABLE IF NOT EXISTS ic_process_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid NOT NULL REFERENCES ic_plans(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  document_type text CHECK (document_type IN ('procedure', 'instruction', 'form', 'checklist', 'flowchart', 'other')),
  document_name text NOT NULL,
  document_code text,
  description text,
  file_path text,
  version text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  valid_until date,
  status text CHECK (status IN ('draft', 'active', 'archived')) DEFAULT 'draft',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_process_docs_org ON ic_process_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_docs_plan ON ic_process_documents(ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_docs_process ON ic_process_documents(process_id);

ALTER TABLE ic_process_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view process documents in their org" ON ic_process_documents;
CREATE POLICY "Users can view process documents in their org"
  ON ic_process_documents FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage process documents" ON ic_process_documents;
CREATE POLICY "Users can manage process documents"
  ON ic_process_documents FOR ALL
  TO authenticated
  USING (
    process_id IN (
      SELECT id FROM ic_processes
      WHERE department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      OR owner_user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- SÜREÇ ETKİLEŞİMLERİ (Süreçler arası ilişkiler)
CREATE TABLE IF NOT EXISTS ic_process_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid NOT NULL REFERENCES ic_plans(id) ON DELETE CASCADE,
  source_process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  target_process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  interaction_type text CHECK (interaction_type IN ('input_output', 'sequence', 'dependency', 'collaboration')),
  description text,
  input_output_description text,
  frequency text,
  is_critical boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source_process_id, target_process_id, interaction_type)
);

CREATE INDEX IF NOT EXISTS idx_ic_process_interactions_org ON ic_process_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_interactions_plan ON ic_process_interactions(ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_interactions_source ON ic_process_interactions(source_process_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_interactions_target ON ic_process_interactions(target_process_id);

ALTER TABLE ic_process_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view process interactions in their org" ON ic_process_interactions;
CREATE POLICY "Users can view process interactions in their org"
  ON ic_process_interactions FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage process interactions" ON ic_process_interactions;
CREATE POLICY "Users can manage process interactions"
  ON ic_process_interactions FOR ALL
  TO authenticated
  USING (
    source_process_id IN (
      SELECT id FROM ic_processes
      WHERE department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      OR owner_user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );
