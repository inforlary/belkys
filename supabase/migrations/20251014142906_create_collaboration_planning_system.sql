/*
  # Birim İşbirliği Planlama Sistemi
  
  ## Genel Bakış
  Yönetici (admin) paneli için birim bazlı işbirliği planlama modülü.
  Sol tarafta kategoriler, sağ tarafta madde madde girişler yapılabilecek yapı.
  
  ## 1. Yeni Tablolar
  
  ### `collaboration_plans`
  Ana işbirliği planı kayıtları
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `organization_id` (uuid, foreign key) - Organizasyon kimliği
  - `responsible_department_id` (uuid, foreign key) - Sorumlu birim/müdürlük
  - `title` (text) - Plan başlığı
  - `year` (integer) - Plan yılı
  - `description` (text, nullable) - Açıklama
  - `total_budget` (numeric, nullable) - Toplam bütçe
  - `status` (text) - Durum: 'draft', 'active', 'completed'
  - `created_by` (uuid, foreign key) - Oluşturan kullanıcı
  - `created_at` (timestamptz) - Oluşturulma zamanı
  - `updated_at` (timestamptz) - Güncellenme zamanı
  
  ### `collaboration_plan_items`
  Plan içindeki madde madde girişler
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `plan_id` (uuid, foreign key) - İşbirliği planı
  - `category` (text) - Kategori: 'risk', 'activity_project', 'cost_estimate', 'finding', 'need'
  - `content` (text) - Madde içeriği
  - `order_index` (integer) - Sıralama indeksi
  - `created_at` (timestamptz) - Oluşturulma zamanı
  - `updated_at` (timestamptz) - Güncellenme zamanı
  
  ### `collaboration_plan_partners`
  Plana dahil edilen işbirlikçi birimler
  - `id` (uuid, primary key) - Benzersiz tanımlayıcı
  - `plan_id` (uuid, foreign key) - İşbirliği planı
  - `department_id` (uuid, foreign key) - İşbirlikçi birim
  - `created_at` (timestamptz) - Oluşturulma zamanı
  
  ## 2. Güvenlik (RLS)
  
  Her tablo için Row Level Security (RLS) etkinleştirilir:
  - **Admin kullanıcılar**: Tüm işlemler yapabilir
  - **Diğer kullanıcılar**: Sadece görüntüleme
  
  ## 3. İndeksler
  
  Performans için gerekli indeksler oluşturulur.
*/

-- collaboration_plans table
CREATE TABLE IF NOT EXISTS collaboration_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsible_department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title text NOT NULL,
  year integer NOT NULL,
  description text,
  total_budget numeric(15, 2),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- collaboration_plan_items table
CREATE TABLE IF NOT EXISTS collaboration_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES collaboration_plans(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('risk', 'activity_project', 'cost_estimate', 'finding', 'need')),
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- collaboration_plan_partners table
CREATE TABLE IF NOT EXISTS collaboration_plan_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES collaboration_plans(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, department_id)
);

-- Enable RLS
ALTER TABLE collaboration_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_plan_partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collaboration_plans
CREATE POLICY "Admin users can view all collaboration plans"
  ON collaboration_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert collaboration plans"
  ON collaboration_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update collaboration plans"
  ON collaboration_plans FOR UPDATE
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

CREATE POLICY "Admin users can delete collaboration plans"
  ON collaboration_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for collaboration_plan_items
CREATE POLICY "Users can view collaboration plan items"
  ON collaboration_plan_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaboration_plans
      WHERE collaboration_plans.id = collaboration_plan_items.plan_id
    )
  );

CREATE POLICY "Admin users can insert collaboration plan items"
  ON collaboration_plan_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update collaboration plan items"
  ON collaboration_plan_items FOR UPDATE
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

CREATE POLICY "Admin users can delete collaboration plan items"
  ON collaboration_plan_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for collaboration_plan_partners
CREATE POLICY "Users can view collaboration plan partners"
  ON collaboration_plan_partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaboration_plans
      WHERE collaboration_plans.id = collaboration_plan_partners.plan_id
    )
  );

CREATE POLICY "Admin users can insert collaboration plan partners"
  ON collaboration_plan_partners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete collaboration plan partners"
  ON collaboration_plan_partners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collaboration_plans_org_id ON collaboration_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_plans_dept_id ON collaboration_plans(responsible_department_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_plan_items_plan_id ON collaboration_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_plan_items_category ON collaboration_plan_items(category);
CREATE INDEX IF NOT EXISTS idx_collaboration_plan_partners_plan_id ON collaboration_plan_partners(plan_id);