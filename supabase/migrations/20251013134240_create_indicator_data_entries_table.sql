/*
  # Create indicator data entries table for periodic tracking

  1. New Tables
    - `indicator_data_entries`
      - `id` (uuid, primary key)
      - `indicator_id` (uuid, foreign key to indicators)
      - `organization_id` (uuid, foreign key to organizations)
      - `entered_by` (uuid, foreign key to profiles)
      - `value` (numeric) - The actual measured value
      - `entry_date` (date) - Date of the measurement
      - `period_type` (text) - 'monthly', 'quarterly', 'yearly'
      - `period_year` (integer) - Year of the period
      - `period_month` (integer) - Month (1-12) for monthly entries
      - `period_quarter` (integer) - Quarter (1-4) for quarterly entries
      - `notes` (text) - Optional notes about the entry
      - `status` (text) - 'draft', 'submitted', 'approved', 'rejected'
      - `approved_by` (uuid, foreign key to profiles) - Admin who approved
      - `approved_at` (timestamptz) - When it was approved
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `indicator_data_entries` table
    - Department users can create and view their own entries
    - Admins can view and approve all entries
    - After submission, only admins can modify entries

  3. Important Notes
    - Users cannot modify entries after submission (status != 'draft')
    - Only one entry per indicator per period is allowed
    - Admins can approve/reject entries and modify any entry
*/

-- Create indicator_data_entries table
CREATE TABLE IF NOT EXISTS indicator_data_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entered_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_year integer NOT NULL,
  period_month integer CHECK (period_month >= 1 AND period_month <= 12),
  period_quarter integer CHECK (period_quarter >= 1 AND period_quarter <= 4),
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_entries_indicator_id ON indicator_data_entries(indicator_id);
CREATE INDEX IF NOT EXISTS idx_entries_organization_id ON indicator_data_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_entries_entered_by ON indicator_data_entries(entered_by);
CREATE INDEX IF NOT EXISTS idx_entries_status ON indicator_data_entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_period ON indicator_data_entries(period_type, period_year, period_month, period_quarter);

-- Create unique constraint to prevent duplicate entries for same period
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique_monthly 
  ON indicator_data_entries(indicator_id, period_year, period_month) 
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique_quarterly 
  ON indicator_data_entries(indicator_id, period_year, period_quarter) 
  WHERE period_type = 'quarterly';

CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique_yearly 
  ON indicator_data_entries(indicator_id, period_year) 
  WHERE period_type = 'yearly';

-- Enable RLS
ALTER TABLE indicator_data_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view entries for indicators in their department
CREATE POLICY "Users can view entries in their department"
  ON indicator_data_entries FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admins can see all
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      OR
      -- Department users see entries for their department's indicators
      indicator_id IN (
        SELECT i.id FROM indicators i
        JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
      )
    )
  );

-- Policy: Users can create draft entries for their department's indicators
CREATE POLICY "Users can create entries for their indicators"
  ON indicator_data_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND entered_by = auth.uid()
    AND status = 'draft'
    AND indicator_id IN (
      SELECT i.id FROM indicators i
      JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Policy: Users can update their own draft entries only
CREATE POLICY "Users can update their own draft entries"
  ON indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    entered_by = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    entered_by = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
  );

-- Policy: Admins can update any entry
CREATE POLICY "Admins can update any entry"
  ON indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Users can delete their own draft entries
CREATE POLICY "Users can delete their own draft entries"
  ON indicator_data_entries FOR DELETE
  TO authenticated
  USING (
    entered_by = auth.uid()
    AND status = 'draft'
  );

-- Policy: Admins can delete any entry
CREATE POLICY "Admins can delete any entry"
  ON indicator_data_entries FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_indicator_data_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_indicator_data_entries_updated_at ON indicator_data_entries;
CREATE TRIGGER set_indicator_data_entries_updated_at
  BEFORE UPDATE ON indicator_data_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_indicator_data_entries_updated_at();
