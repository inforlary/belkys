/*
  # External Audit Module (Dış Denetim Modülü)

  ## Overview
  Tracks external audits from Sayıştay, Independent Auditors, and regulatory bodies.

  ## New Tables
  1. external_audit_bodies - External audit organizations
  2. external_audits - Audit engagements
  3. external_audit_findings - Findings
  4. external_audit_responses - Management responses
  5. external_audit_corrective_actions - Corrective actions
  6. external_audit_correspondence - Communications
  7. external_audit_documents - Documents

  ## Security
  - RLS enabled with admin/auditor access
*/

CREATE TABLE IF NOT EXISTS external_audit_bodies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_code text NOT NULL UNIQUE,
  body_name text NOT NULL,
  body_type text NOT NULL CHECK (body_type IN ('court_of_accounts', 'independent_auditor', 'regulatory', 'ministry', 'other')),
  description text,
  contact_person text,
  contact_email text,
  contact_phone text,
  address text,
  website text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  external_audit_body_id uuid NOT NULL REFERENCES external_audit_bodies(id) ON DELETE RESTRICT,
  audit_code text NOT NULL,
  audit_title text NOT NULL,
  audit_type text NOT NULL CHECK (audit_type IN ('financial', 'compliance', 'performance', 'it', 'special', 'follow_up')),
  audit_scope text NOT NULL,
  coverage_period_start date,
  coverage_period_end date,
  notification_date date,
  start_date date,
  fieldwork_end_date date,
  draft_report_date date,
  final_report_date date,
  lead_auditor_name text,
  audit_team jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'notified' CHECK (status IN ('notified', 'planning', 'fieldwork', 'draft_report', 'management_response', 'final_report', 'closed')),
  overall_opinion text CHECK (overall_opinion IN ('unqualified', 'qualified', 'adverse', 'disclaimer', 'satisfactory', 'needs_improvement')),
  total_findings integer DEFAULT 0,
  critical_findings integer DEFAULT 0,
  high_findings integer DEFAULT 0,
  medium_findings integer DEFAULT 0,
  low_findings integer DEFAULT 0,
  coordinator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, audit_code)
);

CREATE TABLE IF NOT EXISTS external_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_audit_id uuid NOT NULL REFERENCES external_audits(id) ON DELETE CASCADE,
  finding_code text NOT NULL,
  finding_title text NOT NULL,
  finding_category text NOT NULL CHECK (finding_category IN ('financial', 'compliance', 'operational', 'governance', 'it', 'other')),
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  finding_description text NOT NULL,
  criteria_reference text,
  amount_involved numeric,
  currency text DEFAULT 'TRY',
  affected_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  affected_process_id uuid REFERENCES ic_processes(id) ON DELETE SET NULL,
  root_cause_analysis text,
  potential_impact text,
  auditor_recommendation text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'response_submitted', 'under_review', 'resolved', 'closed', 'disputed')),
  due_date date,
  responsible_person_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  internal_audit_finding_id uuid REFERENCES internal_audit_findings(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, finding_code)
);

CREATE TABLE IF NOT EXISTS external_audit_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_audit_finding_id uuid NOT NULL REFERENCES external_audit_findings(id) ON DELETE CASCADE,
  response_type text NOT NULL CHECK (response_type IN ('initial', 'supplementary', 'final', 'clarification')),
  response_date date NOT NULL,
  response_text text NOT NULL,
  management_position text CHECK (management_position IN ('agree', 'partially_agree', 'disagree')),
  justification text,
  proposed_action text,
  target_completion_date date,
  estimated_cost numeric,
  resources_required text,
  prepared_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  submitted_to_auditor boolean DEFAULT false,
  submission_date date,
  auditor_acceptance text CHECK (auditor_acceptance IN ('accepted', 'partially_accepted', 'rejected', 'pending')),
  auditor_comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_audit_corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_audit_finding_id uuid NOT NULL REFERENCES external_audit_findings(id) ON DELETE CASCADE,
  action_code text NOT NULL,
  action_description text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('immediate', 'short_term', 'long_term', 'preventive', 'detective')),
  responsible_person_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responsible_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  planned_start_date date,
  planned_completion_date date NOT NULL,
  actual_start_date date,
  actual_completion_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'delayed', 'cancelled')),
  progress_percentage numeric DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status_update text,
  completion_evidence text,
  verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verification_date date,
  verification_notes text,
  ic_capa_id uuid REFERENCES ic_capas(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(external_audit_finding_id, action_code)
);

CREATE TABLE IF NOT EXISTS external_audit_correspondence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_audit_id uuid NOT NULL REFERENCES external_audits(id) ON DELETE CASCADE,
  correspondence_code text NOT NULL,
  correspondence_type text NOT NULL CHECK (correspondence_type IN ('incoming', 'outgoing')),
  document_type text NOT NULL CHECK (document_type IN ('notification', 'request', 'response', 'report', 'meeting_minutes', 'clarification', 'other')),
  subject text NOT NULL,
  correspondence_date date NOT NULL,
  sender text,
  recipient text,
  summary text,
  received_date date,
  response_due_date date,
  response_sent_date date,
  reference_number text,
  handled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'responded', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, correspondence_code)
);

CREATE TABLE IF NOT EXISTS external_audit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_audit_id uuid NOT NULL REFERENCES external_audits(id) ON DELETE CASCADE,
  external_audit_finding_id uuid REFERENCES external_audit_findings(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('audit_plan', 'fieldwork_notes', 'draft_report', 'final_report', 'management_response', 'corrective_action_plan', 'evidence', 'correspondence', 'other')),
  document_date date,
  file_path text,
  file_size_kb numeric,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  description text,
  is_confidential boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_audits_org_period ON external_audits(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_external_audits_body ON external_audits(external_audit_body_id);
CREATE INDEX IF NOT EXISTS idx_external_findings_org ON external_audit_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_findings_audit ON external_audit_findings(external_audit_id);
CREATE INDEX IF NOT EXISTS idx_external_findings_dept ON external_audit_findings(affected_department_id);
CREATE INDEX IF NOT EXISTS idx_external_responses_finding ON external_audit_responses(external_audit_finding_id);
CREATE INDEX IF NOT EXISTS idx_external_actions_finding ON external_audit_corrective_actions(external_audit_finding_id);
CREATE INDEX IF NOT EXISTS idx_external_correspondence_org ON external_audit_correspondence(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_correspondence_audit ON external_audit_correspondence(external_audit_id);
CREATE INDEX IF NOT EXISTS idx_external_documents_org ON external_audit_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_documents_audit ON external_audit_documents(external_audit_id);

ALTER TABLE external_audit_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audit_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audit_corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audit_correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audit_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_select_audit_bodies" ON external_audit_bodies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_audit_bodies" ON external_audit_bodies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_external_audits" ON external_audits FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "admin_all_external_audits" ON external_audits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = external_audits.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_external_findings" ON external_audit_findings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "admin_all_external_findings" ON external_audit_findings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = external_audit_findings.organization_id AND role IN ('admin', 'auditor', 'director')));

CREATE POLICY "org_select_external_responses" ON external_audit_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM external_audit_findings f JOIN profiles pr ON pr.organization_id = f.organization_id WHERE f.id = external_audit_responses.external_audit_finding_id AND pr.id = auth.uid()));
CREATE POLICY "admin_all_external_responses" ON external_audit_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM external_audit_findings f JOIN profiles pr ON pr.organization_id = f.organization_id WHERE f.id = external_audit_responses.external_audit_finding_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor', 'director')));

CREATE POLICY "org_select_external_actions" ON external_audit_corrective_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM external_audit_findings f JOIN profiles pr ON pr.organization_id = f.organization_id WHERE f.id = external_audit_corrective_actions.external_audit_finding_id AND pr.id = auth.uid()));
CREATE POLICY "admin_all_external_actions" ON external_audit_corrective_actions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM external_audit_findings f JOIN profiles pr ON pr.organization_id = f.organization_id WHERE f.id = external_audit_corrective_actions.external_audit_finding_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor', 'director')));

CREATE POLICY "org_select_correspondence" ON external_audit_correspondence FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "admin_all_correspondence" ON external_audit_correspondence FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = external_audit_correspondence.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_external_documents" ON external_audit_documents FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "admin_all_external_documents" ON external_audit_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = external_audit_documents.organization_id AND role IN ('admin', 'auditor')));

CREATE OR REPLACE FUNCTION generate_external_audit_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text; body_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM external_audits WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  SELECT b.body_code INTO body_code FROM external_audit_bodies b WHERE b.id = NEW.external_audit_body_id;
  NEW.audit_code := org_code || '-EA-' || body_code || '-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_external_audit_code BEFORE INSERT ON external_audits FOR EACH ROW WHEN (NEW.audit_code IS NULL OR NEW.audit_code = '') EXECUTE FUNCTION generate_external_audit_code();

CREATE OR REPLACE FUNCTION generate_external_finding_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; audit_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM external_audit_findings WHERE external_audit_id = NEW.external_audit_id;
  SELECT ea.audit_code INTO audit_code FROM external_audits ea WHERE ea.id = NEW.external_audit_id;
  NEW.finding_code := audit_code || '-F' || LPAD(next_num::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_external_finding_code BEFORE INSERT ON external_audit_findings FOR EACH ROW WHEN (NEW.finding_code IS NULL OR NEW.finding_code = '') EXECUTE FUNCTION generate_external_finding_code();

CREATE OR REPLACE FUNCTION generate_external_action_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; finding_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM external_audit_corrective_actions WHERE external_audit_finding_id = NEW.external_audit_finding_id;
  SELECT f.finding_code INTO finding_code FROM external_audit_findings f WHERE f.id = NEW.external_audit_finding_id;
  NEW.action_code := finding_code || '-A' || LPAD(next_num::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_external_action_code BEFORE INSERT ON external_audit_corrective_actions FOR EACH ROW WHEN (NEW.action_code IS NULL OR NEW.action_code = '') EXECUTE FUNCTION generate_external_action_code();

CREATE OR REPLACE FUNCTION generate_correspondence_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM external_audit_correspondence WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.correspondence_code := org_code || '-CORR-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_correspondence_code BEFORE INSERT ON external_audit_correspondence FOR EACH ROW WHEN (NEW.correspondence_code IS NULL OR NEW.correspondence_code = '') EXECUTE FUNCTION generate_correspondence_code();

INSERT INTO external_audit_bodies (body_code, body_name, body_type, description) VALUES
  ('SAY', 'Sayıştay (Turkish Court of Accounts)', 'court_of_accounts', 'Supreme audit institution of Turkey'),
  ('YMM', 'Bağımsız Denetim Firması (Independent Auditor)', 'independent_auditor', 'Independent external audit firms'),
  ('MB', 'Maliye Bakanlığı (Ministry of Treasury and Finance)', 'ministry', 'Ministry financial audits'),
  ('ICK', 'İç Kontrol ve Ön Mali Kontrole İlişkin Usul ve Esaslar', 'regulatory', 'Internal control regulatory audits')
ON CONFLICT (body_code) DO NOTHING;