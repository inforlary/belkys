/*
  # Birimler Arası İşbirliği Yönetim Sistemi
  
  ## Genel Bakış
  Yönetici (admin) paneli için birimler arası işbirliği, riskler, faaliyetler/projeler,
  tespitler ve ihtiyaçlar modülü oluşturulur.
  
  ## 1. Yeni Tablolar
  
  ### `collaborations`
  Ana işbirliği kayıtları tablosu
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `organization_id` (uuid, foreign key) - Organizasyon kimliği
  - `responsible_department_id` (uuid, foreign key) - Sorumlu birim/müdürlük
  - `title` (text) - İşbirliği başlığı
  - `description` (text, nullable) - Açıklama
  - `start_date` (date, nullable) - Başlangıç tarihi
  - `end_date` (date, nullable) - Bitiş tarihi
  - `status` (text) - Durum: 'planning', 'active', 'completed', 'cancelled'
  - `created_by` (uuid, foreign key) - Oluşturan kullanıcı
  - `created_at` (timestamptz) - Oluşturulma zamanı
  - `updated_at` (timestamptz) - Güncellenme zamanı
  
  ### `collaboration_partners`
  İşbirliği yapılacak birimler
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `collaboration_id` (uuid, foreign key) - İşbirliği kaydı
  - `department_id` (uuid, foreign key) - İşbirlikçi birim
  - `role` (text, nullable) - Birimin rolü/görevi
  - `created_at` (timestamptz) - Oluşturulma zamanı
  
  ### `collaboration_risks`
  İşbirliği riskleri
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `collaboration_id` (uuid, foreign key) - İşbirliği kaydı
  - `description` (text) - Risk açıklaması
  - `severity` (text) - Önem derecesi: 'low', 'medium', 'high', 'critical'
  - `mitigation_plan` (text, nullable) - Risk azaltma planı
  - `status` (text) - Durum: 'identified', 'monitoring', 'mitigated', 'realized'
  - `created_at` (timestamptz) - Oluşturulma zamanı
  - `updated_at` (timestamptz) - Güncellenme zamanı
  
  ### `collaboration_projects`
  Faaliyet ve projeler
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `collaboration_id` (uuid, foreign key) - İşbirliği kaydı
  - `title` (text) - Faaliyet/Proje başlığı
  - `description` (text, nullable) - Açıklama
  - `type` (text) - Tip: 'activity', 'project'
  - `start_date` (date, nullable) - Başlangıç tarihi
  - `end_date` (date, nullable) - Bitiş tarihi
  - `budget` (numeric, nullable) - Bütçe
  - `status` (text) - Durum: 'planned', 'ongoing', 'completed', 'cancelled'
  - `created_at` (timestamptz) - Oluşturulma zamanı
  - `updated_at` (timestamptz) - Güncellenme zamanı
  
  ### `collaboration_findings`
  Tespitler ve ihtiyaçlar
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `collaboration_id` (uuid, foreign key) - İşbirliği kaydı
  - `type` (text) - Tip: 'finding', 'need'
  - `title` (text) - Başlık
  - `description` (text) - Açıklama
  - `priority` (text) - Öncelik: 'low', 'medium', 'high', 'urgent'
  - `status` (text) - Durum: 'identified', 'under_review', 'addressed', 'closed'
  - `action_taken` (text, nullable) - Alınan aksiyon
  - `created_at` (timestamptz) - Oluşturulma zamanı
  - `updated_at` (timestamptz) - Güncellenme zamanı
  
  ## 2. Güvenlik (RLS)
  
  Her tablo için Row Level Security (RLS) etkinleştirilir ve şu politikalar uygulanır:
  - **Admin kullanıcılar**: Tüm kayıtları görüntüleyebilir, ekleyebilir, güncelleyebilir ve silebilir
  - **Diğer kullanıcılar**: Sadece kendi organizasyonlarındaki kayıtları görüntüleyebilir
  
  ## 3. İndeksler
  
  Performans için şu indeksler oluşturulur:
  - `collaborations` tablosu için organization_id ve responsible_department_id
  - İlişkili tablolar için foreign key indeksleri
*/

-- collaborations table
CREATE TABLE IF NOT EXISTS collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsible_department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- collaboration_partners table
CREATE TABLE IF NOT EXISTS collaboration_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collaboration_id, department_id)
);

-- collaboration_risks table
CREATE TABLE IF NOT EXISTS collaboration_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  mitigation_plan text,
  status text NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'monitoring', 'mitigated', 'realized')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- collaboration_projects table
CREATE TABLE IF NOT EXISTS collaboration_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('activity', 'project')),
  start_date date,
  end_date date,
  budget numeric(15, 2),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- collaboration_findings table
CREATE TABLE IF NOT EXISTS collaboration_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('finding', 'need')),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'under_review', 'addressed', 'closed')),
  action_taken text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_findings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collaborations
CREATE POLICY "Admin users can view all collaborations"
  ON collaborations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert collaborations"
  ON collaborations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update collaborations"
  ON collaborations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete collaborations"
  ON collaborations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for collaboration_partners
CREATE POLICY "Users can view collaboration partners"
  ON collaboration_partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaborations
      WHERE collaborations.id = collaboration_partners.collaboration_id
    )
  );

CREATE POLICY "Admin users can insert collaboration partners"
  ON collaboration_partners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete collaboration partners"
  ON collaboration_partners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for collaboration_risks
CREATE POLICY "Users can view collaboration risks"
  ON collaboration_risks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaborations
      WHERE collaborations.id = collaboration_risks.collaboration_id
    )
  );

CREATE POLICY "Admin users can insert collaboration risks"
  ON collaboration_risks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update collaboration risks"
  ON collaboration_risks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete collaboration risks"
  ON collaboration_risks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for collaboration_projects
CREATE POLICY "Users can view collaboration projects"
  ON collaboration_projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaborations
      WHERE collaborations.id = collaboration_projects.collaboration_id
    )
  );

CREATE POLICY "Admin users can insert collaboration projects"
  ON collaboration_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update collaboration projects"
  ON collaboration_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete collaboration projects"
  ON collaboration_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for collaboration_findings
CREATE POLICY "Users can view collaboration findings"
  ON collaboration_findings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaborations
      WHERE collaborations.id = collaboration_findings.collaboration_id
    )
  );

CREATE POLICY "Admin users can insert collaboration findings"
  ON collaboration_findings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update collaboration findings"
  ON collaboration_findings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete collaboration findings"
  ON collaboration_findings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collaborations_org_id ON collaborations(organization_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_dept_id ON collaborations(responsible_department_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_partners_collab_id ON collaboration_partners(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_risks_collab_id ON collaboration_risks(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_projects_collab_id ON collaboration_projects(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_findings_collab_id ON collaboration_findings(collaboration_id);