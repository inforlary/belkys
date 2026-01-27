/*
  # İş Akış Şemaları Yönetim Sistemi

  1. Yeni Tablolar
    - `workflow_processes` - İş süreçleri ana tablosu
    - `workflow_actors` - İş akışı görevlileri
    - `workflow_steps` - İş akışı adımları
    - `workflow_process_templates` - Hazır iş akışı şablonları

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on organization
*/

-- Workflow Processes Table
CREATE TABLE IF NOT EXISTS workflow_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved')),
  owner_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  main_process text,
  process text,
  sub_process text,
  trigger_event text,
  outputs text,
  software_used text,
  legal_basis text,
  version integer DEFAULT 1,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Workflow Actors Table
CREATE TABLE IF NOT EXISTS workflow_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflow_processes(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL,
  title text NOT NULL,
  department text NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Workflow Steps Table
CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflow_processes(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL,
  step_type text NOT NULL CHECK (step_type IN ('process', 'decision', 'document', 'system')),
  description text NOT NULL,
  actor_id uuid REFERENCES workflow_actors(id) ON DELETE SET NULL,
  is_sensitive boolean DEFAULT false,
  yes_target_step text,
  no_target_step text,
  created_at timestamptz DEFAULT now()
);

-- Workflow Process Templates Table (renamed to avoid conflict)
CREATE TABLE IF NOT EXISTS workflow_process_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  template_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE workflow_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_process_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view workflows in their organization" ON workflow_processes;
DROP POLICY IF EXISTS "Users can create workflows in their organization" ON workflow_processes;
DROP POLICY IF EXISTS "Users can update workflows in their organization" ON workflow_processes;
DROP POLICY IF EXISTS "Admins can delete workflows" ON workflow_processes;
DROP POLICY IF EXISTS "Users can view actors in their organization workflows" ON workflow_actors;
DROP POLICY IF EXISTS "Users can manage actors in their organization workflows" ON workflow_actors;
DROP POLICY IF EXISTS "Users can view steps in their organization workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can manage steps in their organization workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Everyone can view templates" ON workflow_process_templates;

-- RLS Policies for workflow_processes
CREATE POLICY "Users can view workflows in their organization"
  ON workflow_processes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create workflows in their organization"
  ON workflow_processes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update workflows in their organization"
  ON workflow_processes FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete workflows"
  ON workflow_processes FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'ADMIN')
    )
  );

-- RLS Policies for workflow_actors
CREATE POLICY "Users can view actors in their organization workflows"
  ON workflow_actors FOR SELECT
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM workflow_processes 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage actors in their organization workflows"
  ON workflow_actors FOR ALL
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM workflow_processes 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for workflow_steps
CREATE POLICY "Users can view steps in their organization workflows"
  ON workflow_steps FOR SELECT
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM workflow_processes 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage steps in their organization workflows"
  ON workflow_steps FOR ALL
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM workflow_processes 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for workflow_process_templates
CREATE POLICY "Everyone can view templates"
  ON workflow_process_templates FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_processes_org ON workflow_processes(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_processes_status ON workflow_processes(status);
CREATE INDEX IF NOT EXISTS idx_workflow_actors_workflow ON workflow_actors(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);

-- Update function for updated_at
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_processes_updated_at ON workflow_processes;

CREATE TRIGGER update_workflow_processes_updated_at
  BEFORE UPDATE ON workflow_processes
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- Insert template data
INSERT INTO workflow_process_templates (name, category, description, icon, template_data) VALUES
(
  'İzin Talebi Onay Süreci',
  'İnsan Kaynakları',
  'Personel izin taleplerinin onaylanması sürecini içerir. İzin türleri, onay mekanizmaları ve bildirimler.',
  'calendar',
  '{"actors": [{"title": "Personel", "department": "Tüm Birimler", "role": "İzin talep eden"}, {"title": "Birim Müdürü", "department": "İlgili Birim", "role": "İlk onaylayan"}, {"title": "İK Uzmanı", "department": "İnsan Kaynakları Müdürlüğü", "role": "Kontrol eden"}, {"title": "Genel Sekreter", "department": "Genel Sekreterlik", "role": "Son onaylayan"}], "steps": [{"type": "process", "description": "İzin talebini sisteme gir", "actorIndex": 0, "sensitive": false}, {"type": "decision", "description": "İzin türü yıllık izin mi?", "actorIndex": 2, "sensitive": false}, {"type": "process", "description": "Yıllık izin hakkını kontrol et", "actorIndex": 2, "sensitive": false}, {"type": "process", "description": "Mazeret izni belgelerini incele", "actorIndex": 2, "sensitive": false}, {"type": "decision", "description": "Birim müdürü onayı alındı mı?", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "Genel sekretere ilet", "actorIndex": 2, "sensitive": false}, {"type": "decision", "description": "Talep onaylandı mı?", "actorIndex": 3, "sensitive": true}, {"type": "document", "description": "İzin belgesini oluştur", "actorIndex": 2, "sensitive": false}, {"type": "system", "description": "Personele bildirim gönder", "actorIndex": 2, "sensitive": false}]}'
),
(
  'Satın Alma Talebi',
  'Mali İşler',
  'Mal ve hizmet alımı için talep, teklif alma, onay ve satın alma sürecini kapsar.',
  'shopping-cart',
  '{"actors": [{"title": "Talep Eden Birim", "department": "İlgili Birim", "role": "Talep oluşturan"}, {"title": "Satın Alma Müdürü", "department": "Satın Alma Müdürlüğü", "role": "Teklif alan"}, {"title": "Mali Hizmetler Müdürü", "department": "Mali Hizmetler Müdürlüğü", "role": "Bütçe kontrol eden"}, {"title": "Başkan", "department": "Başkanlık", "role": "Onaylayan"}], "steps": [{"type": "process", "description": "Satın alma talebini oluştur", "actorIndex": 0, "sensitive": false}, {"type": "decision", "description": "Tutarı 50.000 TL üzeri mi?", "actorIndex": 2, "sensitive": true}, {"type": "process", "description": "En az 3 teklif al", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "Tek teklif al", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "Bütçe uygunluğunu kontrol et", "actorIndex": 2, "sensitive": true}, {"type": "decision", "description": "Bütçe uygun mu?", "actorIndex": 2, "sensitive": true}, {"type": "process", "description": "Başkana onaya sun", "actorIndex": 1, "sensitive": false}, {"type": "decision", "description": "Başkan onayladı mı?", "actorIndex": 3, "sensitive": true}, {"type": "document", "description": "Satın alma emri oluştur", "actorIndex": 1, "sensitive": false}, {"type": "system", "description": "İlgili birimlere bildirim gönder", "actorIndex": 1, "sensitive": false}]}'
),
(
  'Vatandaş Şikayet İşleme',
  'Halkla İlişkiler',
  'Vatandaşlardan gelen şikayet ve taleplerin değerlendirilmesi ve çözümlenmesi süreci.',
  'message-circle',
  '{"actors": [{"title": "Vatandaş", "department": "Harici", "role": "Şikayet eden"}, {"title": "CİMER Birimi", "department": "Özel Kalem Müdürlüğü", "role": "Kaydeden"}, {"title": "İlgili Birim Müdürü", "department": "İlgili Birim", "role": "İnceleyen"}, {"title": "Başkan Yardımcısı", "department": "Başkan Yardımcılığı", "role": "Kontrol eden"}], "steps": [{"type": "process", "description": "Şikayeti kayda al", "actorIndex": 1, "sensitive": false}, {"type": "decision", "description": "Şikayet acil mi?", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "İlgili birime acil olarak ilet", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "İlgili birime normal süreçle ilet", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "Şikayeti incele ve değerlendir", "actorIndex": 2, "sensitive": false}, {"type": "decision", "description": "Haklı şikayet mi?", "actorIndex": 2, "sensitive": false}, {"type": "process", "description": "Çözüm önerisi hazırla", "actorIndex": 2, "sensitive": false}, {"type": "process", "description": "Başkan yardımcısına sun", "actorIndex": 2, "sensitive": false}, {"type": "decision", "description": "Öneri onaylandı mı?", "actorIndex": 3, "sensitive": true}, {"type": "document", "description": "Cevap yazısını hazırla", "actorIndex": 1, "sensitive": false}, {"type": "system", "description": "Vatandaşa cevabı ilet", "actorIndex": 1, "sensitive": false}]}'
),
(
  'Proje Onay Süreci',
  'Proje Yönetimi',
  'Yeni proje tekliflerinin değerlendirilmesi, onaylanması ve başlatılması sürecini içerir.',
  'folder',
  '{"actors": [{"title": "Proje Sorumlusu", "department": "İlgili Birim", "role": "Teklif hazırlayan"}, {"title": "Strateji Uzmanı", "department": "Strateji Geliştirme Müdürlüğü", "role": "Değerlendiren"}, {"title": "Mali İşler Müdürü", "department": "Mali Hizmetler Müdürlüğü", "role": "Mali kontrol eden"}, {"title": "Genel Sekreter", "department": "Genel Sekreterlik", "role": "Onaylayan"}], "steps": [{"type": "process", "description": "Proje teklifi hazırla", "actorIndex": 0, "sensitive": false}, {"type": "document", "description": "Fizibilite raporu ekle", "actorIndex": 0, "sensitive": false}, {"type": "process", "description": "Stratejik plana uygunluğu değerlendir", "actorIndex": 1, "sensitive": false}, {"type": "decision", "description": "Stratejik plana uygun mu?", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "Mali fizibiliteyi incele", "actorIndex": 2, "sensitive": true}, {"type": "decision", "description": "Bütçe uygun mu?", "actorIndex": 2, "sensitive": true}, {"type": "process", "description": "Genel sekretere sun", "actorIndex": 1, "sensitive": false}, {"type": "decision", "description": "Proje onaylandı mı?", "actorIndex": 3, "sensitive": true}, {"type": "document", "description": "Proje onay belgesini oluştur", "actorIndex": 1, "sensitive": false}, {"type": "system", "description": "Proje ekibine bildirim gönder", "actorIndex": 1, "sensitive": false}, {"type": "process", "description": "Red gerekçesini hazırla", "actorIndex": 1, "sensitive": false}]}'
)
ON CONFLICT DO NOTHING;
