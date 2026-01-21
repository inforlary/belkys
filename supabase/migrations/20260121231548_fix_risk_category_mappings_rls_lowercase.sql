/*
  # Fix Risk Category Mappings RLS for Lowercase Roles

  1. Changes
    - Update risk_category_mappings RLS policies to use lowercase roles
    - admin, director, super_admin instead of ADMIN, DIRECTOR, SUPER_ADMIN
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert risk category mappings" ON risk_category_mappings;
DROP POLICY IF EXISTS "Admins and directors can delete risk category mappings" ON risk_category_mappings;
DROP POLICY IF EXISTS "Users can view risk category mappings in their organization" ON risk_category_mappings;

-- Recreate with lowercase roles
CREATE POLICY "Users can insert risk category mappings"
  ON risk_category_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM risks
      WHERE risks.id = risk_category_mappings.risk_id
        AND risks.organization_id IN (
          SELECT organization_id
          FROM profiles
          WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Admins and directors can delete risk category mappings"
  ON risk_category_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM risks
      WHERE risks.id = risk_category_mappings.risk_id
        AND risks.organization_id IN (
          SELECT organization_id
          FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'director', 'super_admin')
        )
    )
  );

CREATE POLICY "Users can view risk category mappings in their organization"
  ON risk_category_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM risks
      WHERE risks.id = risk_category_mappings.risk_id
        AND risks.organization_id IN (
          SELECT organization_id
          FROM profiles
          WHERE id = auth.uid()
        )
    )
  );
