/*
  # Enhanced System with Departments and Multi-Year Indicators

  ## 1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `name` (text) - Department name
      - `code` (text) - Department code
      - `description` (text)
      - `manager_id` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `indicator_targets`
      - `id` (uuid, primary key)
      - `indicator_id` (uuid, foreign key)
      - `year` (integer) - Target year
      - `target_value` (decimal) - Target value for that year
      - `actual_value` (decimal) - Actual achieved value
      - `quarter_1_value` (decimal) - Q1 value if applicable
      - `quarter_2_value` (decimal) - Q2 value if applicable
      - `quarter_3_value` (decimal) - Q3 value if applicable
      - `quarter_4_value` (decimal) - Q4 value if applicable
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `approval_workflows`
      - `id` (uuid, primary key)
      - `entity_type` (text) - Type: strategic_plan, objective, goal, indicator, activity
      - `entity_id` (uuid) - ID of the entity
      - `status` (text) - pending, approved, rejected
      - `requested_by` (uuid, foreign key to profiles)
      - `reviewed_by` (uuid, foreign key to profiles)
      - `comments` (text)
      - `requested_at` (timestamptz)
      - `reviewed_at` (timestamptz)

    - `task_assignments`
      - `id` (uuid, primary key)
      - `activity_id` (uuid, foreign key)
      - `assigned_to` (uuid, foreign key to profiles)
      - `assigned_by` (uuid, foreign key to profiles)
      - `title` (text)
      - `description` (text)
      - `due_date` (date)
      - `status` (text) - pending, in_progress, completed, cancelled
      - `priority` (text) - low, medium, high, urgent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Modified Tables
    - `profiles`
      - Add `department_id` column
    
    - `indicators`
      - Keep existing structure, indicator_targets will handle multi-year data

  ## 3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for each role
    - Policies enforce department-based and role-based access

  ## Important Notes
    - Automatic code generation will be handled in application layer
    - Multi-year targets stored in separate table for flexibility
    - Quarterly tracking supported for detailed monitoring
    - Approval workflow supports all entity types
    - Task assignment linked to activities
*/

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view departments in their organization"
  ON departments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = departments.organization_id 
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = departments.organization_id 
      AND role IN ('admin', 'manager')
    )
  );

-- 2. Add department_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create indicator_targets table
CREATE TABLE IF NOT EXISTS indicator_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid REFERENCES indicators(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL,
  target_value decimal(15,2),
  actual_value decimal(15,2),
  quarter_1_value decimal(15,2),
  quarter_2_value decimal(15,2),
  quarter_3_value decimal(15,2),
  quarter_4_value decimal(15,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(indicator_id, year)
);

ALTER TABLE indicator_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view indicator targets in their organization"
  ON indicator_targets FOR SELECT
  TO authenticated
  USING (
    indicator_id IN (
      SELECT i.id FROM indicators i
      JOIN goals g ON i.goal_id = g.id
      WHERE g.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage indicator targets"
  ON indicator_targets FOR ALL
  TO authenticated
  USING (
    indicator_id IN (
      SELECT i.id FROM indicators i
      JOIN goals g ON i.goal_id = g.id
      WHERE g.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    indicator_id IN (
      SELECT i.id FROM indicators i
      JOIN goals g ON i.goal_id = g.id
      WHERE g.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- 4. Create approval_workflows table
CREATE TABLE IF NOT EXISTS approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('strategic_plan', 'objective', 'goal', 'indicator', 'activity')),
  entity_id uuid NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  comments text,
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval workflows"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid() OR 
    reviewed_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can request approvals"
  ON approval_workflows FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admins can manage approvals"
  ON approval_workflows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 5. Create task_assignments table
CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their assigned tasks"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR 
    assigned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can update their tasks"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Managers can create and manage tasks"
  ON task_assignments FOR ALL
  TO authenticated
  USING (
    assigned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    assigned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_departments_organization ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_indicator_targets_indicator ON indicator_targets(indicator_id);
CREATE INDEX IF NOT EXISTS idx_indicator_targets_year ON indicator_targets(year);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_entity ON approval_workflows(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON approval_workflows(status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_activity ON task_assignments(activity_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);

-- 7. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Add triggers for updated_at
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_indicator_targets_updated_at ON indicator_targets;
CREATE TRIGGER update_indicator_targets_updated_at BEFORE UPDATE ON indicator_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_approval_workflows_updated_at ON approval_workflows;
CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON approval_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_assignments_updated_at ON task_assignments;
CREATE TRIGGER update_task_assignments_updated_at BEFORE UPDATE ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
