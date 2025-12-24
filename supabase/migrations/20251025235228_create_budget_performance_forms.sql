/*
  # Create Budget Performance Forms System

  1. New Tables
    - `budget_performance_forms`
      - Main form for each activity's budget performance
      - Links to: organization, department, activity, program, sub_program
      - Contains: meta information (legal basis, justification, cost elements)
      - Multi-year planning data
      
    - `budget_performance_form_details`
      - Detailed economic code entries for each form
      - Links to: form, expense_economic_code
      - Contains: Multi-year budget and actual spending data
      - Yearly columns: 2025 budget/actual, 2026 budget/actual, 2027 request, etc.

  2. Changes
    - Add department_id to expense_budget_entries
    - Add department_id to revenue_budget_entries
    
  3. Security
    - Enable RLS on all new tables
    - Department managers can create/edit their own department's forms
    - Department users can view their own department's forms
    - Admins can view all forms

  4. Important Notes
    - Each form represents one activity's budget performance
    - Each form has multiple detail lines (one per economic code)
    - Multi-year budget planning (3 years)
    - Tracks both budget allocations and actual spending
*/

-- Create budget_performance_forms table
CREATE TABLE IF NOT EXISTS budget_performance_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  sub_program_id uuid REFERENCES sub_programs(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  
  -- Meta information
  legal_basis text DEFAULT '',
  justification text DEFAULT '',
  cost_elements text DEFAULT '',
  
  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  UNIQUE(organization_id, department_id, activity_id)
);

-- Create budget_performance_form_details table
CREATE TABLE IF NOT EXISTS budget_performance_form_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES budget_performance_forms(id) ON DELETE CASCADE NOT NULL,
  economic_code_id uuid REFERENCES expense_economic_codes(id) ON DELETE CASCADE NOT NULL,
  
  -- Year 1 (e.g., 2025)
  year1 integer NOT NULL,
  year1_budget_allocation decimal(15,2) DEFAULT 0,
  year1_actual_spending decimal(15,2) DEFAULT 0,
  
  -- Year 2 (e.g., 2026)
  year2 integer NOT NULL,
  year2_budget_allocation decimal(15,2) DEFAULT 0,
  year2_actual_spending decimal(15,2) DEFAULT 0,
  
  -- Year 3 (e.g., 2027)
  year3 integer NOT NULL,
  year3_requested_amount decimal(15,2) DEFAULT 0,
  
  -- Year 2 end of year
  year2_year_end_allocation decimal(15,2) DEFAULT 0,
  year2_total_allocation decimal(15,2) DEFAULT 0,
  
  -- Year 3 and 4 estimates
  year3_estimated_cost decimal(15,2) DEFAULT 0,
  year4_estimated_cost decimal(15,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(form_id, economic_code_id)
);

-- Add department_id to expense_budget_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_budget_entries' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE expense_budget_entries 
    ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add department_id to revenue_budget_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_budget_entries' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE revenue_budget_entries 
    ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE budget_performance_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_performance_form_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_performance_forms

-- Admins can view all forms
CREATE POLICY "Admins can view all budget performance forms"
  ON budget_performance_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Department managers can view their department's forms
CREATE POLICY "Department managers can view their department forms"
  ON budget_performance_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role IN ('manager', 'user')
    )
  );

-- Department managers can create forms for their department
CREATE POLICY "Department managers can create forms"
  ON budget_performance_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
    )
  );

-- Department managers can update their department's draft forms
CREATE POLICY "Department managers can update their draft forms"
  ON budget_performance_forms FOR UPDATE
  TO authenticated
  USING (
    status = 'draft' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
    )
  );

-- Admins can update any form
CREATE POLICY "Admins can update any budget performance form"
  ON budget_performance_forms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Department managers can delete their draft forms
CREATE POLICY "Department managers can delete their draft forms"
  ON budget_performance_forms FOR DELETE
  TO authenticated
  USING (
    status = 'draft' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
    )
  );

-- RLS Policies for budget_performance_form_details

-- Users can view details if they can view the parent form
CREATE POLICY "Users can view form details if they can view the form"
  ON budget_performance_form_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND (
        -- Admin can view all
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = budget_performance_forms.organization_id
          AND profiles.role = 'admin'
        )
        OR
        -- Department users can view their department
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = budget_performance_forms.organization_id
          AND profiles.department_id = budget_performance_forms.department_id
        )
      )
    )
  );

-- Department managers can insert details for their forms
CREATE POLICY "Department managers can insert form details"
  ON budget_performance_form_details FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
      AND budget_performance_forms.status = 'draft'
    )
  );

-- Department managers can update details for their draft forms
CREATE POLICY "Department managers can update their form details"
  ON budget_performance_form_details FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
      AND budget_performance_forms.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
    )
  );

-- Admins can update any details
CREATE POLICY "Admins can update any form details"
  ON budget_performance_form_details FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Department managers can delete details from their draft forms
CREATE POLICY "Department managers can delete their form details"
  ON budget_performance_form_details FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'manager'
      AND budget_performance_forms.status = 'draft'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_org ON budget_performance_forms(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_dept ON budget_performance_forms(department_id);
CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_activity ON budget_performance_forms(activity_id);
CREATE INDEX IF NOT EXISTS idx_budget_performance_form_details_form ON budget_performance_form_details(form_id);
CREATE INDEX IF NOT EXISTS idx_expense_budget_entries_dept ON expense_budget_entries(department_id);
CREATE INDEX IF NOT EXISTS idx_revenue_budget_entries_dept ON revenue_budget_entries(department_id);