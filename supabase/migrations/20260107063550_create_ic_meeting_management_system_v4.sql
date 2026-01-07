/*
  # İKİYK Toplantı Yönetim Sistemi
  
  1. Yeni Tablolar
    - `ic_meetings` - İKİYK toplantı kayıtları
    - `ic_meeting_participants` - Toplantı katılımcıları
    - `ic_meeting_agenda_items` - Gündem maddeleri
    - `ic_meeting_decisions` - Toplantı kararları
      
  2. Güvenlik
    - Her tablo için RLS etkinleştirildi
    - Admin rolleri tüm erişime sahip
*/

-- Meetings table
CREATE TABLE IF NOT EXISTS ic_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  year int NOT NULL,
  meeting_number int NOT NULL,
  meeting_date date NOT NULL,
  meeting_time time,
  location text,
  chairman_name text NOT NULL,
  chairman_title text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  minutes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, year, meeting_number)
);

-- Participants table
CREATE TABLE IF NOT EXISTS ic_meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES ic_meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  title text,
  department text,
  role text NOT NULL CHECK (role IN ('chairman', 'vice_chairman', 'secretary', 'member', 'guest')),
  attended boolean DEFAULT false,
  excuse text,
  created_at timestamptz DEFAULT now()
);

-- Agenda items table
CREATE TABLE IF NOT EXISTS ic_meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES ic_meetings(id) ON DELETE CASCADE NOT NULL,
  order_number int NOT NULL,
  title text NOT NULL,
  description text,
  presenter text,
  estimated_duration int,
  item_type text NOT NULL CHECK (item_type IN ('opening', 'approval', 'presentation', 'discussion', 'decision', 'information', 'closing')),
  notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, order_number)
);

-- Decisions table
CREATE TABLE IF NOT EXISTS ic_meeting_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES ic_meetings(id) ON DELETE CASCADE NOT NULL,
  agenda_item_id uuid REFERENCES ic_meeting_agenda_items(id) ON DELETE SET NULL,
  decision_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('action', 'approval', 'information', 'postponement', 'rejection')),
  responsible_department text,
  responsible_person text,
  deadline date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  completion_date date,
  completion_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, decision_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ic_meetings_org_year ON ic_meetings(organization_id, year);
CREATE INDEX IF NOT EXISTS idx_ic_meetings_status ON ic_meetings(status);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_participants_meeting ON ic_meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_participants_user ON ic_meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_agenda_items_meeting ON ic_meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_decisions_meeting ON ic_meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ic_meeting_decisions_status ON ic_meeting_decisions(status, deadline);

-- Updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_ic_meetings_updated_at ON ic_meetings;
CREATE TRIGGER update_ic_meetings_updated_at BEFORE UPDATE ON ic_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_meeting_agenda_items_updated_at ON ic_meeting_agenda_items;
CREATE TRIGGER update_ic_meeting_agenda_items_updated_at BEFORE UPDATE ON ic_meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_meeting_decisions_updated_at ON ic_meeting_decisions;
CREATE TRIGGER update_ic_meeting_decisions_updated_at BEFORE UPDATE ON ic_meeting_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ic_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_meeting_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ic_meetings
DROP POLICY IF EXISTS "Users can view meetings in their organization" ON ic_meetings;
CREATE POLICY "Users can view meetings in their organization"
  ON ic_meetings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert meetings" ON ic_meetings;
CREATE POLICY "Admins can insert meetings"
  ON ic_meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = ic_meetings.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update meetings" ON ic_meetings;
CREATE POLICY "Admins can update meetings"
  ON ic_meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = ic_meetings.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete meetings" ON ic_meetings;
CREATE POLICY "Admins can delete meetings"
  ON ic_meetings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = ic_meetings.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for ic_meeting_participants
DROP POLICY IF EXISTS "Users can view participants in their org meetings" ON ic_meeting_participants;
CREATE POLICY "Users can view participants in their org meetings"
  ON ic_meeting_participants FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_meetings
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage participants" ON ic_meeting_participants;
CREATE POLICY "Admins can manage participants"
  ON ic_meeting_participants FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for ic_meeting_agenda_items
DROP POLICY IF EXISTS "Users can view agenda items in their org meetings" ON ic_meeting_agenda_items;
CREATE POLICY "Users can view agenda items in their org meetings"
  ON ic_meeting_agenda_items FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_meetings
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage agenda items" ON ic_meeting_agenda_items;
CREATE POLICY "Admins can manage agenda items"
  ON ic_meeting_agenda_items FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for ic_meeting_decisions
DROP POLICY IF EXISTS "Users can view decisions in their org meetings" ON ic_meeting_decisions;
CREATE POLICY "Users can view decisions in their org meetings"
  ON ic_meeting_decisions FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ic_meetings
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can insert decisions" ON ic_meeting_decisions;
CREATE POLICY "Admins can insert decisions"
  ON ic_meeting_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update decisions" ON ic_meeting_decisions;
CREATE POLICY "Admins can update decisions"
  ON ic_meeting_decisions FOR UPDATE
  TO authenticated
  USING (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete decisions" ON ic_meeting_decisions;
CREATE POLICY "Admins can delete decisions"
  ON ic_meeting_decisions FOR DELETE
  TO authenticated
  USING (
    meeting_id IN (
      SELECT m.id FROM ic_meetings m
      INNER JOIN profiles p ON p.organization_id = m.organization_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );