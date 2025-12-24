/*
  # Bütçe Yetkilendirme Sistemi (Budget Authorization System)

  1. New Tables
    - `budget_authorizations`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `budget_type` (text, 'revenue' or 'expense')
      - `authorized_department_id` (uuid, references departments)
      - `description` (text, notes about authorization)
      - `is_active` (boolean, whether this authorization is currently active)
      - `authorized_by` (uuid, references profiles - admin who granted this)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Only admins can manage authorizations
    - All authenticated users can view to check permissions

  3. Indexes
    - Index on organization_id
    - Index on authorized_department_id
    - Index on budget_type and is_active for permission checks

  4. Business Rules
    - Only ONE active authorization per budget_type per organization
    - For 'revenue': Only the authorized department can enter revenue data
    - For 'expense': Controls which departments can enter expense data (future use)
    - Admin must explicitly set which department has data entry rights

  5. Important Notes
    - **REVENUE AUTHORIZATION**: Only 1 department (e.g., Mali Hizmetler) can enter data
    - **CROSS-DEPARTMENT AGGREGATION**: The authorized department can aggregate revenue
      by economic code across all other departments
*/

CREATE TABLE IF NOT EXISTS budget_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  budget_type text NOT NULL CHECK (budget_type IN ('revenue', 'expense')),
  authorized_department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  description text,
  is_active boolean DEFAULT true,
  authorized_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_auth_org ON budget_authorizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_auth_dept ON budget_authorizations(authorized_department_id);
CREATE INDEX IF NOT EXISTS idx_budget_auth_type_active ON budget_authorizations(organization_id, budget_type, is_active);

ALTER TABLE budget_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget authorizations in their organization"
  ON budget_authorizations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Only admins can insert budget authorizations"
  ON budget_authorizations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND authorized_by = auth.uid()
  );

CREATE POLICY "Only admins can update budget authorizations"
  ON budget_authorizations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete budget authorizations"
  ON budget_authorizations FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION enforce_single_active_authorization()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE budget_authorizations
    SET is_active = false, updated_at = now()
    WHERE organization_id = NEW.organization_id
      AND budget_type = NEW.budget_type
      AND is_active = true
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_authorization
  BEFORE INSERT OR UPDATE ON budget_authorizations
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION enforce_single_active_authorization();