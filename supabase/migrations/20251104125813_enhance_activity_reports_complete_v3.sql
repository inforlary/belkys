/*
  # Faaliyet Raporu Sistemi - Gelişmiş Özellikler

  1. Yeni Tablolar
    - `activity_report_comments` - Yorum sistemi
    - `activity_report_versions` - Versiyon kontrolü  
    - `activity_report_templates` - Rapor şablonları
    - `activity_report_deadlines` - Son tarih yönetimi
    - `activity_report_workflow_stages` - İş akışı aşamaları
    - `activity_report_workflow_approvals` - Onay takibi
    - `activity_report_notifications` - Bildirim sistemi

  2. Mevcut Tabloya Eklenen Sütunlar
    - `activity_reports`: template_id, version, workflow_stage, is_late, rejection_count

  3. Güvenlik
    - Tüm tablolar için RLS
    - Departman ve rol bazlı erişim
*/

-- activity_report_comments
CREATE TABLE IF NOT EXISTS activity_report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  is_admin_comment boolean DEFAULT false,
  requires_revision boolean DEFAULT false,
  parent_comment_id uuid REFERENCES activity_report_comments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_comments_report ON activity_report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_user ON activity_report_comments(user_id);

-- activity_report_versions
CREATE TABLE IF NOT EXISTS activity_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  title text NOT NULL,
  changed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  change_description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(report_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_report_versions_report ON activity_report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_versions_number ON activity_report_versions(report_id, version_number DESC);

-- activity_report_templates
CREATE TABLE IF NOT EXISTS activity_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_fields jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_org ON activity_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_active ON activity_report_templates(organization_id, is_active);

-- activity_report_deadlines
CREATE TABLE IF NOT EXISTS activity_report_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('yearly', 'quarterly', 'monthly')),
  period_year integer NOT NULL,
  period_quarter integer,
  period_month integer,
  deadline_date date NOT NULL,
  reminder_days_before integer DEFAULT 7,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_deadlines_org ON activity_report_deadlines(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_deadlines_dept ON activity_report_deadlines(department_id);
CREATE INDEX IF NOT EXISTS idx_report_deadlines_period ON activity_report_deadlines(period_year, period_quarter, period_month);
CREATE INDEX IF NOT EXISTS idx_report_deadlines_date ON activity_report_deadlines(deadline_date);

-- activity_report_workflow_stages
CREATE TABLE IF NOT EXISTS activity_report_workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  stage_order integer NOT NULL,
  approver_role text NOT NULL CHECK (approver_role IN ('manager', 'vice_president', 'admin')),
  is_required boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, stage_order)
);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_org ON activity_report_workflow_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_order ON activity_report_workflow_stages(organization_id, stage_order);

-- activity_report_workflow_approvals
CREATE TABLE IF NOT EXISTS activity_report_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES activity_report_workflow_stages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approval_date timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(report_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_report ON activity_report_workflow_approvals(report_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON activity_report_workflow_approvals(status);

-- activity_report_notifications
CREATE TABLE IF NOT EXISTS activity_report_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_id uuid REFERENCES activity_reports(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('submitted', 'approved', 'rejected', 'commented', 'deadline_reminder', 'overdue')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_notifications_user ON activity_report_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_report_notifications_report ON activity_report_notifications(report_id);
CREATE INDEX IF NOT EXISTS idx_report_notifications_created ON activity_report_notifications(created_at DESC);

-- activity_reports yeni sütunlar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_reports' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE activity_reports ADD COLUMN template_id uuid REFERENCES activity_report_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_reports' AND column_name = 'version'
  ) THEN
    ALTER TABLE activity_reports ADD COLUMN version integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_reports' AND column_name = 'workflow_stage'
  ) THEN
    ALTER TABLE activity_reports ADD COLUMN workflow_stage integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_reports' AND column_name = 'is_late'
  ) THEN
    ALTER TABLE activity_reports ADD COLUMN is_late boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_reports' AND column_name = 'rejection_count'
  ) THEN
    ALTER TABLE activity_reports ADD COLUMN rejection_count integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_reports_template ON activity_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_activity_reports_workflow ON activity_reports(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_activity_reports_late ON activity_reports(is_late);

-- RLS - activity_report_comments
ALTER TABLE activity_report_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible reports"
  ON activity_report_comments FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT id FROM activity_reports
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
      AND (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager')) OR
        department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can add comments"
  ON activity_report_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments"
  ON activity_report_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON activity_report_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS - activity_report_versions
ALTER TABLE activity_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions"
  ON activity_report_versions FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT id FROM activity_reports
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can create versions"
  ON activity_report_versions FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- RLS - activity_report_templates
ALTER TABLE activity_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active templates"
  ON activity_report_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND is_active = true
  );

CREATE POLICY "Admins manage templates"
  ON activity_report_templates FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS - activity_report_deadlines
ALTER TABLE activity_report_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deadlines"
  ON activity_report_deadlines FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage deadlines"
  ON activity_report_deadlines FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS - activity_report_workflow_stages
ALTER TABLE activity_report_workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow stages"
  ON activity_report_workflow_stages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage workflow"
  ON activity_report_workflow_stages FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS - activity_report_workflow_approvals
ALTER TABLE activity_report_workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals"
  ON activity_report_workflow_approvals FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT id FROM activity_reports
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can create approvals"
  ON activity_report_workflow_approvals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update approvals"
  ON activity_report_workflow_approvals FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager'))
  );

-- RLS - activity_report_notifications
ALTER TABLE activity_report_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON activity_report_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System creates notifications"
  ON activity_report_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users update own notifications"
  ON activity_report_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON activity_report_notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());