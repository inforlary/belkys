/*
  # Gelir Ekonomik Kod Sınıflandırması (Revenue Economic Classification Codes)

  1. New Tables
    - `revenue_economic_codes`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `level` (integer, 1-4 for I, II, III, IV levels)
      - `code` (text, the actual code)
      - `name` (text, description)
      - `parent_id` (uuid, self-reference for hierarchy)
      - `full_code` (text, computed like "01-02-03-04")
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `revenue_economic_codes` table
    - Admins and managers can manage codes
    - All authenticated users can view codes

  3. Indexes
    - Index on organization_id for performance
    - Index on parent_id for hierarchy queries
    - Index on full_code for fast lookups
*/

CREATE TABLE IF NOT EXISTS revenue_economic_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 4),
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES revenue_economic_codes(id) ON DELETE CASCADE,
  full_code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, full_code)
);

CREATE INDEX IF NOT EXISTS idx_revenue_economic_codes_org ON revenue_economic_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_economic_codes_parent ON revenue_economic_codes(parent_id);
CREATE INDEX IF NOT EXISTS idx_revenue_economic_codes_full_code ON revenue_economic_codes(organization_id, full_code);
CREATE INDEX IF NOT EXISTS idx_revenue_economic_codes_level ON revenue_economic_codes(organization_id, level);

ALTER TABLE revenue_economic_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revenue economic codes in their organization"
  ON revenue_economic_codes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert revenue economic codes"
  ON revenue_economic_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = revenue_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update revenue economic codes"
  ON revenue_economic_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = revenue_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = revenue_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete revenue economic codes"
  ON revenue_economic_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = revenue_economic_codes.organization_id
      AND role IN ('admin', 'manager')
    )
  );