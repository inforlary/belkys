/*
  # DÖF (Düzeltici ve Önleyici Faaliyet) Yönetim Sistemi

  1. Yeni Tablolar
    - `qm_nonconformities` - DÖF ana tablosu
      - Uygunsuzluk bilgileri
      - Kaynak bilgisi (iç tetkik, dış tetkik, müşteri şikayeti, vb.)
      - Acil düzeltme (correction)
      - Kök neden analizi
      - Sorumluluk bilgileri
      - Durum takibi (OPEN, ANALYSIS, IN_PROGRESS, VERIFICATION, EFFECTIVENESS, CLOSED)
      - Etkinlik değerlendirmesi
      
    - `qm_corrective_actions` - Düzeltici/Önleyici faaliyetler
      - Faaliyet açıklaması
      - Tür (CORRECTIVE/PREVENTIVE)
      - Sorumluluk ve tarihler
      - Durum takibi
      
    - `qm_nonconformity_attachments` - DÖF ekleri/kanıtları
      - Dosya bilgileri
      - Upload yönetimi

  2. Güvenlik
    - RLS politikaları organization_id bazlı
    - Kullanıcılar sadece kendi organizasyonlarının DÖF'lerini görebilir
    - Super admin tüm DÖF'leri görebilir
    
  3. İndeksler
    - Performans optimizasyonu için gerekli indeksler
*/

-- DÖF Ana Tablosu
CREATE TABLE IF NOT EXISTS qm_nonconformities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Temel Bilgiler
  code VARCHAR(20) NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  
  -- Kaynak Bilgisi
  source VARCHAR(30) NOT NULL CHECK (source IN (
    'INTERNAL_AUDIT',      -- İç Tetkik
    'EXTERNAL_AUDIT',      -- Dış Tetkik
    'CUSTOMER_COMPLAINT',  -- Müşteri Şikayeti
    'PROCESS_ERROR',       -- Süreç Hatası
    'EMPLOYEE_REPORT',     -- Personel Bildirimi
    'MANAGEMENT_REVIEW',   -- YGG
    'INSPECTION',          -- Muayene/Kontrol
    'OTHER'                -- Diğer
  )),
  source_reference VARCHAR(100),
  
  -- İlişkiler
  process_id UUID REFERENCES qm_processes(id),
  department_id UUID REFERENCES departments(id),
  audit_id UUID,
  
  -- Tespit Bilgileri
  detected_date DATE NOT NULL DEFAULT CURRENT_DATE,
  detected_by UUID REFERENCES profiles(id),
  
  -- Acil Düzeltme (Correction)
  immediate_action TEXT,
  immediate_action_date DATE,
  immediate_action_by UUID REFERENCES profiles(id),
  
  -- Kök Neden Analizi
  root_cause_method VARCHAR(30) CHECK (root_cause_method IN (
    'FIVE_WHY',           -- 5 Neden
    'FISHBONE',           -- Balık Kılçığı
    'PARETO',             -- Pareto
    'FAULT_TREE',         -- Hata Ağacı
    'OTHER'               -- Diğer
  )),
  root_cause_analysis TEXT,
  root_causes TEXT,
  
  -- Sorumluluk
  responsible_id UUID REFERENCES profiles(id),
  responsible_department_id UUID REFERENCES departments(id),
  
  -- Tarihler
  target_date DATE,
  closed_date DATE,
  
  -- Durum
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN (
    'OPEN',                -- Açık
    'ANALYSIS',            -- Analiz Aşamasında
    'ACTION_PLANNED',      -- Faaliyet Planlandı
    'IN_PROGRESS',         -- Uygulanıyor
    'VERIFICATION',        -- Doğrulama Bekliyor
    'EFFECTIVENESS',       -- Etkinlik Değerlendirmesi
    'CLOSED',              -- Kapatıldı
    'CANCELLED'            -- İptal
  )),
  
  -- Etkinlik Değerlendirmesi
  effectiveness_check_date DATE,
  effectiveness_result VARCHAR(20) CHECK (effectiveness_result IN ('EFFECTIVE', 'NOT_EFFECTIVE', 'PARTIAL')),
  effectiveness_notes TEXT,
  effectiveness_checked_by UUID REFERENCES profiles(id),
  
  -- Kapatma
  closure_notes TEXT,
  closed_by UUID REFERENCES profiles(id),
  
  -- Meta
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(organization_id, code)
);

-- Düzeltici Faaliyetler
CREATE TABLE IF NOT EXISTS qm_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonconformity_id UUID REFERENCES qm_nonconformities(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  code VARCHAR(20),
  description TEXT NOT NULL,
  action_type VARCHAR(20) DEFAULT 'CORRECTIVE' CHECK (action_type IN (
    'CORRECTIVE',    -- Düzeltici
    'PREVENTIVE'     -- Önleyici
  )),
  
  responsible_id UUID REFERENCES profiles(id),
  responsible_department_id UUID REFERENCES departments(id),
  
  target_date DATE,
  completed_date DATE,
  
  status VARCHAR(20) DEFAULT 'PLANNED' CHECK (status IN (
    'PLANNED',       -- Planlandı
    'IN_PROGRESS',   -- Devam Ediyor
    'COMPLETED',     -- Tamamlandı
    'CANCELLED'      -- İptal
  )),
  
  completion_notes TEXT,
  evidence TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DÖF Ekleri/Kanıtları
CREATE TABLE IF NOT EXISTS qm_nonconformity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonconformity_id UUID REFERENCES qm_nonconformities(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  description TEXT,
  
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_qm_nonconformities_org ON qm_nonconformities(organization_id);
CREATE INDEX IF NOT EXISTS idx_qm_nonconformities_status ON qm_nonconformities(status);
CREATE INDEX IF NOT EXISTS idx_qm_nonconformities_code ON qm_nonconformities(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_qm_corrective_actions_nc ON qm_corrective_actions(nonconformity_id);
CREATE INDEX IF NOT EXISTS idx_qm_corrective_actions_org ON qm_corrective_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_qm_nc_attachments_nc ON qm_nonconformity_attachments(nonconformity_id);

-- RLS Policies

-- qm_nonconformities
ALTER TABLE qm_nonconformities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view nonconformities in their organization"
  ON qm_nonconformities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all nonconformities"
  ON qm_nonconformities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert nonconformities in their organization"
  ON qm_nonconformities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update nonconformities in their organization"
  ON qm_nonconformities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete nonconformities in their organization"
  ON qm_nonconformities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- qm_corrective_actions
ALTER TABLE qm_corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view corrective actions in their organization"
  ON qm_corrective_actions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all corrective actions"
  ON qm_corrective_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert corrective actions in their organization"
  ON qm_corrective_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update corrective actions in their organization"
  ON qm_corrective_actions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete corrective actions in their organization"
  ON qm_corrective_actions FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- qm_nonconformity_attachments
ALTER TABLE qm_nonconformity_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their organization"
  ON qm_nonconformity_attachments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all attachments"
  ON qm_nonconformity_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert attachments in their organization"
  ON qm_nonconformity_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments in their organization"
  ON qm_nonconformity_attachments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Otomatik kod üretimi için fonksiyon
CREATE OR REPLACE FUNCTION generate_nonconformity_code(org_id UUID, p_year INT)
RETURNS VARCHAR(20) AS $$
DECLARE
  next_number INT;
  new_code VARCHAR(20);
BEGIN
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(code FROM 'DOF-' || p_year::TEXT || '-(.*)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM qm_nonconformities
  WHERE organization_id = org_id
    AND code LIKE 'DOF-' || p_year::TEXT || '-%';
  
  new_code := 'DOF-' || p_year::TEXT || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otomatik kod atama trigger'ı
CREATE OR REPLACE FUNCTION auto_assign_nonconformity_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_nonconformity_code(
      NEW.organization_id, 
      EXTRACT(YEAR FROM CURRENT_DATE)::INT
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_nonconformity_code
  BEFORE INSERT ON qm_nonconformities
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_nonconformity_code();

-- Storage bucket for DOF attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('dof-attachments', 'dof-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload DOF attachments in their org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dof-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view DOF attachments in their org"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dof-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete DOF attachments in their org"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dof-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );
