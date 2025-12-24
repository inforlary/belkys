/*
  # Enhanced Approval Workflow System v2
  
  1. New Tables
    - `workflow_templates` - Workflow templates
    - `workflow_template_steps` - Workflow steps/levels
    - `enhanced_approval_requests` - Enhanced approval requests
    - `approval_actions_log` - Individual approver actions
    - `request_comments` - Comments/discussion thread
      
  2. Security
    - Enable RLS on all tables
    
  3. Functions
    - Functions for approval processing
*/

-- Create workflow_templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  entity_type text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create workflow_template_steps table
CREATE TABLE IF NOT EXISTS workflow_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES workflow_templates(id) ON DELETE CASCADE NOT NULL,
  step_order integer NOT NULL,
  step_name text NOT NULL,
  approver_role text CHECK (approver_role IN ('user', 'manager', 'vice_president', 'admin')),
  approver_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approver_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  is_required boolean DEFAULT true,
  auto_approve_after_hours integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, step_order)
);

-- Create enhanced_approval_requests table
CREATE TABLE IF NOT EXISTS enhanced_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  current_step integer DEFAULT 1,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  deadline timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create approval_actions_log table
CREATE TABLE IF NOT EXISTS approval_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES enhanced_approval_requests(id) ON DELETE CASCADE NOT NULL,
  step_id uuid REFERENCES workflow_template_steps(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'delegated', 'requested_changes')),
  comment text,
  delegated_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create request_comments table
CREATE TABLE IF NOT EXISTS request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES enhanced_approval_requests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhanced_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates in their org"
  ON workflow_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = workflow_templates.organization_id
    )
  );

CREATE POLICY "Admins can manage templates"
  ON workflow_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = workflow_templates.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Users can view template steps"
  ON workflow_template_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_templates wt
      JOIN profiles p ON p.organization_id = wt.organization_id
      WHERE wt.id = workflow_template_steps.template_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage template steps"
  ON workflow_template_steps FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_templates wt
      JOIN profiles p ON p.organization_id = wt.organization_id
      WHERE wt.id = workflow_template_steps.template_id
      AND p.id = auth.uid()
      AND p.role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Users can view relevant requests"
  ON enhanced_approval_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = enhanced_approval_requests.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    ) OR
    EXISTS (
      SELECT 1 FROM workflow_template_steps wts
      WHERE wts.template_id = enhanced_approval_requests.template_id
      AND wts.step_order = enhanced_approval_requests.current_step
      AND (
        wts.approver_user_id = auth.uid() OR
        wts.approver_department_id IN (
          SELECT department_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create requests"
  ON enhanced_approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = enhanced_approval_requests.organization_id
    )
  );

CREATE POLICY "Creators and admins can update requests"
  ON enhanced_approval_requests FOR UPDATE
  TO authenticated
  USING (
    requested_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = enhanced_approval_requests.organization_id
      AND profiles.role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Users can view actions for accessible requests"
  ON approval_actions_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enhanced_approval_requests ear
      WHERE ear.id = approval_actions_log.request_id
      AND (
        ear.requested_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = ear.organization_id
          AND profiles.role IN ('admin', 'vice_president')
        )
      )
    )
  );

CREATE POLICY "Approvers can create actions"
  ON approval_actions_log FOR INSERT
  TO authenticated
  WITH CHECK (approver_id = auth.uid());

CREATE POLICY "Users can view comments for accessible requests"
  ON request_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enhanced_approval_requests ear
      WHERE ear.id = request_comments.request_id
      AND (
        ear.requested_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.organization_id = ear.organization_id
        )
      )
    ) AND (
      is_internal = false OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'vice_president')
      )
    )
  );

CREATE POLICY "Users can create comments"
  ON request_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM enhanced_approval_requests ear
      WHERE ear.id = request_comments.request_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.organization_id = ear.organization_id
      )
    )
  );

CREATE POLICY "Users can update their own comments"
  ON request_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_org ON workflow_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_steps_template ON workflow_template_steps(template_id, step_order);
CREATE INDEX IF NOT EXISTS idx_enhanced_requests_org_status ON enhanced_approval_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_requests_requested_by ON enhanced_approval_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_enhanced_requests_entity ON enhanced_approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_log_request ON approval_actions_log(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_request_comments_request ON request_comments(request_id, created_at);