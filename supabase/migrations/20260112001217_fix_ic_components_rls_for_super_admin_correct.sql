/*
  # Fix IC Tables RLS for Super Admin (Correct Definition)

  1. Changes
    - Fix RLS policies to recognize super admin correctly
    - Super admin = role 'admin' AND organization_id IS NULL
    - Regular admin = role 'admin' AND organization_id IS NOT NULL
  
  2. Security
    - Maintain proper role-based access control
    - Super admins get full access to all records
    - Regular admins only access their organization's records
*/

-- Drop and recreate ic_components policies with correct super admin check
DROP POLICY IF EXISTS "Super admins full access to components" ON ic_components;
DROP POLICY IF EXISTS "Admins manage own org components" ON ic_components;

CREATE POLICY "Super admins full access to components"
  ON ic_components FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NULL
    )
  );

CREATE POLICY "Admins manage own org components"
  ON ic_components FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NOT NULL
      AND profiles.organization_id = ic_components.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NOT NULL
      AND profiles.organization_id = ic_components.organization_id
    )
  );

-- Drop and recreate ic_standards policies
DROP POLICY IF EXISTS "Super admins full access to standards" ON ic_standards;
DROP POLICY IF EXISTS "Admins manage standards" ON ic_standards;

CREATE POLICY "Super admins full access to standards"
  ON ic_standards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NULL
    )
  );

CREATE POLICY "Admins manage standards"
  ON ic_standards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN ic_components c ON c.id = ic_standards.component_id
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.organization_id IS NOT NULL
      AND (c.organization_id = p.organization_id OR c.organization_id IS NULL OR ic_standards.component_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN ic_components c ON c.id = ic_standards.component_id
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.organization_id IS NOT NULL
      AND (c.organization_id = p.organization_id OR c.organization_id IS NULL OR ic_standards.component_id IS NULL)
    )
  );

-- Drop and recreate ic_general_conditions policies
DROP POLICY IF EXISTS "Super admins full access to conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins manage conditions via standards" ON ic_general_conditions;

CREATE POLICY "Super admins full access to conditions"
  ON ic_general_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id IS NULL
    )
  );

CREATE POLICY "Admins manage conditions via standards"
  ON ic_general_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN ic_standards s ON s.id = ic_general_conditions.standard_id
      LEFT JOIN ic_components c ON c.id = s.component_id
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.organization_id IS NOT NULL
      AND (c.organization_id = p.organization_id OR c.organization_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN ic_standards s ON s.id = ic_general_conditions.standard_id
      LEFT JOIN ic_components c ON c.id = s.component_id
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.organization_id IS NOT NULL
      AND (c.organization_id = p.organization_id OR c.organization_id IS NULL)
    )
  );
