/*
  # İç Kontrol Modülü - Part 2: İKİYK, Değerlendirmeler ve Güvence Beyanları

  1. Yeni Tablolar
    - `ic_ikyk_meetings` - İKİYK toplantıları
    - `ic_meeting_attendees` - Toplantı katılımcıları
    - `ic_meeting_agenda_items` - Gündem maddeleri
    - `ic_meeting_decisions` - Toplantı kararları
    - `ic_standard_assessments` - Standart değerlendirmeleri
    - `ic_assurance_statements` - Güvence beyanları

  2. Security
    - RLS tüm tablolarda aktif
    - Organization bazlı erişim kontrolü
    - Role bazlı yetkilendirme

  3. İş Kuralları
    - Toplantı katılımcı yönetimi
    - Karar takip sistemi
    - Değerlendirme onay akışı
    - Güvence beyanı oluşturma ve yayınlama
*/

-- İKİYK Toplantıları
CREATE TABLE IF NOT EXISTS ic_ikyk_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_number int NOT NULL,
  meeting_date date NOT NULL,
  location text,
  chairperson text NOT NULL,
  minutes_url text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, meeting_number)
);

CREATE INDEX IF NOT EXISTS idx_ic_ikyk_meetings_org ON ic_ikyk_meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_ikyk_meetings_date ON ic_ikyk_meetings(meeting_date DESC);

-- Toplantı Katılımcıları
CREATE TABLE IF NOT EXISTS ic_meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES ic_ikyk_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('chairman', 'member', 'rapporteur', 'observer')),
  attended boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_meeting_attendees_meeting ON ic_meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_attendees_user ON ic_meeting_attendees(user_id);

-- Toplantı Gündem Maddeleri
CREATE TABLE IF NOT EXISTS ic_meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES ic_ikyk_meetings(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  title text NOT NULL,
  description text,
  presenter text,
  related_action_id uuid REFERENCES ic_actions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_meeting_agenda_meeting ON ic_meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_agenda_order ON ic_meeting_agenda_items(meeting_id, order_index);

-- Toplantı Kararları
CREATE TABLE IF NOT EXISTS ic_meeting_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES ic_ikyk_meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES ic_meeting_agenda_items(id) ON DELETE SET NULL,
  decision_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  responsible_unit_id uuid REFERENCES departments(id),
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  completion_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, decision_number)
);

CREATE INDEX IF NOT EXISTS idx_ic_meeting_decisions_meeting ON ic_meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_decisions_status ON ic_meeting_decisions(status);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_decisions_due_date ON ic_meeting_decisions(due_date);

-- Standart Değerlendirmeleri
CREATE TABLE IF NOT EXISTS ic_standard_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  standard_id uuid NOT NULL REFERENCES ic_standards(id) ON DELETE RESTRICT,
  assessment_period text NOT NULL,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assessed_by uuid NOT NULL REFERENCES profiles(id),
  
  compliance_level int NOT NULL CHECK (compliance_level >= 1 AND compliance_level <= 5),
  
  strengths text,
  weaknesses text,
  evidences text,
  recommendations text,
  
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, standard_id, assessment_period)
);

CREATE INDEX IF NOT EXISTS idx_ic_assessments_org ON ic_standard_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_assessments_standard ON ic_standard_assessments(standard_id);
CREATE INDEX IF NOT EXISTS idx_ic_assessments_period ON ic_standard_assessments(assessment_period);
CREATE INDEX IF NOT EXISTS idx_ic_assessments_status ON ic_standard_assessments(status);

-- Güvence Beyanları
CREATE TABLE IF NOT EXISTS ic_assurance_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year int NOT NULL,
  type text NOT NULL CHECK (type IN ('unit', 'institution')),
  unit_id uuid REFERENCES departments(id),
  
  declarant_name text NOT NULL,
  declarant_title text NOT NULL,
  declaration_date date NOT NULL,
  
  assurance_level text NOT NULL CHECK (assurance_level IN ('full', 'qualified', 'adverse')),
  
  scope_statement text NOT NULL,
  responsibility_statement text NOT NULL,
  assessment_statement text NOT NULL,
  limitations_statement text,
  conclusion_statement text NOT NULL,
  
  signature_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'published')),
  
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, year, type, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_assurance_org ON ic_assurance_statements(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_assurance_year ON ic_assurance_statements(year DESC);
CREATE INDEX IF NOT EXISTS idx_ic_assurance_type ON ic_assurance_statements(type);
CREATE INDEX IF NOT EXISTS idx_ic_assurance_status ON ic_assurance_statements(status);

-- Updated_at triggers
DROP TRIGGER IF EXISTS trigger_ic_ikyk_meetings_updated_at ON ic_ikyk_meetings;
CREATE TRIGGER trigger_ic_ikyk_meetings_updated_at
  BEFORE UPDATE ON ic_ikyk_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

DROP TRIGGER IF EXISTS trigger_ic_meeting_agenda_updated_at ON ic_meeting_agenda_items;
CREATE TRIGGER trigger_ic_meeting_agenda_updated_at
  BEFORE UPDATE ON ic_meeting_agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

DROP TRIGGER IF EXISTS trigger_ic_meeting_decisions_updated_at ON ic_meeting_decisions;
CREATE TRIGGER trigger_ic_meeting_decisions_updated_at
  BEFORE UPDATE ON ic_meeting_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

DROP TRIGGER IF EXISTS trigger_ic_assessments_updated_at ON ic_standard_assessments;
CREATE TRIGGER trigger_ic_assessments_updated_at
  BEFORE UPDATE ON ic_standard_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

DROP TRIGGER IF EXISTS trigger_ic_assurance_updated_at ON ic_assurance_statements;
CREATE TRIGGER trigger_ic_assurance_updated_at
  BEFORE UPDATE ON ic_assurance_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_updated_at();

-- RLS Policies

-- ic_ikyk_meetings
ALTER TABLE ic_ikyk_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC meetings in their organization"
  ON ic_ikyk_meetings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage IC meetings"
  ON ic_ikyk_meetings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ic_meeting_attendees
ALTER TABLE ic_meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC meeting attendees in their organization"
  ON ic_meeting_attendees FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage IC meeting attendees"
  ON ic_meeting_attendees FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- ic_meeting_agenda_items
ALTER TABLE ic_meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC agenda items in their organization"
  ON ic_meeting_agenda_items FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage IC agenda items"
  ON ic_meeting_agenda_items FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- ic_meeting_decisions
ALTER TABLE ic_meeting_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC decisions in their organization"
  ON ic_meeting_decisions FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can insert IC decisions"
  ON ic_meeting_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins and responsible units can update IC decisions"
  ON ic_meeting_decisions FOR UPDATE
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND (
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
      OR
      responsible_unit_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ic_standard_assessments
ALTER TABLE ic_standard_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC assessments in their organization"
  ON ic_standard_assessments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert IC assessments in their organization"
  ON ic_standard_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND assessed_by = auth.uid()
  );

CREATE POLICY "Users can update their own draft IC assessments"
  ON ic_standard_assessments FOR UPDATE
  TO authenticated
  USING (
    assessed_by = auth.uid() AND status = 'draft'
  );

CREATE POLICY "Admins can update IC assessments"
  ON ic_standard_assessments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ic_assurance_statements
ALTER TABLE ic_assurance_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IC assurance statements in their organization"
  ON ic_assurance_statements FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins and directors can insert IC assurance statements"
  ON ic_assurance_statements FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "Admins and directors can update IC assurance statements"
  ON ic_assurance_statements FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete draft IC assurance statements"
  ON ic_assurance_statements FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
    AND status = 'draft'
  );
