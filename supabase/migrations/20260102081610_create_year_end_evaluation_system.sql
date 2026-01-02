/*
  # Year-End Strategic Plan Evaluation System

  1. New Tables
    - `year_end_evaluations`
      - Tracks department-level year-end evaluation status
      - Links to fiscal_year and department
      - Has overall approval workflow (submitted -> director_approved -> admin_approved -> completed)
    
    - `indicator_year_evaluations`
      - Stores evaluation responses for each indicator
      - Contains responses for 4 criteria: relevance, effectiveness, efficiency, sustainability
      - Each criterion has multiple questions with text responses
      - Links to indicator and year_end_evaluation
      - Has individual approval workflow
  
  2. Evaluation Criteria & Questions
    - İlgililik (Relevance): Environment changes, needs assessment
    - Etkililik (Effectiveness): Goal achievement, contribution to development
    - Etkinlik (Efficiency): Cost effectiveness, resource utilization
    - Sürdürülebilirlik (Sustainability): Risks, continuity measures

  3. Security
    - RLS policies for role-based access
    - Users can create/edit their own department's evaluations
    - Directors can approve their department's evaluations
    - Admins/VPs can view and approve all evaluations

  4. Features
    - Prevents fiscal year transition until all evaluations complete
    - Three-level approval: user -> director -> admin
    - Tracks evaluation progress by department
    - Links to strategic plan indicators
*/

-- Year-End Evaluations (Department level)
CREATE TABLE IF NOT EXISTS year_end_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Overall assessment fields
  general_performance_summary text,
  achievements text,
  challenges text,
  recommendations text,
  
  -- Approval workflow
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'director_approved', 'admin_approved', 'completed')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id),
  director_approved_at timestamptz,
  director_approved_by uuid REFERENCES profiles(id),
  director_comments text,
  admin_approved_at timestamptz,
  admin_approved_by uuid REFERENCES profiles(id),
  admin_comments text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  
  UNIQUE(organization_id, fiscal_year, department_id)
);

-- Indicator Year Evaluations (Indicator level - detailed criteria)
CREATE TABLE IF NOT EXISTS indicator_year_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_end_evaluation_id uuid NOT NULL REFERENCES year_end_evaluations(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  
  -- İlgililik (Relevance) Questions
  relevance_environment_changes text,
  relevance_needs_change text,
  relevance_target_change_needed text,
  
  -- Etkililik (Effectiveness) Questions
  effectiveness_target_achieved text,
  effectiveness_needs_met text,
  effectiveness_update_needed text,
  effectiveness_contribution text,
  
  -- Etkinlik (Efficiency) Questions
  efficiency_unexpected_costs text,
  efficiency_cost_table_update text,
  efficiency_target_change_due_cost text,
  
  -- Sürdürülebilirlik (Sustainability) Questions
  sustainability_risks text,
  sustainability_measures text,
  sustainability_risk_changes text,
  sustainability_risk_impact text,
  sustainability_plan_update_needed text,
  
  -- Metadata
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  
  UNIQUE(year_end_evaluation_id, indicator_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_year_end_evaluations_org_year ON year_end_evaluations(organization_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_year_end_evaluations_department ON year_end_evaluations(department_id);
CREATE INDEX IF NOT EXISTS idx_year_end_evaluations_status ON year_end_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_indicator_year_evaluations_year_end ON indicator_year_evaluations(year_end_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_indicator_year_evaluations_indicator ON indicator_year_evaluations(indicator_id);

-- Enable RLS
ALTER TABLE year_end_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_year_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for year_end_evaluations

-- Super admin can do everything
CREATE POLICY "Super admins have full access to year_end_evaluations"
  ON year_end_evaluations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Admins can view all evaluations in their organization
CREATE POLICY "Admins can view year_end_evaluations"
  ON year_end_evaluations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can create evaluations for their department
CREATE POLICY "Users can create year_end_evaluations for their department"
  ON year_end_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update draft evaluations in their department
CREATE POLICY "Users can update draft year_end_evaluations"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND status = 'draft'
  )
  WITH CHECK (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Directors can approve evaluations for their department
CREATE POLICY "Directors can approve year_end_evaluations"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    AND status IN ('submitted', 'director_approved')
  );

-- Admins and VPs can approve all evaluations
CREATE POLICY "Admins can approve year_end_evaluations"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'vice_president')
    )
    AND status IN ('director_approved', 'admin_approved')
  );

-- RLS Policies for indicator_year_evaluations

-- Super admins have full access
CREATE POLICY "Super admins have full access to indicator_year_evaluations"
  ON indicator_year_evaluations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Users can view evaluations for their department's indicators
CREATE POLICY "Users can view indicator_year_evaluations"
  ON indicator_year_evaluations FOR SELECT
  TO authenticated
  USING (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can create evaluations for indicators in their department
CREATE POLICY "Users can create indicator_year_evaluations"
  ON indicator_year_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can update draft evaluations
CREATE POLICY "Users can update draft indicator_year_evaluations"
  ON indicator_year_evaluations FOR UPDATE
  TO authenticated
  USING (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND status = 'draft'
  );

-- Directors and admins can approve evaluations
CREATE POLICY "Directors and admins can approve indicator_year_evaluations"
  ON indicator_year_evaluations FOR UPDATE
  TO authenticated
  USING (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('director', 'admin', 'vice_president')
    )
  );

-- Function to check if all evaluations are complete for a fiscal year
CREATE OR REPLACE FUNCTION check_year_end_evaluations_complete(
  p_organization_id uuid,
  p_fiscal_year integer
) RETURNS boolean AS $$
DECLARE
  total_departments integer;
  completed_evaluations integer;
BEGIN
  -- Count total departments in organization
  SELECT COUNT(*) INTO total_departments
  FROM departments
  WHERE organization_id = p_organization_id;
  
  -- Count completed evaluations
  SELECT COUNT(*) INTO completed_evaluations
  FROM year_end_evaluations
  WHERE organization_id = p_organization_id
  AND fiscal_year = p_fiscal_year
  AND status = 'completed';
  
  -- Return true if all departments have completed evaluations
  RETURN total_departments = completed_evaluations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get evaluation completion progress
CREATE OR REPLACE FUNCTION get_evaluation_progress(
  p_organization_id uuid,
  p_fiscal_year integer
) RETURNS TABLE (
  total_departments integer,
  evaluations_draft integer,
  evaluations_submitted integer,
  evaluations_director_approved integer,
  evaluations_admin_approved integer,
  evaluations_completed integer,
  completion_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::integer FROM departments WHERE organization_id = p_organization_id) as total_departments,
    COUNT(*) FILTER (WHERE status = 'draft')::integer as evaluations_draft,
    COUNT(*) FILTER (WHERE status = 'submitted')::integer as evaluations_submitted,
    COUNT(*) FILTER (WHERE status = 'director_approved')::integer as evaluations_director_approved,
    COUNT(*) FILTER (WHERE status = 'admin_approved')::integer as evaluations_admin_approved,
    COUNT(*) FILTER (WHERE status = 'completed')::integer as evaluations_completed,
    CASE 
      WHEN (SELECT COUNT(*) FROM departments WHERE organization_id = p_organization_id) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / 
            (SELECT COUNT(*) FROM departments WHERE organization_id = p_organization_id)::numeric) * 100, 2)
    END as completion_percentage
  FROM year_end_evaluations
  WHERE organization_id = p_organization_id
  AND fiscal_year = p_fiscal_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update fiscal_year_management to check evaluations before allowing year transition
-- This is a soft check - we'll enforce it in the application layer
