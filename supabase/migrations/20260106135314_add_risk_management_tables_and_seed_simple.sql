/*
  # Risk Yönetimi Eksik Tablolar ve Seed Data

  1. Yeni Tablolar
    - risk_strategy_documents
    - risk_impact_criteria
    - risk_likelihood_criteria
    - risk_treatment_updates
    - risk_workshops
    - risk_workshop_participants

  2. Unique Constraints
    - risk_categories için unique constraint

  3. Seed Data
    - Risk kategorileri
    - Olasılık kriterleri
    - Etki kriterleri
*/

-- Unique constraint ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'risk_categories_organization_id_code_key'
  ) THEN
    ALTER TABLE risk_categories ADD CONSTRAINT risk_categories_organization_id_code_key UNIQUE(organization_id, code);
  END IF;
END $$;

-- 1. Risk Strateji Belgesi
CREATE TABLE IF NOT EXISTS risk_strategy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  version VARCHAR(20) DEFAULT '1.0',
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  purpose TEXT,
  scope TEXT,
  principles TEXT,
  risk_appetite JSONB DEFAULT '{"strategic": "medium", "operational": "low", "financial": "low", "compliance": "very_low"}',
  risk_tolerance JSONB,
  risk_committee TEXT,
  roles_responsibilities TEXT,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED')),
  prepared_by_id UUID REFERENCES profiles(id),
  approved_by_id UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Etki Kriterleri
CREATE TABLE IF NOT EXISTS risk_impact_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  impact_area VARCHAR(20) NOT NULL CHECK (impact_area IN ('FINANCIAL', 'OPERATIONAL', 'REPUTATIONAL', 'LEGAL', 'STRATEGIC')),
  level INT NOT NULL CHECK (level BETWEEN 1 AND 5),
  level_name VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  quantitative_range VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, impact_area, level)
);

-- 3. Olasılık Kriterleri
CREATE TABLE IF NOT EXISTS risk_likelihood_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 5),
  level_name VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  frequency_range VARCHAR(100),
  probability_range VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, level)
);

-- 4. Faaliyet Güncelleme Kayıtları
CREATE TABLE IF NOT EXISTS risk_treatment_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id UUID REFERENCES risk_treatments(id) ON DELETE CASCADE,
  update_date TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID REFERENCES profiles(id),
  previous_progress INT,
  new_progress INT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  notes TEXT,
  challenges TEXT,
  next_steps TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Risk Çalıştayları
CREATE TABLE IF NOT EXISTS risk_workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  workshop_date DATE NOT NULL,
  location VARCHAR(200),
  scope TEXT,
  objectives TEXT,
  facilitator_id UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'COMPLETED', 'CANCELLED')),
  risks_identified INT DEFAULT 0,
  risks_reassessed INT DEFAULT 0,
  treatments_planned INT DEFAULT 0,
  agenda_url TEXT,
  presentation_url TEXT,
  report_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Çalıştay Katılımcıları
CREATE TABLE IF NOT EXISTS risk_workshop_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID REFERENCES risk_workshops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  role VARCHAR(50),
  attended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_risk_strategy_docs_org ON risk_strategy_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_strategy_docs_status ON risk_strategy_documents(status);
CREATE INDEX IF NOT EXISTS idx_risk_impact_criteria_org ON risk_impact_criteria(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_likelihood_criteria_org ON risk_likelihood_criteria(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_updates_treatment ON risk_treatment_updates(treatment_id);
CREATE INDEX IF NOT EXISTS idx_risk_workshops_org ON risk_workshops(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_workshop_participants_workshop ON risk_workshop_participants(workshop_id);

-- RLS
ALTER TABLE risk_strategy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_impact_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_likelihood_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_treatment_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_workshop_participants ENABLE ROW LEVEL SECURITY;

-- RLS Politikaları
CREATE POLICY "Users view strategy docs" ON risk_strategy_documents FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage strategy docs" ON risk_strategy_documents FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')));

CREATE POLICY "Users view impact criteria" ON risk_impact_criteria FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage impact criteria" ON risk_impact_criteria FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users view likelihood criteria" ON risk_likelihood_criteria FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage likelihood criteria" ON risk_likelihood_criteria FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users view treatment updates" ON risk_treatment_updates FOR SELECT TO authenticated
  USING (treatment_id IN (SELECT rt.id FROM risk_treatments rt JOIN risks r ON rt.risk_id = r.id WHERE r.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users insert treatment updates" ON risk_treatment_updates FOR INSERT TO authenticated
  WITH CHECK (treatment_id IN (SELECT rt.id FROM risk_treatments rt JOIN risks r ON rt.risk_id = r.id WHERE r.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users view workshops" ON risk_workshops FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage workshops" ON risk_workshops FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')));

CREATE POLICY "Users view participants" ON risk_workshop_participants FOR SELECT TO authenticated
  USING (workshop_id IN (SELECT id FROM risk_workshops WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Admins manage participants" ON risk_workshop_participants FOR ALL TO authenticated
  USING (workshop_id IN (SELECT id FROM risk_workshops WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))));
