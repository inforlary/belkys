/*
  # Gelir Bütçe Fişleri ve Teklifleri (Revenue Budget Entries and Proposals)

  1. New Tables
    - `revenue_budget_entries`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `department_id` (uuid, references departments) - Which department this revenue belongs to
      - `revenue_economic_code_id` (uuid, references revenue_economic_codes)
      - `description` (text, explanation)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `revenue_budget_proposals`
      - `id` (uuid, primary key)
      - `entry_id` (uuid, references revenue_budget_entries)
      - `year` (integer, budget year)
      - `amount` (decimal, proposed revenue amount)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - CRITICAL: Only authorized department can INSERT/UPDATE/DELETE
    - All users can VIEW for cross-department reporting and aggregation
    - Authorization is controlled via budget_authorizations table

  3. Indexes
    - Index on organization_id
    - Index on department_id
    - Index on revenue_economic_code_id
    - Index on entry_id for proposals
    - Index on year for proposals

  4. Business Rules
    - Only ONE department has data entry permission (controlled by admin)
    - That authorized department can view and aggregate revenue by economic code across all departments
    - Multiple years can be planned (previous, current, next, next+1)
*/

CREATE TABLE IF NOT EXISTS revenue_budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  revenue_economic_code_id uuid NOT NULL REFERENCES revenue_economic_codes(id) ON DELETE RESTRICT,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_entries_org ON revenue_budget_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_dept ON revenue_budget_entries(department_id);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_code ON revenue_budget_entries(revenue_economic_code_id);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_created_by ON revenue_budget_entries(created_by);

CREATE TABLE IF NOT EXISTS revenue_budget_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES revenue_budget_entries(id) ON DELETE CASCADE,
  year integer NOT NULL,
  amount decimal(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entry_id, year)
);

CREATE INDEX IF NOT EXISTS idx_revenue_proposals_entry ON revenue_budget_proposals(entry_id);
CREATE INDEX IF NOT EXISTS idx_revenue_proposals_year ON revenue_budget_proposals(year);

ALTER TABLE revenue_budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_budget_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all revenue entries in their organization"
  ON revenue_budget_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Only authorized department can insert revenue entries"
  ON revenue_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM budget_authorizations ba
      WHERE ba.organization_id = revenue_budget_entries.organization_id
      AND ba.budget_type = 'revenue'
      AND ba.authorized_department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      AND ba.is_active = true
    )
  );

CREATE POLICY "Only authorized department can update revenue entries"
  ON revenue_budget_entries FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM budget_authorizations ba
      WHERE ba.organization_id = revenue_budget_entries.organization_id
      AND ba.budget_type = 'revenue'
      AND ba.authorized_department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      AND ba.is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Only authorized department can delete revenue entries"
  ON revenue_budget_entries FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM budget_authorizations ba
      WHERE ba.organization_id = revenue_budget_entries.organization_id
      AND ba.budget_type = 'revenue'
      AND ba.authorized_department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      AND ba.is_active = true
    )
  );

CREATE POLICY "Users can view all revenue proposals in their organization"
  ON revenue_budget_proposals FOR SELECT
  TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM revenue_budget_entries
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Only authorized department can insert revenue proposals"
  ON revenue_budget_proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    entry_id IN (
      SELECT rbe.id FROM revenue_budget_entries rbe
      WHERE rbe.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM budget_authorizations ba
        WHERE ba.organization_id = rbe.organization_id
        AND ba.budget_type = 'revenue'
        AND ba.authorized_department_id IN (
          SELECT department_id FROM profiles WHERE id = auth.uid()
        )
        AND ba.is_active = true
      )
    )
  );

CREATE POLICY "Only authorized department can update revenue proposals"
  ON revenue_budget_proposals FOR UPDATE
  TO authenticated
  USING (
    entry_id IN (
      SELECT rbe.id FROM revenue_budget_entries rbe
      WHERE rbe.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM budget_authorizations ba
        WHERE ba.organization_id = rbe.organization_id
        AND ba.budget_type = 'revenue'
        AND ba.authorized_department_id IN (
          SELECT department_id FROM profiles WHERE id = auth.uid()
        )
        AND ba.is_active = true
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT rbe.id FROM revenue_budget_entries rbe
      WHERE rbe.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Only authorized department can delete revenue proposals"
  ON revenue_budget_proposals FOR DELETE
  TO authenticated
  USING (
    entry_id IN (
      SELECT rbe.id FROM revenue_budget_entries rbe
      WHERE rbe.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM budget_authorizations ba
        WHERE ba.organization_id = rbe.organization_id
        AND ba.budget_type = 'revenue'
        AND ba.authorized_department_id IN (
          SELECT department_id FROM profiles WHERE id = auth.uid()
        )
        AND ba.is_active = true
      )
    )
  );