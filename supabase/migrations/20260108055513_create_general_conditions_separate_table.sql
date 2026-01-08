/*
  # Create General Conditions Separate Table

  1. New Table
    - `ic_general_conditions` table for individual general conditions
      - Each condition has its own current status tracking
      - Linked to ic_standards via standard_id
  
  2. Structure
    - id: UUID primary key
    - standard_id: Foreign key to ic_standards
    - condition_text: The general condition description
    - current_situation_description: Current status for this specific condition
    - current_status_satisfied: Boolean if this condition is already met
    - order_index: For maintaining condition order
    - created_at, updated_at: Timestamps

  3. Data Migration
    - Parse existing general_conditions from ic_standards
    - Create separate rows for each condition (split by newline)
    - Migrate to new structure

  4. Cleanup
    - Remove current_situation_description and current_status_satisfied from ic_standards
    - Keep general_conditions temporarily for reference

  5. Security
    - Enable RLS
    - Allow super admins full access
    - Allow organization users to read their own conditions
*/

-- Create the new table
CREATE TABLE IF NOT EXISTS ic_general_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id uuid REFERENCES ic_standards(id) ON DELETE CASCADE NOT NULL,
  condition_text text NOT NULL,
  current_situation_description text,
  current_status_satisfied boolean DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ic_general_conditions_standard_id ON ic_general_conditions(standard_id);
CREATE INDEX IF NOT EXISTS idx_ic_general_conditions_organization_id ON ic_general_conditions(organization_id);

-- Enable RLS
ALTER TABLE ic_general_conditions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins have full access to general conditions"
  ON ic_general_conditions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Users can view general conditions in their organization"
  ON ic_general_conditions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
    )
  );

CREATE POLICY "Admins can manage general conditions in their organization"
  ON ic_general_conditions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
    )
  );

-- Migrate existing data from ic_standards.general_conditions
-- For global standards (organization_id IS NULL), create global conditions
INSERT INTO ic_general_conditions (standard_id, condition_text, order_index, organization_id)
SELECT 
  s.id as standard_id,
  trim(unnest(string_to_array(s.general_conditions, E'\n'))) as condition_text,
  row_number() OVER (PARTITION BY s.id ORDER BY ordinality) - 1 as order_index,
  NULL as organization_id
FROM ic_standards s
CROSS JOIN LATERAL unnest(string_to_array(s.general_conditions, E'\n')) WITH ORDINALITY
WHERE s.general_conditions IS NOT NULL 
  AND s.general_conditions != ''
  AND trim(unnest) != ''
ON CONFLICT DO NOTHING;

-- Remove current_situation_description and current_status_satisfied from ic_standards
ALTER TABLE ic_standards DROP COLUMN IF EXISTS current_situation_description;
ALTER TABLE ic_standards DROP COLUMN IF EXISTS current_status_satisfied;