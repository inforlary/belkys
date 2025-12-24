/*
  # Belediye Stratejik Planlama Sistemi

  ## Genel Bakış
  Bu migration, belediyelerin 5 yıllık stratejik planlarını dijital ortamda yönetebilmesi için
  gerekli tüm veri yapılarını oluşturur. Sistem çok kiracılı (multi-tenant) mimariye uygun
  olarak tasarlanmıştır.

  ## Yeni Tablolar

  ### 1. organizations (Belediyeler)
    - `id` (uuid, primary key) - Benzersiz belediye kimliği
    - `name` (text) - Belediye adı
    - `code` (text, unique) - Belediye kodu (örn: IST-001)
    - `city` (text) - İl
    - `district` (text) - İlçe
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ### 2. profiles (Kullanıcı Profilleri)
    - `id` (uuid, primary key, foreign key to auth.users) - Kullanıcı kimliği
    - `organization_id` (uuid, foreign key) - Bağlı olduğu belediye
    - `email` (text) - E-posta adresi
    - `full_name` (text) - Tam adı
    - `role` (text) - Rol (admin, manager, user)
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ### 3. strategic_plans (Stratejik Planlar)
    - `id` (uuid, primary key) - Plan kimliği
    - `organization_id` (uuid, foreign key) - Belediye kimliği
    - `name` (text) - Plan adı
    - `start_year` (integer) - Başlangıç yılı
    - `end_year` (integer) - Bitiş yılı
    - `description` (text) - Açıklama
    - `status` (text) - Durum (draft, active, completed)
    - `created_by` (uuid, foreign key) - Oluşturan kullanıcı
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ### 4. objectives (Amaçlar)
    - `id` (uuid, primary key) - Amaç kimliği
    - `strategic_plan_id` (uuid, foreign key) - Bağlı olduğu plan
    - `organization_id` (uuid, foreign key) - Belediye kimliği
    - `code` (text) - Amaç kodu (örn: A1, A2)
    - `title` (text) - Amaç başlığı
    - `description` (text) - Açıklama
    - `order_number` (integer) - Sıra numarası
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ### 5. goals (Hedefler)
    - `id` (uuid, primary key) - Hedef kimliği
    - `objective_id` (uuid, foreign key) - Bağlı olduğu amaç
    - `organization_id` (uuid, foreign key) - Belediye kimliği
    - `code` (text) - Hedef kodu (örn: H1.1, H1.2)
    - `title` (text) - Hedef başlığı
    - `description` (text) - Açıklama
    - `order_number` (integer) - Sıra numarası
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ### 6. indicators (Performans Göstergeleri)
    - `id` (uuid, primary key) - Gösterge kimliği
    - `goal_id` (uuid, foreign key) - Bağlı olduğu hedef
    - `organization_id` (uuid, foreign key) - Belediye kimliği
    - `name` (text) - Gösterge adı
    - `unit` (text) - Birim (adet, %, TL, vb.)
    - `baseline_value` (numeric) - Başlangıç değeri
    - `target_value` (numeric) - Hedef değer
    - `target_year` (integer) - Hedef yıl
    - `current_value` (numeric) - Güncel değer
    - `measurement_frequency` (text) - Ölçüm sıklığı (yearly, quarterly, monthly)
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ### 7. activities (Faaliyetler/Projeler)
    - `id` (uuid, primary key) - Faaliyet kimliği
    - `goal_id` (uuid, foreign key) - Bağlı olduğu hedef
    - `organization_id` (uuid, foreign key) - Belediye kimliği
    - `code` (text) - Faaliyet kodu
    - `title` (text) - Faaliyet başlığı
    - `description` (text) - Açıklama
    - `start_date` (date) - Başlangıç tarihi
    - `end_date` (date) - Bitiş tarihi
    - `responsible_department` (text) - Sorumlu müdürlük
    - `status` (text) - Durum (planned, ongoing, completed, delayed, cancelled)
    - `budget` (numeric) - Bütçe
    - `progress_percentage` (integer) - İlerleme yüzdesi (0-100)
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı
    - `updated_at` (timestamptz) - Son güncelleme zamanı

  ## Güvenlik (Row Level Security)
  
  Her tablo için RLS aktif edilmiştir ve kullanıcılar yalnızca kendi belediyelerine
  ait verilere erişebilir. Politikalar:
  
  - SELECT: Kullanıcı kendi organization_id'sine sahip kayıtları görebilir
  - INSERT: Kullanıcı kendi organization_id'si ile kayıt oluşturabilir
  - UPDATE: Kullanıcı kendi organization_id'sine sahip kayıtları güncelleyebilir
  - DELETE: Kullanıcı kendi organization_id'sine sahip kayıtları silebilir

  ## Önemli Notlar
  
  1. Tüm tablolar organization_id ile izole edilmiştir (multi-tenant)
  2. Cascade delete: Bir plan silindiğinde tüm alt kayıtlar da silinir
  3. created_at ve updated_at otomatik yönetilir
  4. Indexler performans için eklenmiştir
*/

-- Organizations tablosu
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  city text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles tablosu (auth.users ile ilişkili)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Strategic Plans tablosu
CREATE TABLE IF NOT EXISTS strategic_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Objectives tablosu
CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_plan_id uuid NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  order_number integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Goals tablosu
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  order_number integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indicators tablosu
CREATE TABLE IF NOT EXISTS indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL,
  baseline_value numeric DEFAULT 0,
  target_value numeric NOT NULL,
  target_year integer NOT NULL,
  current_value numeric DEFAULT 0,
  measurement_frequency text NOT NULL DEFAULT 'yearly',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activities tablosu
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  responsible_department text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  budget numeric DEFAULT 0,
  progress_percentage integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexler (Performans için)
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_strategic_plans_organization ON strategic_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_objectives_organization ON objectives(organization_id);
CREATE INDEX IF NOT EXISTS idx_objectives_plan ON objectives(strategic_plan_id);
CREATE INDEX IF NOT EXISTS idx_goals_organization ON goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_goals_objective ON goals(objective_id);
CREATE INDEX IF NOT EXISTS idx_indicators_organization ON indicators(organization_id);
CREATE INDEX IF NOT EXISTS idx_indicators_goal ON indicators(goal_id);
CREATE INDEX IF NOT EXISTS idx_activities_organization ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_goal ON activities(goal_id);

-- Updated_at otomatik güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'lar
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strategic_plans_updated_at ON strategic_plans;
CREATE TRIGGER update_strategic_plans_updated_at BEFORE UPDATE ON strategic_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_objectives_updated_at ON objectives;
CREATE TRIGGER update_objectives_updated_at BEFORE UPDATE ON objectives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_indicators_updated_at ON indicators;
CREATE TRIGGER update_indicators_updated_at BEFORE UPDATE ON indicators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_activities_updated_at ON activities;
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Aktif Et
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Organizations Policies
CREATE POLICY "Kullanıcılar kendi belediyelerini görüntüleyebilir"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Profiles Policies
CREATE POLICY "Kullanıcılar kendi profillerini görüntüleyebilir"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Kullanıcılar kendi profillerini güncelleyebilir"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Strategic Plans Policies
CREATE POLICY "Kullanıcılar kendi belediyelerinin planlarını görüntüleyebilir"
  ON strategic_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyeleri için plan oluşturabilir"
  ON strategic_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin planlarını güncelleyebilir"
  ON strategic_plans FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin planlarını silebilir"
  ON strategic_plans FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Objectives Policies
CREATE POLICY "Kullanıcılar kendi belediyelerinin amaçlarını görüntüleyebilir"
  ON objectives FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyeleri için amaç oluşturabilir"
  ON objectives FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin amaçlarını güncelleyebilir"
  ON objectives FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin amaçlarını silebilir"
  ON objectives FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Goals Policies
CREATE POLICY "Kullanıcılar kendi belediyelerinin hedeflerini görüntüleyebilir"
  ON goals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyeleri için hedef oluşturabilir"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin hedeflerini güncelleyebilir"
  ON goals FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin hedeflerini silebilir"
  ON goals FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Indicators Policies
CREATE POLICY "Kullanıcılar kendi belediyelerinin göstergelerini görüntüleyebilir"
  ON indicators FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyeleri için gösterge oluşturabilir"
  ON indicators FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin göstergelerini güncelleyebilir"
  ON indicators FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin göstergelerini silebilir"
  ON indicators FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Activities Policies
CREATE POLICY "Kullanıcılar kendi belediyelerinin faaliyetlerini görüntüleyebilir"
  ON activities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyeleri için faaliyet oluşturabilir"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin faaliyetlerini güncelleyebilir"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Kullanıcılar kendi belediyelerinin faaliyetlerini silebilir"
  ON activities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
