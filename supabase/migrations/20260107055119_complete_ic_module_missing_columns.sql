/*
  # İç Kontrol Modülü - Eksik Kolonları Tamamlama

  1. Güncellemeler
    - ic_actions tablosuna eksik kolonlar ekleniyor
    - ikyk_agenda_items tablosuna eksik kolonlar ekleniyor
    - ikyk_attendees tablosuna eksik kolonlar ekleniyor
    - ikyk_meetings tablosuna eksik kolonlar ekleniyor
  
  2. Yeni Kolonlar
    - Tüm eksik alanlar kullanıcının verdiği şemaya göre ekleniyor
*/

-- ic_actions tablosuna eksik kolonları ekle
ALTER TABLE ic_actions
  ADD COLUMN IF NOT EXISTS expected_outputs TEXT,
  ADD COLUMN IF NOT EXISTS required_resources TEXT,
  ADD COLUMN IF NOT EXISTS related_risk_id UUID REFERENCES risks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT,
  ADD COLUMN IF NOT EXISTS completion_note TEXT;

-- Mevcut outputs ve resources kolonlarını kopyala
UPDATE ic_actions SET expected_outputs = outputs WHERE expected_outputs IS NULL AND outputs IS NOT NULL;
UPDATE ic_actions SET required_resources = resources WHERE required_resources IS NULL AND resources IS NOT NULL;

-- ikyk_meetings tablosuna eksik kolonlar
ALTER TABLE ikyk_meetings
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS minutes_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES profiles(id);

-- ikyk_attendees tablosuna eksik kolonlar
ALTER TABLE ikyk_attendees
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS department VARCHAR(200),
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'MEMBER',
  ADD COLUMN IF NOT EXISTS invited BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance_note TEXT;

-- ikyk_agenda_items tablosuna eksik kolonlar
ALTER TABLE ikyk_agenda_items
  ADD COLUMN IF NOT EXISTS order_index INT,
  ADD COLUMN IF NOT EXISTS title VARCHAR(500),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS presenter_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS presenter_title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'DISCUSSION',
  ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS related_action_id UUID REFERENCES ic_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_standard_id UUID REFERENCES ic_standards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ikyk_decisions tablosuna eksik kolonlar
ALTER TABLE ikyk_decisions
  ADD COLUMN IF NOT EXISTS decision_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS title VARCHAR(500),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS decision_type VARCHAR(50) DEFAULT 'ACTION',
  ADD COLUMN IF NOT EXISTS responsible_department_id UUID REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS responsible_person_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS completion_note TEXT,
  ADD COLUMN IF NOT EXISTS creates_action BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_action_id UUID REFERENCES ic_actions(id) ON DELETE SET NULL;

-- Check constraints ekle
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ikyk_attendees_role_check'
  ) THEN
    ALTER TABLE ikyk_attendees 
      ADD CONSTRAINT ikyk_attendees_role_check 
      CHECK (role IN ('CHAIRPERSON', 'VICE_CHAIRPERSON', 'SECRETARY', 'MEMBER', 'GUEST'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ikyk_agenda_items_item_type_check'
  ) THEN
    ALTER TABLE ikyk_agenda_items 
      ADD CONSTRAINT ikyk_agenda_items_item_type_check 
      CHECK (item_type IN ('OPENING', 'APPROVAL', 'PRESENTATION', 'DISCUSSION', 'DECISION', 'INFORMATION', 'CLOSING'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ikyk_decisions_decision_type_check'
  ) THEN
    ALTER TABLE ikyk_decisions 
      ADD CONSTRAINT ikyk_decisions_decision_type_check 
      CHECK (decision_type IN ('ACTION', 'APPROVAL', 'INFORMATION', 'POSTPONE', 'REJECT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ikyk_decisions_status_check'
  ) THEN
    ALTER TABLE ikyk_decisions 
      ADD CONSTRAINT ikyk_decisions_status_check 
      CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'));
  END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_ic_actions_related_risk ON ic_actions(related_risk_id);
CREATE INDEX IF NOT EXISTS idx_ikyk_decisions_responsible_dept ON ikyk_decisions(responsible_department_id);