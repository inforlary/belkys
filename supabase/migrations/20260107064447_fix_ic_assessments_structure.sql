/*
  # Fix IC Assessments Structure
  
  1. Changes
    - Recreate ic_assessments table with proper structure for period-based assessments
    - Remove standard_id column (standards are in ic_assessment_details)
    - Add name, year, period, overall_compliance_percent columns
    - Update ic_assessment_details to ensure proper foreign key relationships
  
  2. Security
    - Maintain existing RLS policies
*/

-- Drop and recreate ic_assessments with proper structure
DROP TABLE IF EXISTS ic_assessments CASCADE;

CREATE TABLE ic_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  year integer NOT NULL,
  period text NOT NULL CHECK (period IN ('Q2', 'Q4')),
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assessed_by_id uuid REFERENCES profiles(id),
  overall_compliance_percent numeric(5,2),
  status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED')),
  approved_by_id uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, year, period)
);

-- Recreate ic_assessment_details with foreign key to new ic_assessments
DROP TABLE IF EXISTS ic_assessment_details CASCADE;

CREATE TABLE ic_assessment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES ic_assessments(id) ON DELETE CASCADE NOT NULL,
  standard_id uuid REFERENCES ic_standards(id) ON DELETE CASCADE NOT NULL,
  compliance_level integer NOT NULL CHECK (compliance_level >= 1 AND compliance_level <= 5),
  compliance_score numeric(5,2),
  strengths text,
  weaknesses text,
  evidences text,
  recommendations text,
  action_required boolean DEFAULT false,
  assessor_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(assessment_id, standard_id)
);

-- Create indexes
CREATE INDEX idx_ic_assessments_org_year ON ic_assessments(organization_id, year);
CREATE INDEX idx_ic_assessments_status ON ic_assessments(status);
CREATE INDEX idx_ic_assessment_details_assessment ON ic_assessment_details(assessment_id);
CREATE INDEX idx_ic_assessment_details_standard ON ic_assessment_details(standard_id);

-- Enable RLS
ALTER TABLE ic_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_assessment_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ic_assessments
CREATE POLICY "Users can view own organization assessments"
  ON ic_assessments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert assessments"
  ON ic_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update assessments"
  ON ic_assessments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete draft assessments"
  ON ic_assessments FOR DELETE
  TO authenticated
  USING (
    status = 'DRAFT'
    AND organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for ic_assessment_details
CREATE POLICY "Users can view own organization assessment details"
  ON ic_assessment_details FOR SELECT
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM ic_assessments 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can insert assessment details"
  ON ic_assessment_details FOR INSERT
  TO authenticated
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM ic_assessments 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can update assessment details"
  ON ic_assessment_details FOR UPDATE
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM ic_assessments 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can delete assessment details"
  ON ic_assessment_details FOR DELETE
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM ic_assessments 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
      AND status = 'DRAFT'
    )
  );
