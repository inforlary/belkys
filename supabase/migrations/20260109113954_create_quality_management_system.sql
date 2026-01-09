/*
  # Create Quality Management System

  1. New Tables
    - `quality_processes`
      - Process definitions with inputs, outputs, owner
      - Links to risks and documents
    - `quality_documents`
      - Document management (procedures, instructions, forms)
      - Revision history, approval status
    - `quality_dof`
      - Corrective/Preventive Actions (DÖF - Düzeltici/Önleyici Faaliyet)
      - Root cause analysis, action plans, effectiveness evaluation
    - `quality_dof_actions`
      - Actions associated with DOF records
    - `quality_audits`
      - Internal audit planning and execution
    - `quality_audit_findings`
      - Audit findings linked to DOF records
    - `quality_customer_surveys`
      - Customer satisfaction survey definitions
    - `quality_customer_feedback`
      - Customer complaints and suggestions
    - `quality_survey_responses`
      - Survey response records

  2. Security
    - Enable RLS on all tables
    - Policies for organization-based access
    - Admin and user-specific permissions
*/

-- Quality Processes
CREATE TABLE IF NOT EXISTS quality_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  inputs text,
  outputs text,
  owner_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  parent_process_id uuid REFERENCES quality_processes(id) ON DELETE SET NULL,
  performance_indicators jsonb DEFAULT '[]',
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'under_review')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Quality Documents
CREATE TABLE IF NOT EXISTS quality_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('procedure', 'instruction', 'form', 'record', 'other')),
  revision_number text DEFAULT '1.0',
  revision_date date,
  description text,
  content text,
  file_url text,
  approval_status text DEFAULT 'draft' CHECK (approval_status IN ('draft', 'approved', 'cancelled', 'obsolete')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  distribution_list jsonb DEFAULT '[]',
  related_process_id uuid REFERENCES quality_processes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code, revision_number)
);

-- Quality DOF (Corrective/Preventive Actions)
CREATE TABLE IF NOT EXISTS quality_dof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  dof_number text NOT NULL,
  dof_type text NOT NULL CHECK (dof_type IN ('corrective', 'preventive')),
  title text NOT NULL,
  source text CHECK (source IN ('audit', 'complaint', 'internal_finding', 'observation', 'other')),
  description text,
  nonconformity_description text,
  process_id uuid REFERENCES quality_processes(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  root_cause_analysis text,
  root_cause_method text CHECK (root_cause_method IN ('5why', 'fishbone', 'pareto', 'other')),
  action_plan text,
  responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  implementation_date date,
  evidence text,
  effectiveness_evaluation text,
  effectiveness_status text CHECK (effectiveness_status IN ('pending', 'effective', 'not_effective')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled')),
  linked_audit_finding_id uuid,
  linked_ic_action_id uuid,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, dof_number)
);

-- Quality DOF Actions
CREATE TABLE IF NOT EXISTS quality_dof_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dof_id uuid REFERENCES quality_dof(id) ON DELETE CASCADE NOT NULL,
  action_description text NOT NULL,
  responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  completion_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Quality Audits
CREATE TABLE IF NOT EXISTS quality_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  audit_code text NOT NULL,
  title text NOT NULL,
  audit_type text CHECK (audit_type IN ('process', 'department', 'system', 'supplier', 'other')),
  scope text,
  audit_date date,
  audit_start_date date,
  audit_end_date date,
  audited_process_id uuid REFERENCES quality_processes(id) ON DELETE SET NULL,
  audited_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  lead_auditor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  audit_team jsonb DEFAULT '[]',
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  report_url text,
  findings_summary text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, audit_code)
);

-- Quality Audit Findings
CREATE TABLE IF NOT EXISTS quality_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES quality_audits(id) ON DELETE CASCADE NOT NULL,
  finding_type text NOT NULL CHECK (finding_type IN ('nonconformity', 'observation', 'improvement')),
  severity text CHECK (severity IN ('major', 'minor', 'low')),
  description text NOT NULL,
  process_id uuid REFERENCES quality_processes(id) ON DELETE SET NULL,
  clause_reference text,
  evidence text,
  linked_dof_id uuid REFERENCES quality_dof(id) ON DELETE SET NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Quality Customer Surveys
CREATE TABLE IF NOT EXISTS quality_customer_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  survey_type text CHECK (survey_type IN ('satisfaction', 'feedback', 'nps', 'other')),
  questions jsonb DEFAULT '[]',
  period_start date,
  period_end date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Quality Customer Feedback
CREATE TABLE IF NOT EXISTS quality_customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  feedback_number text NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('complaint', 'suggestion', 'compliment', 'inquiry')),
  customer_name text,
  customer_email text,
  customer_phone text,
  subject text NOT NULL,
  description text NOT NULL,
  received_date date DEFAULT CURRENT_DATE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  priority text CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution text,
  resolution_date date,
  linked_dof_id uuid REFERENCES quality_dof(id) ON DELETE SET NULL,
  satisfaction_score integer CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, feedback_number)
);

-- Quality Survey Responses
CREATE TABLE IF NOT EXISTS quality_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES quality_customer_surveys(id) ON DELETE CASCADE NOT NULL,
  respondent_name text,
  respondent_email text,
  responses jsonb DEFAULT '{}',
  overall_score numeric,
  submitted_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quality_processes_org ON quality_processes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_processes_owner ON quality_processes(owner_department_id);
CREATE INDEX IF NOT EXISTS idx_quality_documents_org ON quality_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_documents_process ON quality_documents(related_process_id);
CREATE INDEX IF NOT EXISTS idx_quality_dof_org ON quality_dof(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_dof_status ON quality_dof(status);
CREATE INDEX IF NOT EXISTS idx_quality_dof_process ON quality_dof(process_id);
CREATE INDEX IF NOT EXISTS idx_quality_audits_org ON quality_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_audits_date ON quality_audits(audit_date);
CREATE INDEX IF NOT EXISTS idx_quality_feedback_org ON quality_customer_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_feedback_status ON quality_customer_feedback(status);

-- Enable RLS
ALTER TABLE quality_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_dof ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_dof_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_customer_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_survey_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quality_processes
CREATE POLICY "Users can view processes in their organization"
  ON quality_processes FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage processes"
  ON quality_processes FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for quality_documents
CREATE POLICY "Users can view documents in their organization"
  ON quality_documents FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage documents"
  ON quality_documents FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for quality_dof
CREATE POLICY "Users can view DOF in their organization"
  ON quality_dof FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create DOF"
  ON quality_dof FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their DOF or admins can update all"
  ON quality_dof FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR responsible_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- RLS Policies for quality_dof_actions
CREATE POLICY "Users can view DOF actions"
  ON quality_dof_actions FOR SELECT
  TO authenticated
  USING (
    dof_id IN (
      SELECT id FROM quality_dof
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can manage DOF actions"
  ON quality_dof_actions FOR ALL
  TO authenticated
  USING (
    dof_id IN (
      SELECT id FROM quality_dof
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- RLS Policies for quality_audits
CREATE POLICY "Users can view audits in their organization"
  ON quality_audits FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage audits"
  ON quality_audits FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for quality_audit_findings
CREATE POLICY "Users can view audit findings"
  ON quality_audit_findings FOR SELECT
  TO authenticated
  USING (
    audit_id IN (
      SELECT id FROM quality_audits
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Auditors can manage findings"
  ON quality_audit_findings FOR ALL
  TO authenticated
  USING (
    audit_id IN (
      SELECT id FROM quality_audits
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- RLS Policies for quality_customer_surveys
CREATE POLICY "Users can view surveys in their organization"
  ON quality_customer_surveys FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage surveys"
  ON quality_customer_surveys FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for quality_customer_feedback
CREATE POLICY "Users can view feedback in their organization"
  ON quality_customer_feedback FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create feedback"
  ON quality_customer_feedback FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update assigned feedback or admins can update all"
  ON quality_customer_feedback FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- RLS Policies for quality_survey_responses
CREATE POLICY "Users can view survey responses"
  ON quality_survey_responses FOR SELECT
  TO authenticated
  USING (
    survey_id IN (
      SELECT id FROM quality_customer_surveys
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Anyone can submit survey responses"
  ON quality_survey_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);
