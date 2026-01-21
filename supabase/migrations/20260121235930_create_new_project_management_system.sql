/*
  # Yeni Proje Yönetimi Sistemi

  1. Yeni Tablolar
    - projects: Ana proje tablosu
      - İLYAS, Beyanname ve Genel projeler
      - Fiziki ve nakdi ilerleme takibi
      - Sözleşme ve yüklenici bilgileri
    
    - project_progress: İlerleme kayıtları
      - Fiziki ve nakdi ilerleme değişiklikleri
      - GPS koordinatları
      - Harcama kayıtları
    
    - project_files: Proje dosyaları
      - Fotoğraf, PDF, Excel, Word
      - İlerleme kaydına veya projeye bağlı
      - Kategorize edilmiş
    
    - pm_strategic_plans: Proje yönetimine özel basit SP
      - Amaç, Hedef, Gösterge hiyerarşisi
    
    - ilyas_details: İLYAS projeleri için özel alanlar
    
    - declaration_details: Beyanname projeleri için özel alanlar
  
  2. Security
    - RLS politikaları tüm tablolar için
    - Organization bazlı erişim kontrolü
*/

-- TABLO 1: projects (Ana Proje Tablosu)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_no VARCHAR(50) NOT NULL,
  project_name TEXT NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('ilyas', 'beyanname', 'genel')),
  year INTEGER NOT NULL,
  period INTEGER CHECK (period IN (1, 2, 3, 4)),
  sector VARCHAR(100),
  sub_sector VARCHAR(100),
  responsible_unit VARCHAR(100),
  location TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'delayed')),
  physical_progress DECIMAL(5,2) DEFAULT 0 CHECK (physical_progress >= 0 AND physical_progress <= 100),
  financial_progress DECIMAL(5,2) DEFAULT 0 CHECK (financial_progress >= 0 AND financial_progress <= 100),
  contract_amount DECIMAL(15,2) DEFAULT 0,
  total_expense DECIMAL(15,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  tender_date DATE,
  tender_type VARCHAR(100),
  contractor TEXT,
  description TEXT,
  strategic_plan_id UUID,
  last_update_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, project_no, year)
);

CREATE INDEX idx_projects_organization ON projects(organization_id);
CREATE INDEX idx_projects_source ON projects(source);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_year_period ON projects(year, period);

-- TABLO 2: project_progress (İlerleme Kayıtları)
CREATE TABLE IF NOT EXISTS project_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_physical DECIMAL(5,2) DEFAULT 0,
  new_physical DECIMAL(5,2) NOT NULL CHECK (new_physical >= 0 AND new_physical <= 100),
  previous_financial DECIMAL(5,2) DEFAULT 0,
  new_financial DECIMAL(5,2) NOT NULL CHECK (new_financial >= 0 AND new_financial <= 100),
  expense_amount DECIMAL(15,2) DEFAULT 0,
  description TEXT NOT NULL,
  recorded_by VARCHAR(200),
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_progress_project ON project_progress(project_id);
CREATE INDEX idx_project_progress_date ON project_progress(record_date);

-- TABLO 3: project_files (Proje Dosyaları)
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  progress_id UUID REFERENCES project_progress(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'pdf', 'excel', 'word', 'other')),
  file_size INTEGER,
  category VARCHAR(30) NOT NULL CHECK (category IN ('progress_photo', 'contract', 'hakedis', 'report', 'other')),
  description VARCHAR(500),
  uploaded_by VARCHAR(200),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_files_project ON project_files(project_id);
CREATE INDEX idx_project_files_progress ON project_files(progress_id);
CREATE INDEX idx_project_files_category ON project_files(category);

-- TABLO 4: pm_strategic_plans (Proje Yönetimine Özel Basit SP)
CREATE TABLE IF NOT EXISTS pm_strategic_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('goal', 'objective', 'indicator')),
  parent_id UUID REFERENCES pm_strategic_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

CREATE INDEX idx_pm_strategic_plans_org ON pm_strategic_plans(organization_id);
CREATE INDEX idx_pm_strategic_plans_type ON pm_strategic_plans(type);
CREATE INDEX idx_pm_strategic_plans_parent ON pm_strategic_plans(parent_id);

-- strategic_plan_id foreign key ekle
ALTER TABLE projects 
  ADD CONSTRAINT fk_projects_strategic_plan 
  FOREIGN KEY (strategic_plan_id) 
  REFERENCES pm_strategic_plans(id) 
  ON DELETE SET NULL;

-- TABLO 5: ilyas_details (İLYAS'a Özel Alanlar)
CREATE TABLE IF NOT EXISTS ilyas_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  reference_code VARCHAR(50),
  investor_organization VARCHAR(200),
  handover_date DATE,
  year_budget DECIMAL(15,2),
  prev_years_expense DECIMAL(15,2),
  period1_expense DECIMAL(15,2),
  period1_physical DECIMAL(5,2),
  period2_expense DECIMAL(15,2),
  period2_physical DECIMAL(5,2),
  period3_expense DECIMAL(15,2),
  period3_physical DECIMAL(5,2),
  period4_expense DECIMAL(15,2),
  period4_physical DECIMAL(5,2),
  completion_year VARCHAR(20),
  notes TEXT
);

CREATE INDEX idx_ilyas_details_project ON ilyas_details(project_id);

-- TABLO 6: declaration_details (Beyanname'ye Özel Alanlar)
CREATE TABLE IF NOT EXISTS declaration_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  declaration_type VARCHAR(20) CHECK (declaration_type IN ('district', 'province')),
  election_period VARCHAR(20),
  district VARCHAR(100),
  district_order_no INTEGER,
  cumulative_order_no INTEGER,
  tender_status VARCHAR(20) CHECK (tender_status IN ('not_required', 'in_progress', 'completed')),
  is_public_investment BOOLEAN DEFAULT false,
  department VARCHAR(200)
);

CREATE INDEX idx_declaration_details_project ON declaration_details(project_id);

-- Trigger: project_progress eklendiğinde projects tablosunu güncelle
CREATE OR REPLACE FUNCTION update_project_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET 
    physical_progress = NEW.new_physical,
    financial_progress = NEW.new_financial,
    total_expense = COALESCE(total_expense, 0) + COALESCE(NEW.expense_amount, 0),
    last_update_date = NOW(),
    updated_at = NOW()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_project_on_progress
  AFTER INSERT ON project_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_project_on_progress();

-- RLS: projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their organization"
  ON projects FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "Admins and directors can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS: project_progress
ALTER TABLE project_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view progress in their organization"
  ON project_progress FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert progress"
  ON project_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can update progress"
  ON project_progress FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'director', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can delete progress"
  ON project_progress FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- RLS: project_files
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their organization"
  ON project_files FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload files"
  ON project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can delete files"
  ON project_files FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- RLS: pm_strategic_plans
ALTER TABLE pm_strategic_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view strategic plans in their organization"
  ON pm_strategic_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage strategic plans"
  ON pm_strategic_plans FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS: ilyas_details
ALTER TABLE ilyas_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ilyas details in their organization"
  ON ilyas_details FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage ilyas details"
  ON ilyas_details FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'director', 'super_admin')
      )
    )
  );

-- RLS: declaration_details
ALTER TABLE declaration_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view declaration details in their organization"
  ON declaration_details FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage declaration details"
  ON declaration_details FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'director', 'super_admin')
      )
    )
  );
