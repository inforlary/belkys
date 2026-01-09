/*
  # Add RLS Policies to Risk Categories

  1. Security
    - Enable RLS on risk_categories table
    - Add policies for viewing and managing categories
    - Users can view categories in their organization
    - Admins can manage categories
*/

-- Enable RLS
ALTER TABLE risk_categories ENABLE ROW LEVEL SECURITY;

-- Users can view categories in their organization
CREATE POLICY "Users can view categories in their organization"
  ON risk_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR organization_id IS NULL
  );

-- Admins can insert categories
CREATE POLICY "Admins can insert categories"
  ON risk_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update categories
CREATE POLICY "Admins can update categories"
  ON risk_categories FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete categories
CREATE POLICY "Admins can delete categories"
  ON risk_categories FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
