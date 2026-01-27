/*
  # Hassas Görevler Yönetimi Sistemi

  Bu migration, belediyeler için hassas görev yönetimi ve rotasyon takibi sistemini oluşturur.

  ## 1. Yeni Tablolar
  
  ### `sensitive_tasks` - Hassas Görevler
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `workflow_id` (uuid, foreign key) - Hangi iş akışından geldiği
  - `workflow_step_id` (uuid, foreign key) - Hangi adımdan geldiği
  - `task_name` (text) - Görev adı
  - `process_name` (text) - Süreç adı
  - `department_id` (uuid, foreign key) - Sorumlu birim
  - `assigned_primary_id` (uuid, foreign key) - Asil personel
  - `assigned_backup_id` (uuid, foreign key) - Yedek personel
  - `rotation_period` (text) - Rotasyon periyodu: monthly, quarterly, semi_annual, annual
  - `last_rotation_date` (timestamptz) - Son rotasyon tarihi
  - `next_rotation_date` (timestamptz) - Sonraki rotasyon tarihi
  - `status` (text) - Durum: normal, rotation_due, rotation_overdue, awaiting_assignment
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `task_rotation_history` - Rotasyon Geçmişi
  - `id` (uuid, primary key)
  - `sensitive_task_id` (uuid, foreign key)
  - `action_type` (text) - İşlem tipi: initial_assignment, rotation, postponement
  - `action_date` (timestamptz)
  - `previous_primary_id` (uuid, foreign key)
  - `new_primary_id` (uuid, foreign key)
  - `previous_backup_id` (uuid, foreign key)
  - `new_backup_id` (uuid, foreign key)
  - `notes` (text) - Açıklama
  - `performed_by` (uuid, foreign key) - İşlemi yapan kullanıcı
  - `created_at` (timestamptz)

  ### `task_postponements` - Erteleme Kayıtları
  - `id` (uuid, primary key)
  - `sensitive_task_id` (uuid, foreign key)
  - `postponement_reason` (text) - Erteleme sebebi
  - `postponement_duration` (integer) - Erteleme süresi (gün)
  - `original_due_date` (timestamptz) - Orijinal bitiş tarihi
  - `new_due_date` (timestamptz) - Yeni bitiş tarihi
  - `approved_by` (uuid, foreign key)
  - `notes` (text)
  - `created_at` (timestamptz)

  ## 2. Güvenlik
  - RLS enabled tüm tablolarda
  - Organization bazında erişim kontrolü
  - Sadece authenticated kullanıcılar erişebilir

  ## 3. İndeksler
  - Performance için organization_id, workflow_id, next_rotation_date indeksleri
*/

-- Sensitive Tasks table
CREATE TABLE IF NOT EXISTS sensitive_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflow_processes(id) ON DELETE CASCADE,
  workflow_step_id uuid REFERENCES workflow_steps(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  process_name text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_primary_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_backup_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rotation_period text NOT NULL CHECK (rotation_period IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  last_rotation_date timestamptz,
  next_rotation_date timestamptz,
  status text NOT NULL DEFAULT 'awaiting_assignment' CHECK (status IN ('normal', 'rotation_due', 'rotation_overdue', 'awaiting_assignment')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Task Rotation History table
CREATE TABLE IF NOT EXISTS task_rotation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensitive_task_id uuid NOT NULL REFERENCES sensitive_tasks(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('initial_assignment', 'rotation', 'postponement')),
  action_date timestamptz NOT NULL DEFAULT now(),
  previous_primary_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  new_primary_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  previous_backup_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  new_backup_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Task Postponements table
CREATE TABLE IF NOT EXISTS task_postponements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensitive_task_id uuid NOT NULL REFERENCES sensitive_tasks(id) ON DELETE CASCADE,
  postponement_reason text NOT NULL CHECK (postponement_reason IN ('no_qualified_personnel', 'personnel_on_leave', 'critical_period', 'other')),
  postponement_duration integer NOT NULL,
  original_due_date timestamptz NOT NULL,
  new_due_date timestamptz NOT NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensitive_tasks_organization ON sensitive_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_tasks_workflow ON sensitive_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_tasks_department ON sensitive_tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_tasks_next_rotation ON sensitive_tasks(next_rotation_date);
CREATE INDEX IF NOT EXISTS idx_sensitive_tasks_status ON sensitive_tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_rotation_history_task ON task_rotation_history(sensitive_task_id);
CREATE INDEX IF NOT EXISTS idx_task_postponements_task ON task_postponements(sensitive_task_id);

-- Enable Row Level Security
ALTER TABLE sensitive_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_rotation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_postponements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sensitive_tasks
CREATE POLICY "Users can view sensitive tasks in their organization"
  ON sensitive_tasks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can insert sensitive tasks"
  ON sensitive_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update sensitive tasks"
  ON sensitive_tasks FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins can delete sensitive tasks"
  ON sensitive_tasks FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for task_rotation_history
CREATE POLICY "Users can view rotation history in their organization"
  ON task_rotation_history FOR SELECT
  TO authenticated
  USING (
    sensitive_task_id IN (
      SELECT id FROM sensitive_tasks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins and directors can insert rotation history"
  ON task_rotation_history FOR INSERT
  TO authenticated
  WITH CHECK (
    sensitive_task_id IN (
      SELECT id FROM sensitive_tasks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'director')
      )
    )
  );

-- RLS Policies for task_postponements
CREATE POLICY "Users can view postponements in their organization"
  ON task_postponements FOR SELECT
  TO authenticated
  USING (
    sensitive_task_id IN (
      SELECT id FROM sensitive_tasks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins and directors can insert postponements"
  ON task_postponements FOR INSERT
  TO authenticated
  WITH CHECK (
    sensitive_task_id IN (
      SELECT id FROM sensitive_tasks 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'director')
      )
    )
  );

-- Function to automatically update task status based on rotation date
CREATE OR REPLACE FUNCTION update_sensitive_task_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update overdue tasks
  UPDATE sensitive_tasks
  SET status = 'rotation_overdue'
  WHERE next_rotation_date < CURRENT_DATE
    AND status NOT IN ('awaiting_assignment', 'rotation_overdue')
    AND assigned_primary_id IS NOT NULL;

  -- Update tasks due soon (within 15 days)
  UPDATE sensitive_tasks
  SET status = 'rotation_due'
  WHERE next_rotation_date <= CURRENT_DATE + INTERVAL '15 days'
    AND next_rotation_date >= CURRENT_DATE
    AND status NOT IN ('awaiting_assignment', 'rotation_overdue')
    AND assigned_primary_id IS NOT NULL;

  -- Update normal tasks
  UPDATE sensitive_tasks
  SET status = 'normal'
  WHERE next_rotation_date > CURRENT_DATE + INTERVAL '15 days'
    AND status NOT IN ('awaiting_assignment')
    AND assigned_primary_id IS NOT NULL;
END;
$$;

-- Function to calculate next rotation date based on period
CREATE OR REPLACE FUNCTION calculate_next_rotation_date(
  p_rotation_period text,
  p_start_date timestamptz DEFAULT CURRENT_DATE
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE p_rotation_period
    WHEN 'monthly' THEN p_start_date + INTERVAL '30 days'
    WHEN 'quarterly' THEN p_start_date + INTERVAL '90 days'
    WHEN 'semi_annual' THEN p_start_date + INTERVAL '180 days'
    WHEN 'annual' THEN p_start_date + INTERVAL '365 days'
    ELSE p_start_date + INTERVAL '365 days'
  END;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sensitive_task_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sensitive_tasks_timestamp
  BEFORE UPDATE ON sensitive_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_sensitive_task_timestamp();
