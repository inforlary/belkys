/*
  # Create Vice President Role and Department Assignment System

  ## Overview
  This migration adds support for Vice President (VP) role with department assignments,
  allowing VPs to oversee multiple departments and view their performance data.

  ## Changes
  
  1. **Create vp_department_assignments table**
     - Links vice presidents to their assigned departments
     - `id` (uuid, primary key)
     - `organization_id` (uuid, foreign key)
     - `vice_president_id` (uuid, foreign key to profiles)
     - `department_id` (uuid, foreign key to departments)
     - `assigned_at` (timestamptz)
     - `assigned_by` (uuid, foreign key to profiles)
  
  2. **Security**
     - Enable RLS on vp_department_assignments
     - VPs can view their own assignments
     - Admins can manage all assignments

  ## Important Notes
  - Vice Presidents can view all data from their assigned departments
  - Multiple VPs can be assigned to the same department
  - Admins manage VP assignments
  - Role value 'vice_president' will be used in profiles.role field
*/

-- Create VP department assignments table
CREATE TABLE IF NOT EXISTS vp_department_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  vice_president_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vice_president_id, department_id)
);

-- Enable RLS
ALTER TABLE vp_department_assignments ENABLE ROW LEVEL SECURITY;

-- VPs can view their own assignments
CREATE POLICY "Vice presidents can view own assignments"
  ON vp_department_assignments
  FOR SELECT
  TO authenticated
  USING (vice_president_id = auth.uid());

-- Admins can view all assignments in their organization
CREATE POLICY "Admins can view all VP assignments"
  ON vp_department_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vp_department_assignments.organization_id
    )
  );

-- Admins can insert assignments
CREATE POLICY "Admins can create VP assignments"
  ON vp_department_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vp_department_assignments.organization_id
    )
  );

-- Admins can delete assignments
CREATE POLICY "Admins can delete VP assignments"
  ON vp_department_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vp_department_assignments.organization_id
    )
  );

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_vp_assignments_vp_id ON vp_department_assignments(vice_president_id);
CREATE INDEX IF NOT EXISTS idx_vp_assignments_dept_id ON vp_department_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_vp_assignments_org_id ON vp_department_assignments(organization_id);