/*
  # Kurumsal Kod Sınıflandırması (Institutional Classification Codes)

  1. New Tables
    - `institutional_codes`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `level` (integer, 1-4 for I, II, III, IV levels)
      - `code` (text, the actual code like "01", "02" etc.)
      - `name` (text, description of the code)
      - `parent_id` (uuid, self-reference for hierarchy)
      - `full_code` (text, computed like "01-02-03-04")
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `institutional_codes` table
    - Admins and managers can manage codes
    - All authenticated users can view codes

  3. Indexes
    - Index on organization_id for performance
    - Index on parent_id for hierarchy queries
    - Index on full_code for fast lookups
*/

CREATE TABLE IF NOT EXISTS institutional_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 4),
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES institutional_codes(id) ON DELETE CASCADE,
  full_code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, full_code)
);

CREATE INDEX IF NOT EXISTS idx_institutional_codes_org ON institutional_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_institutional_codes_parent ON institutional_codes(parent_id);
CREATE INDEX IF NOT EXISTS idx_institutional_codes_full_code ON institutional_codes(organization_id, full_code);
CREATE INDEX IF NOT EXISTS idx_institutional_codes_level ON institutional_codes(organization_id, level);

ALTER TABLE institutional_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view institutional codes in their organization"
  ON institutional_codes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert institutional codes"
  ON institutional_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = institutional_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update institutional codes"
  ON institutional_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = institutional_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = institutional_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete institutional codes"
  ON institutional_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = institutional_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );