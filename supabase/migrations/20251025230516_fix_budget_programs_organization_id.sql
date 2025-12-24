/*
  # Fix Budget Programs Structure - Add organization_id

  1. Changes
    - Add organization_id to sub_programs table
    - Add organization_id to activities table
    - Update RLS policies to use organization_id directly
    - Populate organization_id from parent tables
  
  2. Security
    - Maintain RLS on all tables
    - Update policies to check organization_id properly
*/

-- Add organization_id to sub_programs
ALTER TABLE sub_programs 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to activities
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Populate organization_id in sub_programs from programs
UPDATE sub_programs sp
SET organization_id = p.organization_id
FROM programs p
WHERE sp.program_id = p.id
AND sp.organization_id IS NULL;

-- Populate organization_id in activities from sub_programs
UPDATE activities a
SET organization_id = sp.organization_id
FROM sub_programs sp
WHERE a.sub_program_id = sp.id
AND a.organization_id IS NULL;

-- Make organization_id NOT NULL after populating
ALTER TABLE sub_programs 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE activities 
ALTER COLUMN organization_id SET NOT NULL;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view sub-programs in their organization" ON sub_programs;
DROP POLICY IF EXISTS "Users can create sub-programs in their organization" ON sub_programs;
DROP POLICY IF EXISTS "Users can update sub-programs in their organization" ON sub_programs;
DROP POLICY IF EXISTS "Users can delete sub-programs in their organization" ON sub_programs;

DROP POLICY IF EXISTS "Users can view activities in their organization" ON activities;
DROP POLICY IF EXISTS "Users can create activities in their organization" ON activities;
DROP POLICY IF EXISTS "Users can update activities in their organization" ON activities;
DROP POLICY IF EXISTS "Users can delete activities in their organization" ON activities;

-- Create new policies for sub_programs
CREATE POLICY "Users can view sub-programs in their organization"
  ON sub_programs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create sub-programs in their organization"
  ON sub_programs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update sub-programs in their organization"
  ON sub_programs FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sub-programs in their organization"
  ON sub_programs FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create new policies for activities
CREATE POLICY "Users can view activities in their organization"
  ON activities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create activities in their organization"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update activities in their organization"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete activities in their organization"
  ON activities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sub_programs_organization ON sub_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_organization ON activities(organization_id);
