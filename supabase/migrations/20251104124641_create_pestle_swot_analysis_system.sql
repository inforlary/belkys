/*
  # PESTLE ve SWOT Analizi Sistemi

  1. Yeni Tablolar
    - `pestle_analyses`
      - `id` (uuid, primary key)
      - `strategic_plan_id` (uuid, references strategic_plans)
      - `organization_id` (uuid, references organizations)
      - `category` (text: political, economic, social, technological, legal, environmental)
      - `title` (text, başlık)
      - `description` (text, açıklama)
      - `impact_level` (text: high, medium, low - etki seviyesi)
      - `priority` (integer, öncelik sırası)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `swot_analyses`
      - `id` (uuid, primary key)
      - `strategic_plan_id` (uuid, references strategic_plans)
      - `organization_id` (uuid, references organizations)
      - `category` (text: strength, weakness, opportunity, threat)
      - `title` (text, başlık)
      - `description` (text, açıklama)
      - `impact_weight` (integer 1-5, etki ağırlığı)
      - `priority` (integer, öncelik sırası)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `pestle_swot_relations`
      - `id` (uuid, primary key)
      - `pestle_id` (uuid, references pestle_analyses)
      - `swot_id` (uuid, references swot_analyses)
      - `relation_type` (text: causes, affects, related_to)
      - `description` (text, ilişki açıklaması)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)

    - `pestle_analysis_comments`
      - `id` (uuid, primary key)
      - `pestle_id` (uuid, references pestle_analyses)
      - `user_id` (uuid, references profiles)
      - `comment` (text)
      - `created_at` (timestamptz)

    - `swot_analysis_comments`
      - `id` (uuid, primary key)
      - `swot_id` (uuid, references swot_analyses)
      - `user_id` (uuid, references profiles)
      - `comment` (text)
      - `created_at` (timestamptz)

  2. Güvenlik
    - Tüm tablolar için RLS aktif
    - Organizasyon bazlı erişim kontrolü
    - Admin ve manager düzenleme yetkisi
    - Tüm kullanıcılar görüntüleme yetkisi

  3. İndeksler
    - strategic_plan_id üzerinde indeksler
    - organization_id üzerinde indeksler
    - category üzerinde indeksler
*/

-- PESTLE Analizi Tablosu
CREATE TABLE IF NOT EXISTS pestle_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_plan_id uuid NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('political', 'economic', 'social', 'technological', 'legal', 'environmental')),
  title text NOT NULL,
  description text,
  impact_level text NOT NULL DEFAULT 'medium' CHECK (impact_level IN ('high', 'medium', 'low')),
  priority integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pestle_analyses_plan ON pestle_analyses(strategic_plan_id);
CREATE INDEX IF NOT EXISTS idx_pestle_analyses_org ON pestle_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_pestle_analyses_category ON pestle_analyses(category);

-- SWOT Analizi Tablosu
CREATE TABLE IF NOT EXISTS swot_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_plan_id uuid NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('strength', 'weakness', 'opportunity', 'threat')),
  title text NOT NULL,
  description text,
  impact_weight integer DEFAULT 3 CHECK (impact_weight >= 1 AND impact_weight <= 5),
  priority integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swot_analyses_plan ON swot_analyses(strategic_plan_id);
CREATE INDEX IF NOT EXISTS idx_swot_analyses_org ON swot_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_swot_analyses_category ON swot_analyses(category);

-- PESTLE-SWOT İlişki Tablosu
CREATE TABLE IF NOT EXISTS pestle_swot_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pestle_id uuid NOT NULL REFERENCES pestle_analyses(id) ON DELETE CASCADE,
  swot_id uuid NOT NULL REFERENCES swot_analyses(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'related_to' CHECK (relation_type IN ('causes', 'affects', 'related_to')),
  description text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pestle_id, swot_id)
);

CREATE INDEX IF NOT EXISTS idx_pestle_swot_relations_pestle ON pestle_swot_relations(pestle_id);
CREATE INDEX IF NOT EXISTS idx_pestle_swot_relations_swot ON pestle_swot_relations(swot_id);

-- PESTLE Yorum Tablosu
CREATE TABLE IF NOT EXISTS pestle_analysis_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pestle_id uuid NOT NULL REFERENCES pestle_analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pestle_comments_pestle ON pestle_analysis_comments(pestle_id);

-- SWOT Yorum Tablosu
CREATE TABLE IF NOT EXISTS swot_analysis_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_id uuid NOT NULL REFERENCES swot_analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swot_comments_swot ON swot_analysis_comments(swot_id);

-- RLS Politikaları - PESTLE Analyses
ALTER TABLE pestle_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PESTLE analyses in their organization"
  ON pestle_analyses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert PESTLE analyses"
  ON pestle_analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = pestle_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update PESTLE analyses"
  ON pestle_analyses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = pestle_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = pestle_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete PESTLE analyses"
  ON pestle_analyses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = pestle_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- RLS Politikaları - SWOT Analyses
ALTER TABLE swot_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SWOT analyses in their organization"
  ON swot_analyses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert SWOT analyses"
  ON swot_analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = swot_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update SWOT analyses"
  ON swot_analyses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = swot_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = swot_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete SWOT analyses"
  ON swot_analyses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = swot_analyses.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- RLS Politikaları - PESTLE-SWOT Relations
ALTER TABLE pestle_swot_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PESTLE-SWOT relations in their organization"
  ON pestle_swot_relations FOR SELECT
  TO authenticated
  USING (
    pestle_id IN (
      SELECT id FROM pestle_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage PESTLE-SWOT relations"
  ON pestle_swot_relations FOR ALL
  TO authenticated
  USING (
    pestle_id IN (
      SELECT id FROM pestle_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    pestle_id IN (
      SELECT id FROM pestle_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

-- RLS Politikaları - PESTLE Comments
ALTER TABLE pestle_analysis_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PESTLE comments in their organization"
  ON pestle_analysis_comments FOR SELECT
  TO authenticated
  USING (
    pestle_id IN (
      SELECT id FROM pestle_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own PESTLE comments"
  ON pestle_analysis_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND pestle_id IN (
      SELECT id FROM pestle_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own PESTLE comments"
  ON pestle_analysis_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Politikaları - SWOT Comments
ALTER TABLE swot_analysis_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SWOT comments in their organization"
  ON swot_analysis_comments FOR SELECT
  TO authenticated
  USING (
    swot_id IN (
      SELECT id FROM swot_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own SWOT comments"
  ON swot_analysis_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND swot_id IN (
      SELECT id FROM swot_analyses 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own SWOT comments"
  ON swot_analysis_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());