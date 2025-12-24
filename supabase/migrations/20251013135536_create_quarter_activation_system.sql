/*
  # Create quarter activation control system

  1. New Tables
    - `quarter_activations`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `indicator_id` (uuid, foreign key to indicators)
      - `year` (integer) - The year
      - `quarter` (integer) - Quarter number (1-4)
      - `is_active` (boolean) - Whether this quarter is open for data entry
      - `activated_at` (timestamptz) - When it was activated
      - `activated_by` (uuid, foreign key to profiles) - Admin who activated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `quarter_activations` table
    - All users can view activations for their organization
    - Only admins can create/update activations

  3. Important Notes
    - One record per indicator per year per quarter
    - Department users can only enter data for active quarters
    - Admins control which quarters are open
*/

-- Create quarter_activations table
CREATE TABLE IF NOT EXISTS quarter_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  is_active boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  activated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quarter_activations_org ON quarter_activations(organization_id);
CREATE INDEX IF NOT EXISTS idx_quarter_activations_indicator ON quarter_activations(indicator_id);
CREATE INDEX IF NOT EXISTS idx_quarter_activations_year_quarter ON quarter_activations(year, quarter);
CREATE INDEX IF NOT EXISTS idx_quarter_activations_is_active ON quarter_activations(is_active);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_quarter_activations_unique 
  ON quarter_activations(indicator_id, year, quarter);

-- Enable RLS
ALTER TABLE quarter_activations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view activations in their organization
CREATE POLICY "Users can view activations in their org"
  ON quarter_activations FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Admins can insert activations
CREATE POLICY "Admins can create activations"
  ON quarter_activations FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Admins can update activations
CREATE POLICY "Admins can update activations"
  ON quarter_activations FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Admins can delete activations
CREATE POLICY "Admins can delete activations"
  ON quarter_activations FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quarter_activations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_quarter_activations_updated_at ON quarter_activations;
CREATE TRIGGER set_quarter_activations_updated_at
  BEFORE UPDATE ON quarter_activations
  FOR EACH ROW
  EXECUTE FUNCTION update_quarter_activations_updated_at();

-- Create notifications table for quarter activations
CREATE TABLE IF NOT EXISTS quarter_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quarter integer NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_quarter_notifications_org ON quarter_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_quarter_notifications_dept ON quarter_notifications(department_id);
CREATE INDEX IF NOT EXISTS idx_quarter_notifications_is_read ON quarter_notifications(is_read);

-- Enable RLS on notifications
ALTER TABLE quarter_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notifications for their department
CREATE POLICY "Users can view their department notifications"
  ON quarter_notifications FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      department_id IS NULL 
      OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Policy: Users can mark their notifications as read
CREATE POLICY "Users can update their notifications"
  ON quarter_notifications FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      department_id IS NULL 
      OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Admins can create notifications
CREATE POLICY "Admins can create notifications"
  ON quarter_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
