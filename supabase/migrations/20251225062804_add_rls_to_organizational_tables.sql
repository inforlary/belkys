/*
  # Organizasyonel yapı tablolarına RLS politikaları ekle
*/

-- ic_positions RLS
ALTER TABLE ic_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view positions in org" ON ic_positions;
CREATE POLICY "Users view positions in org"
  ON ic_positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_positions.organization_id
    )
  );

DROP POLICY IF EXISTS "IC roles manage positions" ON ic_positions;
CREATE POLICY "IC roles manage positions"
  ON ic_positions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_positions.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_positions.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  );

DROP POLICY IF EXISTS "Super admins manage all positions" ON ic_positions;
CREATE POLICY "Super admins manage all positions"
  ON ic_positions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- ic_position_assignments RLS
ALTER TABLE ic_position_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view assignments in org" ON ic_position_assignments;
CREATE POLICY "Users view assignments in org"
  ON ic_position_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_position_assignments.organization_id
    )
  );

DROP POLICY IF EXISTS "IC roles manage assignments" ON ic_position_assignments;
CREATE POLICY "IC roles manage assignments"
  ON ic_position_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_position_assignments.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_position_assignments.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  );

DROP POLICY IF EXISTS "Super admins manage all assignments" ON ic_position_assignments;
CREATE POLICY "Super admins manage all assignments"
  ON ic_position_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- ic_authority_matrix RLS
ALTER TABLE ic_authority_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view authority matrix in org" ON ic_authority_matrix;
CREATE POLICY "Users view authority matrix in org"
  ON ic_authority_matrix FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_authority_matrix.organization_id
    )
  );

DROP POLICY IF EXISTS "IC roles manage authority matrix" ON ic_authority_matrix;
CREATE POLICY "IC roles manage authority matrix"
  ON ic_authority_matrix FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_authority_matrix.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_authority_matrix.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  );

DROP POLICY IF EXISTS "Super admins manage all authority matrix" ON ic_authority_matrix;
CREATE POLICY "Super admins manage all authority matrix"
  ON ic_authority_matrix FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- ic_process_flow_diagrams RLS
ALTER TABLE ic_process_flow_diagrams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view flow diagrams in org" ON ic_process_flow_diagrams;
CREATE POLICY "Users view flow diagrams in org"
  ON ic_process_flow_diagrams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_process_flow_diagrams.organization_id
    )
  );

DROP POLICY IF EXISTS "IC roles manage flow diagrams" ON ic_process_flow_diagrams;
CREATE POLICY "IC roles manage flow diagrams"
  ON ic_process_flow_diagrams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_process_flow_diagrams.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ic_process_flow_diagrams.organization_id
      AND profiles.role IN ('admin', 'ic_coordinator', 'ic_auditor', 'director', 'vice_president')
    )
  );

DROP POLICY IF EXISTS "Super admins manage all flow diagrams" ON ic_process_flow_diagrams;
CREATE POLICY "Super admins manage all flow diagrams"
  ON ic_process_flow_diagrams FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- Trigger'lar
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ic_positions_updated_at ON ic_positions;
CREATE TRIGGER update_ic_positions_updated_at
  BEFORE UPDATE ON ic_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_position_assignments_updated_at ON ic_position_assignments;
CREATE TRIGGER update_ic_position_assignments_updated_at
  BEFORE UPDATE ON ic_position_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_authority_matrix_updated_at ON ic_authority_matrix;
CREATE TRIGGER update_ic_authority_matrix_updated_at
  BEFORE UPDATE ON ic_authority_matrix
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_flow_diagrams_updated_at ON ic_process_flow_diagrams;
CREATE TRIGGER update_ic_flow_diagrams_updated_at
  BEFORE UPDATE ON ic_process_flow_diagrams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Pozisyon kodu otomatik oluşturma
CREATE OR REPLACE FUNCTION generate_ic_position_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT COALESCE(MAX(
      CASE 
        WHEN code ~ '^POS-[0-9]{4}-[0-9]+$' 
        THEN CAST(SPLIT_PART(code, '-', 3) AS INTEGER)
        ELSE 0 
      END
    ), 0) + 1 INTO next_num
    FROM ic_positions
    WHERE organization_id = NEW.organization_id
    AND ic_plan_id = NEW.ic_plan_id;
    
    NEW.code := 'POS-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_ic_position_code ON ic_positions;
CREATE TRIGGER trigger_generate_ic_position_code
  BEFORE INSERT ON ic_positions
  FOR EACH ROW
  EXECUTE FUNCTION generate_ic_position_code();