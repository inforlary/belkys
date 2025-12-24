/*
  # Create Internal Control Plans System

  1. New Tables
    - `ic_plans` - Main internal control plans table (similar to strategic_plans)
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text) - Plan name
      - `start_year` (integer) - Starting year
      - `end_year` (integer) - Ending year
      - `description` (text, nullable)
      - `status` (text) - active, draft, completed
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications
    - Add `ic_plan_id` to all existing IC tables:
      - ic_kiks_categories
      - ic_kiks_main_standards
      - ic_kiks_sub_standards
      - ic_kiks_actions
      - ic_processes
      - ic_process_steps
      - ic_controls
      - ic_risks
      - ic_findings
      - ic_capas
      - ic_capa_actions
      - ic_action_plans
      - ic_action_plan_progress
      - ic_action_plan_documents
      - ic_action_plan_approvals
      - ic_process_kiks_mappings
      - ic_control_tests
      - ic_kiks_sub_standard_statuses
      - ic_raci_matrix
      - ic_sod_rules
      - ic_ethics_commitments
      - ic_user_roles
      - ic_activity_process_mappings
      - ic_activity_risk_mappings
      - ic_activity_control_mappings

  3. Security
    - Enable RLS on `ic_plans` table
    - Add policies for authenticated users based on organization membership
*/

-- Create ic_plans table
CREATE TABLE IF NOT EXISTS ic_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'completed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS ic_plans_organization_id_idx ON ic_plans(organization_id);
CREATE INDEX IF NOT EXISTS ic_plans_status_idx ON ic_plans(status);
CREATE INDEX IF NOT EXISTS ic_plans_start_year_idx ON ic_plans(start_year);
CREATE INDEX IF NOT EXISTS ic_plans_end_year_idx ON ic_plans(end_year);

-- Enable RLS
ALTER TABLE ic_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ic_plans
CREATE POLICY "Super admins can view all IC plans"
  ON ic_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view IC plans in their organization"
  ON ic_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert any IC plan"
  ON ic_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can insert IC plans for their organization"
  ON ic_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can update any IC plan"
  ON ic_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can update IC plans in their organization"
  ON ic_plans FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can delete any IC plan"
  ON ic_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can delete IC plans in their organization"
  ON ic_plans FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Add ic_plan_id to existing IC tables

-- ic_kiks_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_kiks_categories' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_kiks_categories ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_kiks_categories_ic_plan_id_idx ON ic_kiks_categories(ic_plan_id);
  END IF;
END $$;

-- ic_kiks_main_standards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_kiks_main_standards' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_kiks_main_standards ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_kiks_main_standards_ic_plan_id_idx ON ic_kiks_main_standards(ic_plan_id);
  END IF;
END $$;

-- ic_kiks_sub_standards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_kiks_sub_standards' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_kiks_sub_standards ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_kiks_sub_standards_ic_plan_id_idx ON ic_kiks_sub_standards(ic_plan_id);
  END IF;
END $$;

-- ic_kiks_actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_kiks_actions' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_kiks_actions ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_kiks_actions_ic_plan_id_idx ON ic_kiks_actions(ic_plan_id);
  END IF;
END $$;

-- ic_processes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_processes' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_processes ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_processes_ic_plan_id_idx ON ic_processes(ic_plan_id);
  END IF;
END $$;

-- ic_process_steps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_process_steps' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_process_steps ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_process_steps_ic_plan_id_idx ON ic_process_steps(ic_plan_id);
  END IF;
END $$;

-- ic_controls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_controls' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_controls ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_controls_ic_plan_id_idx ON ic_controls(ic_plan_id);
  END IF;
END $$;

-- ic_risks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_risks' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_risks ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_risks_ic_plan_id_idx ON ic_risks(ic_plan_id);
  END IF;
END $$;

-- ic_findings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_findings' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_findings ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_findings_ic_plan_id_idx ON ic_findings(ic_plan_id);
  END IF;
END $$;

-- ic_capas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_capas' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_capas ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_capas_ic_plan_id_idx ON ic_capas(ic_plan_id);
  END IF;
END $$;

-- ic_capa_actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_capa_actions' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_capa_actions ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_capa_actions_ic_plan_id_idx ON ic_capa_actions(ic_plan_id);
  END IF;
END $$;

-- ic_action_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plans' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_action_plans ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_action_plans_ic_plan_id_idx ON ic_action_plans(ic_plan_id);
  END IF;
END $$;

-- ic_action_plan_progress
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plan_progress' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_action_plan_progress ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_action_plan_progress_ic_plan_id_idx ON ic_action_plan_progress(ic_plan_id);
  END IF;
END $$;

-- ic_action_plan_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plan_documents' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_action_plan_documents ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_action_plan_documents_ic_plan_id_idx ON ic_action_plan_documents(ic_plan_id);
  END IF;
END $$;

-- ic_action_plan_approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plan_approvals' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_action_plan_approvals ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_action_plan_approvals_ic_plan_id_idx ON ic_action_plan_approvals(ic_plan_id);
  END IF;
END $$;

-- ic_process_kiks_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_process_kiks_mappings' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_process_kiks_mappings ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_process_kiks_mappings_ic_plan_id_idx ON ic_process_kiks_mappings(ic_plan_id);
  END IF;
END $$;

-- ic_control_tests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_control_tests' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_control_tests ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_control_tests_ic_plan_id_idx ON ic_control_tests(ic_plan_id);
  END IF;
END $$;

-- ic_kiks_sub_standard_statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_kiks_sub_standard_statuses' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_kiks_sub_standard_statuses ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_kiks_sub_standard_statuses_ic_plan_id_idx ON ic_kiks_sub_standard_statuses(ic_plan_id);
  END IF;
END $$;

-- ic_raci_matrix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_raci_matrix' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_raci_matrix ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_raci_matrix_ic_plan_id_idx ON ic_raci_matrix(ic_plan_id);
  END IF;
END $$;

-- ic_sod_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_sod_rules' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_sod_rules ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_sod_rules_ic_plan_id_idx ON ic_sod_rules(ic_plan_id);
  END IF;
END $$;

-- ic_ethics_commitments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_ethics_commitments' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_ethics_commitments ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_ethics_commitments_ic_plan_id_idx ON ic_ethics_commitments(ic_plan_id);
  END IF;
END $$;

-- ic_user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_user_roles' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_user_roles ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_user_roles_ic_plan_id_idx ON ic_user_roles(ic_plan_id);
  END IF;
END $$;

-- ic_activity_process_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_activity_process_mappings' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_activity_process_mappings ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_activity_process_mappings_ic_plan_id_idx ON ic_activity_process_mappings(ic_plan_id);
  END IF;
END $$;

-- ic_activity_risk_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_activity_risk_mappings' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_activity_risk_mappings ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_activity_risk_mappings_ic_plan_id_idx ON ic_activity_risk_mappings(ic_plan_id);
  END IF;
END $$;

-- ic_activity_control_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_activity_control_mappings' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_activity_control_mappings ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS ic_activity_control_mappings_ic_plan_id_idx ON ic_activity_control_mappings(ic_plan_id);
  END IF;
END $$;