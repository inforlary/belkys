/*
  # Fix IC Standards RLS for Nullable Components

  1. Changes
    - Update RLS policies for ic_standards to handle nullable component_id
    - Allow super admins to manage standards without component_id
    - Allow admins to manage standards with global (null org) components
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage standards via components" ON ic_standards;
DROP POLICY IF EXISTS "Super admins full access to standards" ON ic_standards;

-- Recreate with better support for nullable component_id
CREATE POLICY "Super admins full access to standards"
  ON ic_standards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Admins manage standards"
  ON ic_standards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
      AND (
        ic_standards.component_id IS NULL
        OR EXISTS (
          SELECT 1 FROM ic_components c
          WHERE c.id = ic_standards.component_id
          AND (c.organization_id IS NULL OR c.organization_id = profiles.organization_id)
        )
      )
    )
  );
