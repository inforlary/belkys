/*
  # Corporate Process Management System (BPM)

  ## Overview
  Complete process management module with hierarchical structure, approval workflows,
  and integration with Risk Management, Strategic Planning, and Workflow modules.

  ## New Tables

  1. `bpm_categories`
     - Manages process categories (editable)
     - Fields: id, organization_id, code, name, color, icon, description, sort_order
     - Default categories: YON (Yönetsel), ANA (Ana), DST (Destek), IZL (İzleme)

  2. `bpm_processes`
     - Main process table with hierarchical structure
     - Fields: Basic info, hierarchy, details, inputs/outputs, resources, approvals, revisions
     - Parent-child relationship for hierarchy
     - Approval workflow: draft → pending_approval → approved/rejected → active/inactive

  3. `bpm_process_regulations`
     - Legal basis for processes (many-to-many)
     - Links processes to regulations (Kanun, Yönetmelik, etc.)

  4. `bpm_process_risks`
     - Process-Risk relationship (many-to-many)
     - Integration with Risk Management module

  5. `bpm_process_documents`
     - Document attachments for processes
     - Storage bucket integration

  6. `bpm_process_history`
     - Revision history tracking
     - JSON storage of old data for comparison

  7. `bpm_approval_logs`
     - Audit trail for approval actions
     - Tracks submissions, approvals, rejections, activations

  ## Security
  - RLS enabled on all tables
  - Role-based access: super_admin, admin, director, vice_president, user
  - Department-based data isolation
  - Status-based operation controls

  ## Functions
  - Auto code generation for processes
  - Hierarchy path management
  - Level calculation
  - Default categories seeding
*/

-- =====================================================
-- 1. BPM Categories Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (length(code) = 3),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  icon text NOT NULL DEFAULT 'folder',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Indexes for bpm_categories
CREATE INDEX idx_bpm_categories_org ON bpm_categories(organization_id);
CREATE INDEX idx_bpm_categories_sort ON bpm_categories(organization_id, sort_order);

-- RLS for bpm_categories
ALTER TABLE bpm_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_bpm_categories" ON bpm_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "users_view_own_org_bpm_categories" ON bpm_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_categories.organization_id
    )
  );

CREATE POLICY "admins_manage_bpm_categories" ON bpm_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_categories.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

-- =====================================================
-- 2. BPM Processes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic Information
  code text NOT NULL,
  name text NOT NULL,
  description text,

  -- Hierarchy
  parent_id uuid REFERENCES bpm_processes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES bpm_categories(id) ON DELETE RESTRICT,
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 4),
  hierarchy_path text,

  -- Process Details
  purpose text,
  scope text,
  start_event text,
  end_event text,

  -- Inputs and Outputs (JSON arrays)
  inputs jsonb DEFAULT '[]'::jsonb,
  outputs jsonb DEFAULT '[]'::jsonb,

  -- Resources
  human_resource text,
  technological_resource text,
  financial_resource text,

  -- Responsibilities
  owner_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  responsible_person_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Strategic Integration
  strategic_goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  workflow_process_id uuid REFERENCES workflow_processes(id) ON DELETE SET NULL,

  -- Approval Workflow
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'rejected', 'active', 'inactive')
  ),
  submitted_by uuid REFERENCES profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,

  -- Revision Management
  revision_no integer NOT NULL DEFAULT 1,
  revision_date timestamptz DEFAULT now(),
  revision_notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, code)
);

-- Indexes for bpm_processes
CREATE INDEX idx_bpm_processes_org ON bpm_processes(organization_id);
CREATE INDEX idx_bpm_processes_category ON bpm_processes(category_id);
CREATE INDEX idx_bpm_processes_parent ON bpm_processes(parent_id);
CREATE INDEX idx_bpm_processes_status ON bpm_processes(status);
CREATE INDEX idx_bpm_processes_dept ON bpm_processes(owner_department_id);
CREATE INDEX idx_bpm_processes_goal ON bpm_processes(strategic_goal_id);
CREATE INDEX idx_bpm_processes_workflow ON bpm_processes(workflow_process_id);
CREATE INDEX idx_bpm_processes_code ON bpm_processes(organization_id, code);

-- RLS for bpm_processes
ALTER TABLE bpm_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_bpm_processes" ON bpm_processes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "users_view_own_org_bpm_processes" ON bpm_processes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_processes.organization_id
    )
  );

CREATE POLICY "users_insert_own_dept_bpm_processes" ON bpm_processes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_processes.organization_id
      AND (
        profiles.role IN ('admin', 'director', 'super_admin')
        OR profiles.department_id = bpm_processes.owner_department_id
      )
    )
  );

CREATE POLICY "users_update_own_dept_bpm_processes" ON bpm_processes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_processes.organization_id
      AND (
        profiles.role IN ('admin', 'super_admin')
        OR (profiles.role = 'director' AND profiles.department_id = bpm_processes.owner_department_id)
        OR (bpm_processes.created_by = auth.uid() AND bpm_processes.status IN ('draft', 'rejected'))
      )
    )
  );

CREATE POLICY "admins_delete_bpm_processes" ON bpm_processes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_processes.organization_id
      AND profiles.role IN ('admin', 'director', 'super_admin')
    )
    AND bpm_processes.status IN ('draft', 'rejected')
  );

-- =====================================================
-- 3. BPM Process Regulations Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_process_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES bpm_processes(id) ON DELETE CASCADE,
  regulation_type text NOT NULL CHECK (
    regulation_type IN ('Kanun', 'Yönetmelik', 'Tüzük', 'Genelge', 'Tebliğ', 'Diğer')
  ),
  name text NOT NULL,
  related_articles text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

CREATE INDEX idx_bpm_regulations_process ON bpm_process_regulations(process_id);

ALTER TABLE bpm_process_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_regulations_via_process" ON bpm_process_regulations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_regulations.process_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "users_manage_regulations_via_process" ON bpm_process_regulations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_regulations.process_id
      AND pr.id = auth.uid()
      AND (
        pr.role IN ('admin', 'super_admin')
        OR (pr.role = 'director' AND pr.department_id = p.owner_department_id)
        OR (p.created_by = auth.uid() AND p.status IN ('draft', 'rejected'))
      )
    )
  );

-- =====================================================
-- 4. BPM Process Risks Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_process_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES bpm_processes(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(process_id, risk_id)
);

CREATE INDEX idx_bpm_process_risks_process ON bpm_process_risks(process_id);
CREATE INDEX idx_bpm_process_risks_risk ON bpm_process_risks(risk_id);

ALTER TABLE bpm_process_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_process_risks_via_process" ON bpm_process_risks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_risks.process_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "users_manage_process_risks_via_process" ON bpm_process_risks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_risks.process_id
      AND pr.id = auth.uid()
      AND (
        pr.role IN ('admin', 'super_admin')
        OR (pr.role = 'director' AND pr.department_id = p.owner_department_id)
        OR (p.created_by = auth.uid() AND p.status IN ('draft', 'rejected'))
      )
    )
  );

-- =====================================================
-- 5. BPM Process Documents Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_process_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES bpm_processes(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_url text NOT NULL,
  document_type text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES profiles(id)
);

CREATE INDEX idx_bpm_documents_process ON bpm_process_documents(process_id);

ALTER TABLE bpm_process_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_documents_via_process" ON bpm_process_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_documents.process_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "users_manage_documents_via_process" ON bpm_process_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_documents.process_id
      AND pr.id = auth.uid()
      AND (
        pr.role IN ('admin', 'super_admin')
        OR (pr.role = 'director' AND pr.department_id = p.owner_department_id)
        OR (p.created_by = auth.uid() AND p.status IN ('draft', 'rejected'))
      )
    )
  );

-- =====================================================
-- 6. BPM Process History Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_process_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES bpm_processes(id) ON DELETE CASCADE,
  revision_no integer NOT NULL,
  changed_by uuid REFERENCES profiles(id),
  changed_at timestamptz DEFAULT now(),
  change_description text,
  old_data jsonb
);

CREATE INDEX idx_bpm_history_process ON bpm_process_history(process_id);
CREATE INDEX idx_bpm_history_revision ON bpm_process_history(process_id, revision_no);

ALTER TABLE bpm_process_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_history_via_process" ON bpm_process_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_process_history.process_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "system_insert_history" ON bpm_process_history
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 7. BPM Approval Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS bpm_approval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES bpm_processes(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN ('submitted', 'approved', 'rejected', 'activated', 'deactivated', 'revised')
  ),
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz DEFAULT now(),
  notes text
);

CREATE INDEX idx_bpm_logs_process ON bpm_approval_logs(process_id);
CREATE INDEX idx_bpm_logs_action ON bpm_approval_logs(action);

ALTER TABLE bpm_approval_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_logs_via_process" ON bpm_approval_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bpm_processes p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = bpm_approval_logs.process_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "system_insert_logs" ON bpm_approval_logs
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 8. Storage Bucket for Process Documents
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('bpm-documents', 'bpm-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "users_view_own_org_bpm_documents" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'bpm-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "users_upload_bpm_documents" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'bpm-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "users_delete_own_bpm_documents" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'bpm-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- =====================================================
-- 9. Functions for Auto Code Generation
-- =====================================================

-- Function to generate next process code
CREATE OR REPLACE FUNCTION generate_bpm_process_code(
  p_organization_id uuid,
  p_category_code text,
  p_parent_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_code text;
  v_parent_level integer;
  v_max_sequence integer;
  v_new_code text;
BEGIN
  -- If no parent, generate level 1 code
  IF p_parent_id IS NULL THEN
    -- Find max sequence for this category at level 1
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(code FROM LENGTH(p_category_code) + 2)
        AS integer
      )
    ), 0)
    INTO v_max_sequence
    FROM bpm_processes
    WHERE organization_id = p_organization_id
    AND category_id = (
      SELECT id FROM bpm_categories
      WHERE organization_id = p_organization_id
      AND code = p_category_code
    )
    AND parent_id IS NULL;

    v_new_code := p_category_code || '.' || (v_max_sequence + 1);
  ELSE
    -- Get parent code and level
    SELECT code, level
    INTO v_parent_code, v_parent_level
    FROM bpm_processes
    WHERE id = p_parent_id;

    -- Find max sequence for children of this parent
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(code FROM LENGTH(v_parent_code) + 2)
        AS integer
      )
    ), 0)
    INTO v_max_sequence
    FROM bpm_processes
    WHERE parent_id = p_parent_id;

    v_new_code := v_parent_code || '.' || (v_max_sequence + 1);
  END IF;

  RETURN v_new_code;
END;
$$;

-- Function to update hierarchy path
CREATE OR REPLACE FUNCTION update_bpm_process_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_path text;
  v_parent_level integer;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 1;
    NEW.hierarchy_path := NEW.id::text;
  ELSE
    SELECT hierarchy_path, level
    INTO v_parent_path, v_parent_level
    FROM bpm_processes
    WHERE id = NEW.parent_id;

    NEW.level := v_parent_level + 1;
    NEW.hierarchy_path := v_parent_path || '/' || NEW.id::text;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_bpm_process_hierarchy
  BEFORE INSERT OR UPDATE ON bpm_processes
  FOR EACH ROW
  EXECUTE FUNCTION update_bpm_process_hierarchy();

-- Function to create approval log
CREATE OR REPLACE FUNCTION log_bpm_approval_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log submission
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'pending_approval' AND OLD.status = 'draft' THEN
      INSERT INTO bpm_approval_logs (process_id, action, performed_by, notes)
      VALUES (NEW.id, 'submitted', NEW.submitted_by, 'Process submitted for approval');
    ELSIF NEW.status = 'approved' AND OLD.status = 'pending_approval' THEN
      INSERT INTO bpm_approval_logs (process_id, action, performed_by, notes)
      VALUES (NEW.id, 'approved', NEW.reviewed_by, 'Process approved');
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending_approval' THEN
      INSERT INTO bpm_approval_logs (process_id, action, performed_by, notes)
      VALUES (NEW.id, 'rejected', NEW.reviewed_by, NEW.rejection_reason);
    ELSIF NEW.status = 'active' AND OLD.status = 'approved' THEN
      INSERT INTO bpm_approval_logs (process_id, action, performed_by)
      VALUES (NEW.id, 'activated', auth.uid());
    ELSIF NEW.status = 'inactive' AND OLD.status = 'active' THEN
      INSERT INTO bpm_approval_logs (process_id, action, performed_by)
      VALUES (NEW.id, 'deactivated', auth.uid());
    END IF;
  END IF;

  -- Log revision
  IF OLD.revision_no IS DISTINCT FROM NEW.revision_no THEN
    INSERT INTO bpm_process_history (
      process_id,
      revision_no,
      changed_by,
      change_description,
      old_data
    )
    VALUES (
      NEW.id,
      OLD.revision_no,
      auth.uid(),
      NEW.revision_notes,
      row_to_json(OLD)::jsonb
    );

    INSERT INTO bpm_approval_logs (process_id, action, performed_by, notes)
    VALUES (NEW.id, 'revised', auth.uid(), NEW.revision_notes);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_bpm_approval_log
  AFTER UPDATE ON bpm_processes
  FOR EACH ROW
  EXECUTE FUNCTION log_bpm_approval_action();

-- =====================================================
-- 10. Function to Seed Default Categories
-- =====================================================
CREATE OR REPLACE FUNCTION seed_default_bpm_categories(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default categories if they don't exist
  INSERT INTO bpm_categories (organization_id, code, name, color, icon, description, sort_order)
  VALUES
    (p_organization_id, 'YON', 'Yönetsel Süreçler', '#ef4444', 'briefcase', 'Kurumun yönetimi ve stratejik yönlendirilmesi ile ilgili süreçler', 1),
    (p_organization_id, 'ANA', 'Ana Süreçler', '#3b82f6', 'target', 'Kurumun asıl faaliyet alanı olan hizmet üretim süreçleri', 2),
    (p_organization_id, 'DST', 'Destek Süreçler', '#10b981', 'package', 'Ana süreçleri destekleyen idari ve teknik süreçler', 3),
    (p_organization_id, 'IZL', 'İzleme ve Ölçme Süreçleri', '#f59e0b', 'activity', 'Süreç performansının izlenmesi ve ölçülmesi süreçleri', 4)
  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$;

-- =====================================================
-- 11. Add module_process_management to organizations
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations'
    AND column_name = 'module_process_management'
  ) THEN
    ALTER TABLE organizations ADD COLUMN module_process_management boolean DEFAULT false;
  END IF;
END $$;