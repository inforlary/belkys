/*
  # KİKS Eşleştirme Tablosu
  
  Süreç, Risk ve Kontrollerin KİKS standartlarıyla eşleştirilmesi
*/

-- SÜREÇ-KİKS EŞLEŞTİRMELERİ
CREATE TABLE IF NOT EXISTS ic_process_kiks_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES ic_processes(id) ON DELETE CASCADE,
  risk_id uuid REFERENCES ic_risks(id) ON DELETE CASCADE,
  control_id uuid REFERENCES ic_controls(id) ON DELETE CASCADE,
  kiks_standard_id uuid NOT NULL REFERENCES ic_kiks_standards(id) ON DELETE CASCADE,
  mapping_type text CHECK (mapping_type IN ('process', 'risk', 'control')) NOT NULL,
  compliance_level text CHECK (compliance_level IN ('not_compliant', 'partially_compliant', 'compliant', 'fully_compliant')) DEFAULT 'not_compliant',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_pk_mappings_org ON ic_process_kiks_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_pk_mappings_process ON ic_process_kiks_mappings(process_id);
CREATE INDEX IF NOT EXISTS idx_ic_pk_mappings_kiks ON ic_process_kiks_mappings(kiks_standard_id);

ALTER TABLE ic_process_kiks_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view KİKS mappings in their org" ON ic_process_kiks_mappings;
CREATE POLICY "Users can view KİKS mappings in their org"
  ON ic_process_kiks_mappings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage KİKS mappings" ON ic_process_kiks_mappings;
CREATE POLICY "Users can manage KİKS mappings"
  ON ic_process_kiks_mappings FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
