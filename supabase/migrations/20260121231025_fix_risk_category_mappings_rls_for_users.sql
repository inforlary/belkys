/*
  # Fix Risk Category Mappings RLS for All Users

  1. Changes
    - Drop existing policies with lowercase role checks
    - Recreate policies with uppercase roles (ADMIN, DIRECTOR, SUPER_ADMIN, USER)
    - Allow USER role to create risk category mappings for their risks
    - This fixes the RLS violation error when users create risks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and directors can insert risk category mappings" ON risk_category_mappings;
DROP POLICY IF EXISTS "Admins and directors can delete risk category mappings" ON risk_category_mappings;
DROP POLICY IF EXISTS "Super admins can manage all risk category mappings" ON risk_category_mappings;

-- Recreate INSERT policy for all authenticated users
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

-- Recreate DELETE policy for admins, directors, and super admins
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
            AND role IN ('ADMIN', 'DIRECTOR', 'SUPER_ADMIN')
        )
    )
  );
