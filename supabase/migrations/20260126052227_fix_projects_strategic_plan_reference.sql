/*
  # Projelerdeki Stratejik Plan Referansını Düzelt

  1. Değişiklikler
    - pm_strategic_plans tablosuna referans yerine strategic_plans tablosuna referans ekle
    - Amaç ve hedef seçimi için yeni alanlar ekle

  2. Güvenlik
    - Mevcut RLS politikaları korunur
*/

-- Eski constraint'i kaldır
ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_strategic_plan;

-- Stratejik plan referansını strategic_plans tablosuna bağla
ALTER TABLE projects
  ADD CONSTRAINT fk_projects_strategic_plan
  FOREIGN KEY (strategic_plan_id)
  REFERENCES strategic_plans(id)
  ON DELETE SET NULL;

-- Amaç ve hedef seçimi için yeni alanlar ekle
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_projects_strategic_plan ON projects(strategic_plan_id);
CREATE INDEX IF NOT EXISTS idx_projects_objective ON projects(objective_id);
CREATE INDEX IF NOT EXISTS idx_projects_goal ON projects(goal_id);
