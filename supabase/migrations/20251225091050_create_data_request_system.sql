/*
  # Data Request System - Dynamic Form & Task Management

  1. New Tables
    - `data_request_templates`
      - Reusable form templates (Envanter Formu, Personel Verileri, etc.)
      - Includes template name, description, category
      - Can be marked as active/inactive
      
    - `data_request_template_fields`
      - Dynamic form fields for each template
      - Supports multiple field types (text, number, date, select, multi-select, file)
      - Field configuration (required, validation rules, options)
      - Ordering support
      
    - `data_requests`
      - Actual data requests created from templates or custom
      - Title, description, deadline
      - Status tracking (draft, sent, in_progress, completed, cancelled)
      - Priority levels
      - Created by admin/director
      
    - `data_request_assignments`
      - Which departments/users need to respond
      - Individual status tracking per assignment
      - Due dates and reminders
      
    - `data_request_submissions`
      - Responses from departments
      - Status (draft, submitted, approved, rejected, revision_requested)
      - Version control
      - Approval workflow
      
    - `data_request_submission_values`
      - Actual field values for each submission
      - Supports all field types
      - File attachments support

  2. Security
    - Enable RLS on all tables
    - Admins can manage templates and requests
    - Directors can create requests and view responses
    - Users can view assigned requests and submit responses
    - Department-based access control
*/

-- Data Request Templates (Form Şablonları)
CREATE TABLE IF NOT EXISTS data_request_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_request_templates_org ON data_request_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_request_templates_active ON data_request_templates(organization_id, is_active);

-- Template Fields (Form Alanları)
CREATE TABLE IF NOT EXISTS data_request_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES data_request_templates(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select', 'checkbox', 'file', 'url', 'email', 'phone')),
  is_required boolean DEFAULT false,
  field_order integer DEFAULT 0,
  placeholder text,
  help_text text,
  validation_rules jsonb DEFAULT '{}',
  field_options jsonb DEFAULT '[]',
  default_value text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_fields_template ON data_request_template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_order ON data_request_template_fields(template_id, field_order);

-- Data Requests (Veri Talepleri)
CREATE TABLE IF NOT EXISTS data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES data_request_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'cancelled')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_org ON data_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_data_requests_deadline ON data_requests(deadline);
CREATE INDEX IF NOT EXISTS idx_data_requests_created_by ON data_requests(created_by);

-- Request Custom Fields (if not using template)
CREATE TABLE IF NOT EXISTS data_request_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES data_requests(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select', 'checkbox', 'file', 'url', 'email', 'phone')),
  is_required boolean DEFAULT false,
  field_order integer DEFAULT 0,
  placeholder text,
  help_text text,
  validation_rules jsonb DEFAULT '{}',
  field_options jsonb DEFAULT '[]',
  default_value text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_custom_fields_request ON data_request_custom_fields(request_id);
CREATE INDEX IF NOT EXISTS idx_request_custom_fields_order ON data_request_custom_fields(request_id, field_order);

-- Request Assignments (Kime Gönderildi)
CREATE TABLE IF NOT EXISTS data_request_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES data_requests(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'in_progress', 'submitted', 'completed')),
  due_date timestamptz,
  viewed_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT assignment_target_check CHECK (
    (department_id IS NOT NULL AND assigned_to IS NULL) OR
    (department_id IS NULL AND assigned_to IS NOT NULL) OR
    (department_id IS NOT NULL AND assigned_to IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_request_assignments_request ON data_request_assignments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_assignments_dept ON data_request_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_request_assignments_user ON data_request_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_request_assignments_status ON data_request_assignments(status);

-- Submissions (Gönderilen Cevaplar)
CREATE TABLE IF NOT EXISTS data_request_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES data_request_assignments(id) ON DELETE CASCADE NOT NULL,
  request_id uuid REFERENCES data_requests(id) ON DELETE CASCADE NOT NULL,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested')),
  version integer DEFAULT 1,
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON data_request_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_request ON data_request_submissions(request_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON data_request_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_dept ON data_request_submissions(department_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON data_request_submissions(status);

-- Submission Values (Form Alan Değerleri)
CREATE TABLE IF NOT EXISTS data_request_submission_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES data_request_submissions(id) ON DELETE CASCADE NOT NULL,
  field_id uuid,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL,
  value_text text,
  value_number numeric,
  value_date timestamptz,
  value_boolean boolean,
  value_json jsonb,
  file_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_values_submission ON data_request_submission_values(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_values_field ON data_request_submission_values(field_id);

-- RLS Policies

-- Templates
ALTER TABLE data_request_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to templates"
  ON data_request_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Admins can manage templates in their org"
  ON data_request_templates FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can view active templates in their org"
  ON data_request_templates FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Template Fields
ALTER TABLE data_request_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to template fields"
  ON data_request_template_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Users can view fields of accessible templates"
  ON data_request_template_fields FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM data_request_templates
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage fields in their org templates"
  ON data_request_template_fields FOR ALL
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM data_request_templates
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'director')
      )
    )
  );

-- Data Requests
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to requests"
  ON data_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Admins can manage requests in their org"
  ON data_requests FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can view requests assigned to them"
  ON data_requests FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT request_id FROM data_request_assignments
      WHERE assigned_to = auth.uid()
      OR department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Custom Fields
ALTER TABLE data_request_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to custom fields"
  ON data_request_custom_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Users can view custom fields of accessible requests"
  ON data_request_custom_fields FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage custom fields in their org"
  ON data_request_custom_fields FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'director')
      )
    )
  );

-- Assignments
ALTER TABLE data_request_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to assignments"
  ON data_request_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Admins can manage assignments in their org"
  ON data_request_assignments FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'director')
      )
    )
  );

CREATE POLICY "Users can view and update their assignments"
  ON data_request_assignments FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their assignment status"
  ON data_request_assignments FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Submissions
ALTER TABLE data_request_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to submissions"
  ON data_request_submissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Admins can view submissions in their org"
  ON data_request_submissions FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'director')
      )
    )
  );

CREATE POLICY "Users can manage their own submissions"
  ON data_request_submissions FOR ALL
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update submission status"
  ON data_request_submissions FOR UPDATE
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'director')
      )
    )
  );

-- Submission Values
ALTER TABLE data_request_submission_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to submission values"
  ON data_request_submission_values FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Users can view values of accessible submissions"
  ON data_request_submission_values FOR SELECT
  TO authenticated
  USING (
    submission_id IN (
      SELECT id FROM data_request_submissions
      WHERE submitted_by = auth.uid()
      OR department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      OR request_id IN (
        SELECT id FROM data_requests
        WHERE organization_id IN (
          SELECT organization_id FROM profiles
          WHERE id = auth.uid() AND role IN ('admin', 'director')
        )
      )
    )
  );

CREATE POLICY "Users can manage values of their submissions"
  ON data_request_submission_values FOR ALL
  TO authenticated
  USING (
    submission_id IN (
      SELECT id FROM data_request_submissions
      WHERE submitted_by = auth.uid()
      OR department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_data_request_templates_updated_at
  BEFORE UPDATE ON data_request_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_requests_updated_at
  BEFORE UPDATE ON data_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_request_assignments_updated_at
  BEFORE UPDATE ON data_request_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_request_submissions_updated_at
  BEFORE UPDATE ON data_request_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_request_submission_values_updated_at
  BEFORE UPDATE ON data_request_submission_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();