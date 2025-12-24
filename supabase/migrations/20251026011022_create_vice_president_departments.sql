/*
  # Vice President Departments Management

  1. New Table
    - `vice_president_departments`
      - `id` (uuid, primary key)
      - `vice_president_id` (uuid, references profiles)
      - `department_id` (uuid, references departments)
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for admins and vice presidents to manage their department assignments

  3. Notes
    - This table allows vice presidents to be assigned to multiple departments
    - Admins can assign departments to vice presidents
    - Vice presidents can view their assigned departments
*/

CREATE TABLE IF NOT EXISTS vice_president_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vice_president_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vice_president_id, department_id)
);

ALTER TABLE vice_president_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vice president departments"
  ON vice_president_departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  );

CREATE POLICY "Vice presidents can view their departments"
  ON vice_president_departments
  FOR SELECT
  TO authenticated
  USING (vice_president_id = auth.uid());