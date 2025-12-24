/*
  # Faaliyet Raporu Sistemi

  1. Yeni Tablolar
    - `activity_reports`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `department_id` (uuid, references departments)
      - `indicator_id` (uuid, references indicators)
      - `title` (text) - Rapor başlığı
      - `period_year` (integer) - Rapor yılı
      - `period_quarter` (integer) - Rapor çeyreği (opsiyonel)
      - `period_month` (integer) - Rapor ayı (opsiyonel)
      - `content` (jsonb) - Zengin içerik (metin, görseller, tablolar)
      - `status` (text) - draft, submitted, approved, rejected
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `submitted_at` (timestamptz)
      - `approved_at` (timestamptz)
      - `approved_by` (uuid, references profiles)
      - `rejection_reason` (text)

    - `activity_report_attachments`
      - `id` (uuid, primary key)
      - `report_id` (uuid, references activity_reports)
      - `file_name` (text)
      - `file_url` (text)
      - `file_type` (text)
      - `file_size` (integer)
      - `uploaded_by` (uuid, references profiles)
      - `created_at` (timestamptz)

  2. Güvenlik
    - RLS politikaları ile departman bazlı erişim kontrolü
    - Sadece kendi departmanının raporlarını görebilme
    - Admin tüm raporları görebilir ve onaylayabilir
*/

-- activity_reports tablosu
CREATE TABLE IF NOT EXISTS activity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  title text NOT NULL,
  period_year integer NOT NULL,
  period_quarter integer,
  period_month integer,
  content jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  CONSTRAINT valid_period CHECK (
    (period_quarter IS NULL AND period_month IS NULL) OR
    (period_quarter IS NOT NULL AND period_month IS NULL) OR
    (period_quarter IS NULL AND period_month IS NOT NULL)
  )
);

-- activity_report_attachments tablosu
CREATE TABLE IF NOT EXISTS activity_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- RLS'i etkinleştir
ALTER TABLE activity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_report_attachments ENABLE ROW LEVEL SECURITY;

-- activity_reports politikaları
CREATE POLICY "Users can view their department reports"
  ON activity_reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND (
        role = 'admin' OR 
        department_id = activity_reports.department_id
      )
    )
  );

CREATE POLICY "Users can create reports for their department"
  ON activity_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND department_id = activity_reports.department_id
    )
  );

CREATE POLICY "Users can update their department's draft reports"
  ON activity_reports FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND (
        role = 'admin' OR 
        (department_id = activity_reports.department_id AND activity_reports.status = 'draft')
      )
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND (
        role = 'admin' OR 
        (department_id = activity_reports.department_id AND activity_reports.status = 'draft')
      )
    )
  );

CREATE POLICY "Admins can delete reports"
  ON activity_reports FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND role = 'admin'
    )
  );

-- activity_report_attachments politikaları
CREATE POLICY "Users can view attachments of their department reports"
  ON activity_report_attachments FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT id FROM activity_reports
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin') OR
        department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can upload attachments to their department reports"
  ON activity_report_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    report_id IN (
      SELECT id FROM activity_reports
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own attachments"
  ON activity_report_attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin'
      AND organization_id IN (
        SELECT organization_id FROM activity_reports WHERE id = activity_report_attachments.report_id
      )
    )
  );

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_activity_reports_org ON activity_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_reports_dept ON activity_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_activity_reports_indicator ON activity_reports(indicator_id);
CREATE INDEX IF NOT EXISTS idx_activity_reports_status ON activity_reports(status);
CREATE INDEX IF NOT EXISTS idx_activity_reports_period ON activity_reports(period_year, period_quarter, period_month);
CREATE INDEX IF NOT EXISTS idx_activity_report_attachments_report ON activity_report_attachments(report_id);
