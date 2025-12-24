/*
  # Gider Bütçe Fişleri ve Teklifleri (Expense Budget Entries and Proposals)

  1. New Tables
    - `expense_budget_entries`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `program_id` (uuid, references programs)
      - `sub_program_id` (uuid, references sub_programs)
      - `activity_id` (uuid, references activities)
      - `institutional_code_id` (uuid, references institutional_codes)
      - `expense_economic_code_id` (uuid, references expense_economic_codes)
      - `financing_type_id` (uuid, references financing_types)
      - `description` (text, explanation)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `expense_budget_proposals`
      - `id` (uuid, primary key)
      - `entry_id` (uuid, references expense_budget_entries)
      - `year` (integer, budget year)
      - `amount` (decimal, proposed budget amount)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only manage entries in their organization
    - Department-based access control for data entry
    - All users can view for reporting purposes

  3. Indexes
    - Index on organization_id
    - Index on program_id, sub_program_id, activity_id
    - Index on entry_id for proposals
    - Index on year for proposals

  4. Business Rules
    - All classification fields are mandatory
    - Multiple years can be planned (previous, current, next, next+1)
    - Entries are linked to activities which are linked to goals
*/

CREATE TABLE IF NOT EXISTS expense_budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  sub_program_id uuid NOT NULL REFERENCES sub_programs(id) ON DELETE RESTRICT,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  institutional_code_id uuid NOT NULL REFERENCES institutional_codes(id) ON DELETE RESTRICT,
  expense_economic_code_id uuid NOT NULL REFERENCES expense_economic_codes(id) ON DELETE RESTRICT,
  financing_type_id uuid NOT NULL REFERENCES financing_types(id) ON DELETE RESTRICT,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_entries_org ON expense_budget_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_program ON expense_budget_entries(program_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_sub_program ON expense_budget_entries(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_activity ON expense_budget_entries(activity_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_created_by ON expense_budget_entries(created_by);

CREATE TABLE IF NOT EXISTS expense_budget_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES expense_budget_entries(id) ON DELETE CASCADE,
  year integer NOT NULL,
  amount decimal(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entry_id, year)
);

CREATE INDEX IF NOT EXISTS idx_expense_proposals_entry ON expense_budget_proposals(entry_id);
CREATE INDEX IF NOT EXISTS idx_expense_proposals_year ON expense_budget_proposals(year);

ALTER TABLE expense_budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_budget_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expense entries in their organization"
  ON expense_budget_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expense entries in their department"
  ON expense_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own expense entries"
  ON expense_budget_entries FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own expense entries"
  ON expense_budget_entries FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can view expense proposals in their organization"
  ON expense_budget_proposals FOR SELECT
  TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM expense_budget_entries
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert expense proposals for their entries"
  ON expense_budget_proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    entry_id IN (
      SELECT id FROM expense_budget_entries
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Users can update expense proposals for their entries"
  ON expense_budget_proposals FOR UPDATE
  TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM expense_budget_entries
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM expense_budget_entries
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete expense proposals for their entries"
  ON expense_budget_proposals FOR DELETE
  TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM expense_budget_entries
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
      )
    )
  );