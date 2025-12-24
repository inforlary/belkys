/*
  # Create Department Budget Data 2024 Table

  1. New Tables
    - `department_budget_data_2024`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `department_id` (uuid, foreign key to departments)
      - `year` (integer, default 2024)
      - `type` (text, 'expense' or 'revenue')
      - `code_id` (uuid, reference to economic codes)
      - `amount` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to profiles)

  2. Security
    - Enable RLS on `department_budget_data_2024` table
    - Add policies for admin access only
*/

CREATE TABLE IF NOT EXISTS department_budget_data_2024 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL DEFAULT 2024,
  type text NOT NULL CHECK (type IN ('expense', 'revenue')),
  code_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dept_budget_data_department ON department_budget_data_2024(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_budget_data_year ON department_budget_data_2024(year);
CREATE INDEX IF NOT EXISTS idx_dept_budget_data_type ON department_budget_data_2024(type);
CREATE INDEX IF NOT EXISTS idx_dept_budget_data_org ON department_budget_data_2024(organization_id);

ALTER TABLE department_budget_data_2024 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all budget data"
  ON department_budget_data_2024
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_budget_data_2024.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create budget data"
  ON department_budget_data_2024
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_budget_data_2024.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update budget data"
  ON department_budget_data_2024
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_budget_data_2024.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete budget data"
  ON department_budget_data_2024
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = department_budget_data_2024.organization_id
      AND profiles.role = 'admin'
    )
  );
