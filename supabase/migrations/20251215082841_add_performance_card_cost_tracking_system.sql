/*
  # Add Performance Card Cost Tracking System

  ## Overview
  This migration adds support for tracking activity costs and estimated performance data for budget performance cards.

  ## Changes
  
  1. **indicator_data_entries Enhancement**
     - Add `entry_type` enum column to distinguish between actual, estimated, and target values
     - Values: 'actual' (default), 'estimated', 'target'
  
  2. **New Table: sub_program_activity_costs**
     - Tracks detailed cost information for sub-program activities
     - Links to economic codes (expense/revenue) at level 4
     - Tracks budget allocation (inside/outside budget via financing_type)
     - Stores planned, budgeted, actual, and year-end estimated amounts
     - Multi-year support via fiscal_year column
  
  3. **Security**
     - Enable RLS on new table
     - Policies for organization-based access
     - Super admin full access
  
  4. **Performance**
     - Indexes on foreign keys for fast lookups
     - Composite indexes for common query patterns
*/

-- Add entry_type to indicator_data_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'indicator_entry_type'
  ) THEN
    CREATE TYPE indicator_entry_type AS ENUM ('actual', 'estimated', 'target');
  END IF;
END $$;

-- Add entry_type column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'indicator_data_entries' AND column_name = 'entry_type'
  ) THEN
    ALTER TABLE indicator_data_entries 
    ADD COLUMN entry_type indicator_entry_type DEFAULT 'actual' NOT NULL;
    
    -- Add index for filtering by entry type
    CREATE INDEX IF NOT EXISTS idx_indicator_data_entries_entry_type 
    ON indicator_data_entries(entry_type);
  END IF;
END $$;

-- Create sub_program_activity_costs table
CREATE TABLE IF NOT EXISTS sub_program_activity_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  activity_id uuid REFERENCES sub_program_activities(id) ON DELETE CASCADE NOT NULL,
  fiscal_year integer NOT NULL,
  
  -- Economic Code (Level 4) - one of these will be set
  expense_code_id uuid REFERENCES expense_economic_codes(id) ON DELETE RESTRICT,
  revenue_code_id uuid REFERENCES revenue_economic_codes(id) ON DELETE RESTRICT,
  
  -- Budget Inside/Outside classification
  financing_type_id uuid REFERENCES financing_types(id) ON DELETE RESTRICT NOT NULL,
  
  -- Amount tracking
  planned_amount numeric(15,2) DEFAULT 0 NOT NULL,
  budget_amount numeric(15,2) DEFAULT 0 NOT NULL,
  actual_amount numeric(15,2) DEFAULT 0 NOT NULL,
  estimated_year_end numeric(15,2) DEFAULT 0 NOT NULL,
  
  -- Notes and metadata
  notes text,
  
  -- Audit fields
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT check_one_economic_code CHECK (
    (expense_code_id IS NOT NULL AND revenue_code_id IS NULL) OR
    (expense_code_id IS NULL AND revenue_code_id IS NOT NULL)
  ),
  CONSTRAINT check_amounts_non_negative CHECK (
    planned_amount >= 0 AND 
    budget_amount >= 0 AND 
    actual_amount >= 0 AND 
    estimated_year_end >= 0
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_costs_activity 
ON sub_program_activity_costs(activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_costs_fiscal_year 
ON sub_program_activity_costs(fiscal_year);

CREATE INDEX IF NOT EXISTS idx_activity_costs_organization 
ON sub_program_activity_costs(organization_id);

CREATE INDEX IF NOT EXISTS idx_activity_costs_expense_code 
ON sub_program_activity_costs(expense_code_id) WHERE expense_code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_costs_revenue_code 
ON sub_program_activity_costs(revenue_code_id) WHERE revenue_code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_costs_financing_type 
ON sub_program_activity_costs(financing_type_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_costs_lookup 
ON sub_program_activity_costs(organization_id, fiscal_year, activity_id);

-- Enable RLS
ALTER TABLE sub_program_activity_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sub_program_activity_costs

-- Super Admin: Full access
CREATE POLICY "Super admins have full access to activity costs"
ON sub_program_activity_costs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Organization Members: Read access to own organization
CREATE POLICY "Organization members can view activity costs"
ON sub_program_activity_costs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = sub_program_activity_costs.organization_id
  )
);

-- Organization Admins: Full access to own organization
CREATE POLICY "Organization admins can manage activity costs"
ON sub_program_activity_costs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = sub_program_activity_costs.organization_id
    AND profiles.role IN ('admin', 'vice_president')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = sub_program_activity_costs.organization_id
    AND profiles.role IN ('admin', 'vice_president')
  )
);

-- Budget and Finance roles can insert/update
CREATE POLICY "Budget roles can manage activity costs"
ON sub_program_activity_costs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = sub_program_activity_costs.organization_id
    AND profiles.role IN ('budget_admin', 'finance_officer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = sub_program_activity_costs.organization_id
    AND profiles.role IN ('budget_admin', 'finance_officer')
  )
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_activity_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_activity_costs_updated_at
BEFORE UPDATE ON sub_program_activity_costs
FOR EACH ROW
EXECUTE FUNCTION update_activity_costs_updated_at();

-- Set created_by on insert
CREATE OR REPLACE FUNCTION set_activity_costs_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_activity_costs_created_by_trigger
BEFORE INSERT ON sub_program_activity_costs
FOR EACH ROW
EXECUTE FUNCTION set_activity_costs_created_by();

-- Comment on table and columns
COMMENT ON TABLE sub_program_activity_costs IS 'Tracks detailed cost information for sub-program activities with economic code classification';
COMMENT ON COLUMN sub_program_activity_costs.expense_code_id IS 'Expense economic code (level 4) - mutually exclusive with revenue_code_id';
COMMENT ON COLUMN sub_program_activity_costs.revenue_code_id IS 'Revenue economic code (level 4) - mutually exclusive with expense_code_id';
COMMENT ON COLUMN sub_program_activity_costs.financing_type_id IS 'Budget inside/outside classification';
COMMENT ON COLUMN sub_program_activity_costs.planned_amount IS 'Planned amount for the fiscal year';
COMMENT ON COLUMN sub_program_activity_costs.budget_amount IS 'Approved budget amount';
COMMENT ON COLUMN sub_program_activity_costs.actual_amount IS 'Actual spent/received amount';
COMMENT ON COLUMN sub_program_activity_costs.estimated_year_end IS 'Estimated year-end total amount';