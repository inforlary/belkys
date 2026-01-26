/*
  # Proje Yönetimi Tablolarını Düzelt
  
  1. Değişiklikler
    - project_progress tablosuna organization_id ekle
    - project_files tablosuna organization_id ekle  
    - project_progress'teki recorded_by kolunu UUID foreign key yap
    - projects tablosuna SP bağlantısı için 3 kolon ekle
    - project_files'taki category constraint'ini güncelle
    
  2. Güvenlik
    - Mevcut RLS politikaları korundu
*/

-- project_progress tablosuna organization_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_progress' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_progress 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Mevcut kayıtlar için organization_id'yi projects'ten al
    UPDATE project_progress pp
    SET organization_id = p.organization_id
    FROM projects p
    WHERE pp.project_id = p.id;
    
    -- NOT NULL yap
    ALTER TABLE project_progress 
      ALTER COLUMN organization_id SET NOT NULL;
      
    CREATE INDEX IF NOT EXISTS idx_project_progress_organization ON project_progress(organization_id);
  END IF;
END $$;

-- project_files tablosuna organization_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_files 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Mevcut kayıtlar için organization_id'yi projects'ten al
    UPDATE project_files pf
    SET organization_id = p.organization_id
    FROM projects p
    WHERE pf.project_id = p.id;
    
    -- NOT NULL yap
    ALTER TABLE project_files 
      ALTER COLUMN organization_id SET NOT NULL;
      
    CREATE INDEX IF NOT EXISTS idx_project_files_organization ON project_files(organization_id);
  END IF;
END $$;

-- project_progress'teki recorded_by'ı UUID foreign key yap
DO $$
BEGIN
  -- Önce varchar'dan uuid'ye dönüştür
  ALTER TABLE project_progress 
    ALTER COLUMN recorded_by TYPE UUID USING recorded_by::UUID;
    
  -- Foreign key ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_progress_recorded_by'
  ) THEN
    ALTER TABLE project_progress
      ADD CONSTRAINT fk_project_progress_recorded_by
      FOREIGN KEY (recorded_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Eğer zaten UUID ise veya başka bir hata varsa devam et
    NULL;
END $$;

-- projects tablosuna SP bağlantı kolonları ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'related_objective_id'
  ) THEN
    ALTER TABLE projects 
      ADD COLUMN related_objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'related_goal_id'
  ) THEN
    ALTER TABLE projects 
      ADD COLUMN related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'related_indicator_id'
  ) THEN
    ALTER TABLE projects 
      ADD COLUMN related_indicator_id UUID REFERENCES indicators(id) ON DELETE SET NULL;
  END IF;
END $$;

-- project_files category constraint'ini güncelle
ALTER TABLE project_files 
  DROP CONSTRAINT IF EXISTS project_files_category_check;

ALTER TABLE project_files
  ADD CONSTRAINT project_files_category_check 
  CHECK (category IN ('photo', 'contract', 'hakedis', 'report', 'other'));

-- project_files file_type constraint'ini güncelle
ALTER TABLE project_files 
  DROP CONSTRAINT IF EXISTS project_files_file_type_check;

-- file_type kolonunu text yap ve constraint kaldır (MIME type'lar için)
ALTER TABLE project_files
  ALTER COLUMN file_type TYPE TEXT;
