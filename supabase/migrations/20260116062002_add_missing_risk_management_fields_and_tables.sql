/*
  # Add Missing Risk Management Fields and Tables

  ## Changes
  1. Add missing fields to risks table
    - external_authority_name (for control level management)
    - external_contact_info (for external coordination)
    - target_likelihood (for target risk assessment)
  
  2. Create risk_department_impacts table
    - For tracking departmental impact analysis (especially for corporate risks)
  
  3. Create risk_relations table
    - For tracking relationships between risks
*/

-- Add missing fields to risks table
ALTER TABLE risks
ADD COLUMN IF NOT EXISTS external_authority_name TEXT,
ADD COLUMN IF NOT EXISTS external_contact_info TEXT,
ADD COLUMN IF NOT EXISTS target_likelihood INTEGER CHECK (target_likelihood BETWEEN 1 AND 5);

COMMENT ON COLUMN risks.external_authority_name IS 'Yetkili dış kurum adı (Kısmen Kontrol Edilebilir veya Kontrol Dışı riskler için)';
COMMENT ON COLUMN risks.external_contact_info IS 'Dış kurum iletişim bilgisi';
COMMENT ON COLUMN risks.target_likelihood IS 'Hedef risk olasılığı (1-5)';

-- Create risk_department_impacts table
CREATE TABLE IF NOT EXISTS risk_department_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  impact_level INTEGER NOT NULL CHECK (impact_level BETWEEN 0 AND 5),
  impact_description TEXT,
  specific_measures TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(risk_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_department_impacts_risk ON risk_department_impacts(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_department_impacts_department ON risk_department_impacts(department_id);

COMMENT ON TABLE risk_department_impacts IS 'Birim bazında risk etki analizi';
COMMENT ON COLUMN risk_department_impacts.impact_level IS 'Etki seviyesi: 0=Etkilenmez, 1=Minimal, 2=Düşük, 3=Orta, 4=Yüksek, 5=Kritik';

-- Create risk_relations table
CREATE TABLE IF NOT EXISTS risk_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  related_risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('TRIGGERS', 'TRIGGERED_BY', 'INCREASES', 'DECREASES', 'RELATED')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_risk_id, related_risk_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_risk_relations_source ON risk_relations(source_risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_relations_related ON risk_relations(related_risk_id);

COMMENT ON TABLE risk_relations IS 'Riskler arası ilişkiler';
COMMENT ON COLUMN risk_relations.relation_type IS 'İlişki türü: TRIGGERS (tetikler), TRIGGERED_BY (tetiklenir), INCREASES (artırır), DECREASES (azaltır), RELATED (ilişkili)';

-- Enable RLS
ALTER TABLE risk_department_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk_department_impacts
CREATE POLICY "Users can view department impacts in their organization"
  ON risk_department_impacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_department_impacts.risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert department impacts for their organization"
  ON risk_department_impacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_department_impacts.risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update department impacts in their organization"
  ON risk_department_impacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_department_impacts.risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete department impacts in their organization"
  ON risk_department_impacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_department_impacts.risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- RLS Policies for risk_relations
CREATE POLICY "Users can view risk relations in their organization"
  ON risk_relations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_relations.source_risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert risk relations for their organization"
  ON risk_relations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_relations.source_risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update risk relations in their organization"
  ON risk_relations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_relations.source_risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete risk relations in their organization"
  ON risk_relations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_relations.source_risk_id
      AND r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );
