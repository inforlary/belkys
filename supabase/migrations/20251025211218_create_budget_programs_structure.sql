/*
  # Program ve Alt Program Yapısı (Programs and Sub-Programs Structure)

  1. New Tables
    - `programs`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `code` (text, program code like "01", "02")
      - `name` (text, program name)
      - `description` (text, detailed description)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sub_programs`
      - `id` (uuid, primary key)
      - `program_id` (uuid, references programs)
      - `code` (text, sub-program code like "01", "02")
      - `name` (text, sub-program name)
      - `description` (text, detailed description)
      - `full_code` (text, computed like "01.01")
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Admins and managers can manage programs/sub-programs
    - All authenticated users can view

  3. Indexes
    - Index on organization_id for programs
    - Index on program_id for sub_programs
*/

CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_programs_org ON programs(organization_id);

CREATE TABLE IF NOT EXISTS sub_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  full_code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sub_programs_program ON sub_programs(program_id);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view programs in their organization"
  ON programs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert programs"
  ON programs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = programs.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update programs"
  ON programs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = programs.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = programs.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete programs"
  ON programs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = programs.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can view sub_programs in their organization"
  ON sub_programs FOR SELECT
  TO authenticated
  USING (
    program_id IN (
      SELECT id FROM programs 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can insert sub_programs"
  ON sub_programs FOR INSERT
  TO authenticated
  WITH CHECK (
    program_id IN (
      SELECT id FROM programs 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Admins can update sub_programs"
  ON sub_programs FOR UPDATE
  TO authenticated
  USING (
    program_id IN (
      SELECT id FROM programs 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    program_id IN (
      SELECT id FROM programs 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Admins can delete sub_programs"
  ON sub_programs FOR DELETE
  TO authenticated
  USING (
    program_id IN (
      SELECT id FROM programs 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );