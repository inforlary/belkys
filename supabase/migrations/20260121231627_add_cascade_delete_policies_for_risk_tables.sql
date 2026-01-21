/*
  # Add DELETE Policies for Risk-Related Tables

  1. Issue
    - When deleting a risk, CASCADE delete tries to delete related records
    - Missing DELETE policies on related tables cause RLS violations
    - This prevents risk deletion

  2. Changes
    - Add DELETE policies for all tables with CASCADE delete to risks
    - Allow users to delete records when they can access the parent risk
*/

-- risk_department_impacts
DROP POLICY IF EXISTS "Users can delete risk department impacts" ON risk_department_impacts;
CREATE POLICY "Users can delete risk department impacts"
  ON risk_department_impacts FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- risk_treatments
DROP POLICY IF EXISTS "Users can delete risk treatments" ON risk_treatments;
CREATE POLICY "Users can delete risk treatments"
  ON risk_treatments FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- risk_indicators
DROP POLICY IF EXISTS "Users can delete risk indicators" ON risk_indicators;
CREATE POLICY "Users can delete risk indicators"
  ON risk_indicators FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- risk_assessment_history
DROP POLICY IF EXISTS "Users can delete risk assessment history" ON risk_assessment_history;
CREATE POLICY "Users can delete risk assessment history"
  ON risk_assessment_history FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- rm_risk_relations
DROP POLICY IF EXISTS "Users can delete risk relations" ON rm_risk_relations;
CREATE POLICY "Users can delete risk relations"
  ON rm_risk_relations FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- rm_risk_assessments
DROP POLICY IF EXISTS "Users can delete rm risk assessments" ON rm_risk_assessments;
CREATE POLICY "Users can delete rm risk assessments"
  ON rm_risk_assessments FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- rm_risk_department_impacts
DROP POLICY IF EXISTS "Users can delete rm risk department impacts" ON rm_risk_department_impacts;
CREATE POLICY "Users can delete rm risk department impacts"
  ON rm_risk_department_impacts FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
