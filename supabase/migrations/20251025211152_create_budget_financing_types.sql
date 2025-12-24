/*
  # Finansman Tipleri (Financing Types)

  1. New Tables
    - `financing_types`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `code` (text, like "1", "2", "3")
      - `name` (text, description)
      - `description` (text, detailed explanation)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `financing_types` table
    - Admins and managers can manage financing types
    - All authenticated users can view financing types

  3. Indexes
    - Index on organization_id for performance

  4. Notes
    - Common financing types:
      - 1: Genel Bütçe (General Budget)
      - 2: Özel Gelirler (Special Revenues)
      - 3: Dış Kaynaklı (Foreign Funded)
      - etc.
*/

CREATE TABLE IF NOT EXISTS financing_types (
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

CREATE INDEX IF NOT EXISTS idx_financing_types_org ON financing_types(organization_id);

ALTER TABLE financing_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financing types in their organization"
  ON financing_types FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert financing types"
  ON financing_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = financing_types.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update financing types"
  ON financing_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = financing_types.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = financing_types.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete financing types"
  ON financing_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = financing_types.organization_id
      AND role IN ('admin', 'manager')
    )
  );