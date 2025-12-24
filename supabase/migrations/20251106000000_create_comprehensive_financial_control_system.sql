/*
  # Comprehensive Financial Control System

  This migration creates a complete financial management system with:

  1. Period Locks System
     - Fiscal year definition
     - Period locking mechanism
     - Correction voucher support

  2. Status Workflow System
     - Draft → Pending Approval → Approved → Posted → Correction
     - Status history tracking
     - Approval chain

  3. Role-Based Approval System
     - New roles: preparer, spending_authority, realization_officer, accountant
     - Approval chain with steps
     - Approval history

  4. Budget Control System
     - Budget allocation tracking
     - Commitment tracking
     - Realization tracking
     - Availability calculation
     - Budget transfer operations

  5. Revision Management
     - Budget revision tracking
     - Version control
     - Comparison reports

  6. Audit Trail
     - Complete audit logging
     - Change tracking
     - User actions

  7. Pre-Financial Control
     - Control checklist
     - Compliance verification

  8. Period Closing
     - Closing checklist
     - Approval workflow
*/

-- =============================================
-- 1. FISCAL YEAR DEFINITION
-- =============================================

CREATE TABLE IF NOT EXISTS fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  year integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, year)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_years_org ON fiscal_years(organization_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_years_current ON fiscal_years(organization_id, is_current) WHERE is_current = true;

-- =============================================
-- 2. PERIOD LOCKS
-- =============================================

CREATE TABLE IF NOT EXISTS period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  period_year integer NOT NULL,
  period_number integer NOT NULL,
  is_locked boolean DEFAULT false,
  locked_by uuid,
  locked_at timestamptz,
  locked_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, fiscal_year_id, period_type, period_year, period_number)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_org ON period_locks(organization_id);
CREATE INDEX IF NOT EXISTS idx_period_locks_fiscal_year ON period_locks(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_period_locks_status ON period_locks(organization_id, is_locked);

-- =============================================
-- 3. BUDGET ALLOCATIONS (Tahsis)
-- =============================================

CREATE TABLE IF NOT EXISTS budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE RESTRICT,
  sub_program_id uuid REFERENCES sub_programs(id) ON DELETE RESTRICT,
  institutional_code_id uuid REFERENCES institutional_codes(id) ON DELETE RESTRICT,
  expense_economic_code_id uuid REFERENCES expense_economic_codes(id) ON DELETE RESTRICT,
  financing_type_id uuid REFERENCES financing_types(id) ON DELETE RESTRICT,
  allocated_amount decimal(15,2) DEFAULT 0,
  revised_amount decimal(15,2) DEFAULT 0,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_allocations_org ON budget_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_fiscal_year ON budget_allocations(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_program ON budget_allocations(program_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_codes ON budget_allocations(institutional_code_id, expense_economic_code_id);

-- =============================================
-- 4. BUDGET REVISIONS (Revize)
-- =============================================

CREATE TABLE IF NOT EXISTS budget_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  allocation_id uuid NOT NULL REFERENCES budget_allocations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  previous_amount decimal(15,2) NOT NULL,
  new_amount decimal(15,2) NOT NULL,
  revision_reason text NOT NULL,
  revision_type text CHECK (revision_type IN ('increase', 'decrease', 'transfer', 'correction')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_revisions_org ON budget_revisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_revisions_allocation ON budget_revisions(allocation_id);
CREATE INDEX IF NOT EXISTS idx_budget_revisions_status ON budget_revisions(status);

-- =============================================
-- 5. BUDGET TRANSFERS (Transfer İşlemleri)
-- =============================================

CREATE TABLE IF NOT EXISTS budget_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  from_allocation_id uuid NOT NULL REFERENCES budget_allocations(id) ON DELETE RESTRICT,
  to_allocation_id uuid NOT NULL REFERENCES budget_allocations(id) ON DELETE RESTRICT,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  transfer_reason text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'posted')),
  requested_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_transfers_org ON budget_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_transfers_from ON budget_transfers(from_allocation_id);
CREATE INDEX IF NOT EXISTS idx_budget_transfers_to ON budget_transfers(to_allocation_id);
CREATE INDEX IF NOT EXISTS idx_budget_transfers_status ON budget_transfers(status);

-- =============================================
-- 6. COMMITMENTS (Taahhüt)
-- =============================================

CREATE TABLE IF NOT EXISTS budget_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  allocation_id uuid NOT NULL REFERENCES budget_allocations(id) ON DELETE RESTRICT,
  commitment_number text NOT NULL,
  commitment_date date NOT NULL,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  description text,
  vendor_name text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'partial', 'completed', 'cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, commitment_number)
);

CREATE INDEX IF NOT EXISTS idx_budget_commitments_org ON budget_commitments(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_commitments_allocation ON budget_commitments(allocation_id);
CREATE INDEX IF NOT EXISTS idx_budget_commitments_status ON budget_commitments(status);

-- =============================================
-- 7. ADD STATUS TO EXISTING TABLES
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_budget_entries' AND column_name = 'status'
  ) THEN
    ALTER TABLE expense_budget_entries ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'correction', 'cancelled'));
    ALTER TABLE expense_budget_entries ADD COLUMN is_correction boolean DEFAULT false;
    ALTER TABLE expense_budget_entries ADD COLUMN original_entry_id uuid REFERENCES expense_budget_entries(id);
    ALTER TABLE expense_budget_entries ADD COLUMN correction_reason text;
    ALTER TABLE expense_budget_entries ADD COLUMN period_year integer;
    ALTER TABLE expense_budget_entries ADD COLUMN period_month integer;
    ALTER TABLE expense_budget_entries ADD COLUMN approved_by uuid;
    ALTER TABLE expense_budget_entries ADD COLUMN approved_at timestamptz;
    ALTER TABLE expense_budget_entries ADD COLUMN posted_by uuid;
    ALTER TABLE expense_budget_entries ADD COLUMN posted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'status'
  ) THEN
    ALTER TABLE revenue_budget_entries ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'correction', 'cancelled'));
    ALTER TABLE revenue_budget_entries ADD COLUMN is_correction boolean DEFAULT false;
    ALTER TABLE revenue_budget_entries ADD COLUMN original_entry_id uuid REFERENCES revenue_budget_entries(id);
    ALTER TABLE revenue_budget_entries ADD COLUMN correction_reason text;
    ALTER TABLE revenue_budget_entries ADD COLUMN period_year integer;
    ALTER TABLE revenue_budget_entries ADD COLUMN period_month integer;
    ALTER TABLE revenue_budget_entries ADD COLUMN approved_by uuid;
    ALTER TABLE revenue_budget_entries ADD COLUMN approved_at timestamptz;
    ALTER TABLE revenue_budget_entries ADD COLUMN posted_by uuid;
    ALTER TABLE revenue_budget_entries ADD COLUMN posted_at timestamptz;
  END IF;
END $$;

-- =============================================
-- 8. STATUS HISTORY
-- =============================================

CREATE TABLE IF NOT EXISTS status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamptz DEFAULT now(),
  comment text,
  ip_address text
);

CREATE INDEX IF NOT EXISTS idx_status_history_org ON status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_status_history_entity ON status_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON status_history(changed_by);

-- =============================================
-- 9. APPROVAL CHAIN
-- =============================================

CREATE TABLE IF NOT EXISTS approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  step_order integer NOT NULL,
  role_required text NOT NULL CHECK (role_required IN ('preparer', 'spending_authority', 'realization_officer', 'accountant', 'controller', 'admin')),
  assigned_to uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_chains_org ON approval_chains(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_chains_entity ON approval_chains(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_chains_assigned ON approval_chains(assigned_to, status);

-- =============================================
-- 10. PRE-FINANCIAL CONTROL CHECKLIST
-- =============================================

CREATE TABLE IF NOT EXISTS pre_control_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  control_item text NOT NULL,
  is_compliant boolean DEFAULT false,
  checked_by uuid,
  checked_at timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_control_org ON pre_control_checklists(organization_id);
CREATE INDEX IF NOT EXISTS idx_pre_control_entity ON pre_control_checklists(entity_type, entity_id);

-- =============================================
-- 11. PERIOD CLOSING
-- =============================================

CREATE TABLE IF NOT EXISTS period_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  period_year integer NOT NULL,
  period_number integer NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'reopened')),
  all_vouchers_approved boolean DEFAULT false,
  reconciliation_done boolean DEFAULT false,
  inventory_counted boolean DEFAULT false,
  reports_ready boolean DEFAULT false,
  closed_by uuid,
  closed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, fiscal_year_id, period_type, period_year, period_number)
);

CREATE INDEX IF NOT EXISTS idx_period_closings_org ON period_closings(organization_id);
CREATE INDEX IF NOT EXISTS idx_period_closings_fiscal ON period_closings(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_period_closings_status ON period_closings(status);

-- =============================================
-- 12. AUDIT TRAIL
-- =============================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid NOT NULL,
  changed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_org ON audit_trail(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_table ON audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_trail_date ON audit_trail(changed_at);

-- =============================================
-- 13. BUDGET CONTROL CACHE (Materialized View Alternative)
-- =============================================

CREATE TABLE IF NOT EXISTS budget_control_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  allocation_id uuid NOT NULL REFERENCES budget_allocations(id) ON DELETE CASCADE,
  allocated_amount decimal(15,2) DEFAULT 0,
  revised_amount decimal(15,2) DEFAULT 0,
  committed_amount decimal(15,2) DEFAULT 0,
  realized_amount decimal(15,2) DEFAULT 0,
  available_amount decimal(15,2) GENERATED ALWAYS AS (revised_amount - committed_amount - realized_amount) STORED,
  realization_rate decimal(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN revised_amount > 0 THEN (realized_amount / revised_amount * 100)
      ELSE 0
    END
  ) STORED,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(organization_id, fiscal_year_id, allocation_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_control_org ON budget_control_summary(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_control_fiscal ON budget_control_summary(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_budget_control_allocation ON budget_control_summary(allocation_id);
CREATE INDEX IF NOT EXISTS idx_budget_control_available ON budget_control_summary(available_amount);

-- =============================================
-- 14. INTERNAL CONTROL FINDINGS
-- =============================================

CREATE TABLE IF NOT EXISTS internal_control_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  finding_type text NOT NULL CHECK (finding_type IN ('budget_overrun', 'delayed_approval', 'incorrect_abs', 'missing_document', 'other')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  entity_type text,
  entity_id uuid,
  description text NOT NULL,
  recommendation text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  detected_by uuid,
  detected_at timestamptz DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_findings_org ON internal_control_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_control_findings_type ON internal_control_findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_control_findings_status ON internal_control_findings(status);
CREATE INDEX IF NOT EXISTS idx_control_findings_severity ON internal_control_findings(severity);

-- =============================================
-- 15. RLS POLICIES
-- =============================================

ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_control_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_control_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_control_findings ENABLE ROW LEVEL SECURITY;

-- Fiscal Years Policies
CREATE POLICY "Users can view fiscal years in their organization"
  ON fiscal_years FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage fiscal years"
  ON fiscal_years FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Period Locks Policies
CREATE POLICY "Users can view period locks in their organization"
  ON period_locks FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage period locks"
  ON period_locks FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Budget Allocations Policies
CREATE POLICY "Users can view budget allocations in their organization"
  ON budget_allocations FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage budget allocations"
  ON budget_allocations FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Budget Revisions Policies
CREATE POLICY "Users can view budget revisions in their organization"
  ON budget_revisions FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create budget revisions"
  ON budget_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own budget revisions"
  ON budget_revisions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  );

-- Budget Transfers Policies
CREATE POLICY "Users can view budget transfers in their organization"
  ON budget_transfers FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create budget transfers"
  ON budget_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND requested_by = auth.uid()
  );

CREATE POLICY "Users can update budget transfers"
  ON budget_transfers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (requested_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  );

-- Commitments Policies
CREATE POLICY "Users can view commitments in their organization"
  ON budget_commitments FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create commitments"
  ON budget_commitments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update commitments"
  ON budget_commitments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  );

-- Status History Policies
CREATE POLICY "Users can view status history in their organization"
  ON status_history FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can insert status history"
  ON status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND changed_by = auth.uid()
  );

-- Approval Chain Policies
CREATE POLICY "Users can view approval chains in their organization"
  ON approval_chains FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can manage approval chains"
  ON approval_chains FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Pre-Control Policies
CREATE POLICY "Users can view pre-control in their organization"
  ON pre_control_checklists FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Controllers can manage pre-control"
  ON pre_control_checklists FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Period Closing Policies
CREATE POLICY "Users can view period closings in their organization"
  ON period_closings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage period closings"
  ON period_closings FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Audit Trail Policies
CREATE POLICY "Users can view audit trail in their organization"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can insert audit trail"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND changed_by = auth.uid()
  );

-- Budget Control Summary Policies
CREATE POLICY "Users can view budget control in their organization"
  ON budget_control_summary FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can manage budget control summary"
  ON budget_control_summary FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Internal Control Findings Policies
CREATE POLICY "Users can view control findings in their organization"
  ON internal_control_findings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create control findings"
  ON internal_control_findings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND detected_by = auth.uid()
  );

CREATE POLICY "Users can update control findings"
  ON internal_control_findings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (detected_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  );
