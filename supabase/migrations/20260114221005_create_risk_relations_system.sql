/*
  # Risk İlişkileri Sistemi

  1. Yeni Tablo
    - `rm_risk_relations` - Riskler arası ilişkileri saklar
      - `id` (UUID, primary key)
      - `organization_id` (UUID, foreign key)
      - `source_risk_id` (UUID, foreign key -> risks)
      - `target_risk_id` (UUID, foreign key -> risks)
      - `relation_type` (TEXT) - İlişki türü
      - `description` (TEXT, nullable) - Açıklama
      - `created_at` (TIMESTAMPTZ)
      - `created_by` (UUID, foreign key -> profiles)

  2. İlişki Türleri
    - TRIGGERS - Bu risk hedef riski tetikler
    - TRIGGERED_BY - Bu risk hedef risk tarafından tetiklenir
    - INCREASES - Bu risk hedef riski artırır
    - DECREASES - Bu risk hedef riski azaltır
    - RELATED - İlişkili

  3. Özellikler
    - İki yönlü ilişki takibi
    - Organizasyon bazlı izolasyon
    - RLS politikaları
    - İlişki sayımı için yardımcı fonksiyon

  4. Güvenlik
    - RLS etkin
    - Sadece kendi organizasyonunun ilişkilerini görebilir/düzenleyebilir
*/

-- Create risk relations table
CREATE TABLE IF NOT EXISTS rm_risk_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  target_risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('TRIGGERS', 'TRIGGERED_BY', 'INCREASES', 'DECREASES', 'RELATED')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT risk_relations_different_risks CHECK (source_risk_id != target_risk_id),
  CONSTRAINT risk_relations_unique_relation UNIQUE (source_risk_id, target_risk_id, relation_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risk_relations_organization ON rm_risk_relations(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_relations_source ON rm_risk_relations(source_risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_relations_target ON rm_risk_relations(target_risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_relations_type ON rm_risk_relations(relation_type);

-- Enable RLS
ALTER TABLE rm_risk_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk relations
CREATE POLICY "Users can view relations in their organization"
  ON rm_risk_relations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can insert relations"
  ON rm_risk_relations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update relations"
  ON rm_risk_relations
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete relations"
  ON rm_risk_relations
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
    )
  );

-- Super admin policies
CREATE POLICY "Super admins can do everything with relations"
  ON rm_risk_relations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_super_admin = true
    )
  );

-- Function to get risk relation counts
CREATE OR REPLACE FUNCTION get_risk_relation_counts(
  p_risk_id UUID
) RETURNS TABLE (
  outgoing_count BIGINT,
  incoming_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM rm_risk_relations WHERE source_risk_id = p_risk_id)::BIGINT as outgoing_count,
    (SELECT COUNT(*) FROM rm_risk_relations WHERE target_risk_id = p_risk_id)::BIGINT as incoming_count,
    (SELECT COUNT(*) FROM rm_risk_relations WHERE source_risk_id = p_risk_id OR target_risk_id = p_risk_id)::BIGINT as total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get related risks with details
CREATE OR REPLACE FUNCTION get_related_risks(
  p_risk_id UUID
) RETURNS TABLE (
  relation_id UUID,
  relation_type TEXT,
  relation_description TEXT,
  direction TEXT,
  related_risk_id UUID,
  related_risk_code TEXT,
  related_risk_name TEXT,
  related_risk_level TEXT,
  related_risk_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  -- Outgoing relations (source_risk_id = p_risk_id)
  SELECT
    rr.id as relation_id,
    rr.relation_type,
    rr.description as relation_description,
    'OUTGOING'::TEXT as direction,
    r.id as related_risk_id,
    r.code as related_risk_code,
    r.name as related_risk_name,
    r.risk_level as related_risk_level,
    r.residual_score as related_risk_score
  FROM rm_risk_relations rr
  JOIN risks r ON r.id = rr.target_risk_id
  WHERE rr.source_risk_id = p_risk_id
  
  UNION ALL
  
  -- Incoming relations (target_risk_id = p_risk_id)
  SELECT
    rr.id as relation_id,
    rr.relation_type,
    rr.description as relation_description,
    'INCOMING'::TEXT as direction,
    r.id as related_risk_id,
    r.code as related_risk_code,
    r.name as related_risk_name,
    r.risk_level as related_risk_level,
    r.residual_score as related_risk_score
  FROM rm_risk_relations rr
  JOIN risks r ON r.id = rr.source_risk_id
  WHERE rr.target_risk_id = p_risk_id
  
  ORDER BY relation_type, related_risk_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check circular dependencies
CREATE OR REPLACE FUNCTION check_circular_risk_relation(
  p_source_risk_id UUID,
  p_target_risk_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_circular BOOLEAN;
BEGIN
  -- Check if adding this relation would create a circular dependency
  -- Using recursive CTE to traverse the relation graph
  WITH RECURSIVE relation_path AS (
    -- Start from target risk
    SELECT 
      target_risk_id as risk_id,
      1 as depth
    FROM rm_risk_relations
    WHERE source_risk_id = p_target_risk_id
    
    UNION ALL
    
    -- Recursively follow the chain
    SELECT 
      rr.target_risk_id as risk_id,
      rp.depth + 1
    FROM rm_risk_relations rr
    JOIN relation_path rp ON rp.risk_id = rr.source_risk_id
    WHERE rp.depth < 10 -- Prevent infinite loops
  )
  SELECT EXISTS (
    SELECT 1 FROM relation_path WHERE risk_id = p_source_risk_id
  ) INTO v_circular;
  
  RETURN v_circular;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_risk_relation_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_related_risks TO authenticated;
GRANT EXECUTE ON FUNCTION check_circular_risk_relation TO authenticated;

-- Add comments
COMMENT ON TABLE rm_risk_relations IS 'Riskler arası ilişkileri saklar';
COMMENT ON COLUMN rm_risk_relations.relation_type IS 'İlişki türü: TRIGGERS, TRIGGERED_BY, INCREASES, DECREASES, RELATED';
COMMENT ON COLUMN rm_risk_relations.source_risk_id IS 'Kaynak risk';
COMMENT ON COLUMN rm_risk_relations.target_risk_id IS 'Hedef risk';
COMMENT ON COLUMN rm_risk_relations.description IS 'İlişki açıklaması';
