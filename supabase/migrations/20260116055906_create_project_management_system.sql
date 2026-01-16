/*
  # Create Project Management System

  ## Changes
  1. New Table: `projects`
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key to organizations)
    - `code` (varchar) - Project code (PRJ-2025-001)
    - `name` (varchar) - Project name
    - `description` (text, nullable) - Project description
    - `department_id` (uuid, foreign key to departments) - Responsible department
    - `manager_id` (uuid, nullable, foreign key to profiles) - Project manager
    - `budget` (decimal, nullable) - Planned budget
    - `actual_cost` (decimal, nullable, default 0) - Actual cost
    - `start_date` (date) - Start date
    - `end_date` (date) - End date
    - `status` (varchar) - Status (PLANNED, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED)
    - `progress` (integer, 0-100) - Progress percentage
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. RLS Policies
    - Enable RLS on projects table
    - Users can view projects in their organization
    - Admins can manage all projects
    - Directors can manage projects in their department

  3. Indexes
    - Add indexes for foreign keys
    - Add index for status and organization_id
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  budget DECIMAL(15, 2),
  actual_cost DECIMAL(15, 2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT projects_code_org_unique UNIQUE (code, organization_id),
  CONSTRAINT projects_dates_check CHECK (end_date >= start_date),
  CONSTRAINT projects_status_check CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'))
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects

-- Super admin can see all projects
CREATE POLICY "Super admins can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Users can view projects in their organization
CREATE POLICY "Users can view organization projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admins can insert projects in their organization
CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update projects in their organization
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Directors can update projects in their department
CREATE POLICY "Directors can update their department projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'director'
    )
  );

-- Admins can delete projects in their organization
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Add comments
COMMENT ON TABLE projects IS 'Project management system for tracking organizational projects';
COMMENT ON COLUMN projects.code IS 'Unique project code within organization (e.g., PRJ-2025-001)';
COMMENT ON COLUMN projects.status IS 'Project status: PLANNED, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED';
COMMENT ON COLUMN projects.progress IS 'Project completion percentage (0-100)';
COMMENT ON COLUMN projects.budget IS 'Planned project budget';
COMMENT ON COLUMN projects.actual_cost IS 'Actual project cost incurred';
