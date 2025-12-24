/*
  # KİKS Standartları ile İç Kontrol Modüllerinin Entegrasyonu ve Otomatik Kod Üretimi

  1. KİKS Entegrasyonu
    - Tüm iç kontrol tablolarına `kiks_standard_id` alanı eklenir
    - İlişkiler: Süreç → Risk → Kontrol → Test → Bulgu → CAPA → KİKS Standardı
    
  2. Otomatik Kod Üretimi
    - Süreç Kodu: SRC-2024-001
    - Risk Kodu: RSK-2024-001
    - Kontrol Kodu: KTR-2024-001
    - Test Kodu: TST-2024-001
    - Bulgu Kodu: BLG-2024-001
    - CAPA Kodu: CAPA-2024-001
    
  3. Özellikler
    - Kodlar otomatik oluşturulur (trigger ile)
    - Yıl bazlı sıralama
    - Organization bazlı ayrı sekanslar
    - Kullanıcı manuel kod giremez
    
  4. Notlar
    - Mevcut kodlar korunur
    - Yeni kayıtlar otomatik kod alır
    - KİKS ilişkilendirme opsiyoneldir
*/

-- ============================================
-- KİKS STANDARD ID ALANLARI EKLE
-- ============================================

-- ic_processes tablosuna kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_processes' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_processes 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_processes_kiks ON ic_processes(kiks_standard_id);
  END IF;
END $$;

-- ic_risks tablosuna kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_risks' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_risks 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_risks_kiks ON ic_risks(kiks_standard_id);
  END IF;
END $$;

-- ic_controls tablosuna kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_controls' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_controls 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_controls_kiks ON ic_controls(kiks_standard_id);
  END IF;
END $$;

-- ic_control_tests tablosuna test_code ekle (yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_control_tests' AND column_name = 'test_code'
  ) THEN
    ALTER TABLE ic_control_tests 
    ADD COLUMN test_code text,
    ADD CONSTRAINT ic_control_tests_test_code_unique UNIQUE(organization_id, test_code);
  END IF;
END $$;

-- ic_control_tests tablosuna kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_control_tests' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_control_tests 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_control_tests_kiks ON ic_control_tests(kiks_standard_id);
  END IF;
END $$;

-- ic_findings tablosuna kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_findings' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_findings 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_findings_kiks ON ic_findings(kiks_standard_id);
  END IF;
END $$;

-- ic_capas tablosuna kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_capas' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_capas 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_capas_kiks ON ic_capas(kiks_standard_id);
  END IF;
END $$;

-- ============================================
-- OTOMATİK KOD ÜRETME FONKSİYONLARI
-- ============================================

-- Genel otomatik kod üretme fonksiyonu
CREATE OR REPLACE FUNCTION generate_auto_code(
  p_table_name text,
  p_code_prefix text,
  p_organization_id uuid
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_next_number integer;
  v_code text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Son kullanılan numarayı bul
  EXECUTE format(
    'SELECT COALESCE(MAX(
      CASE 
        WHEN %I ~ ''^%s-[0-9]{4}-[0-9]+$'' 
        THEN CAST(SPLIT_PART(%I, ''-'', 3) AS INTEGER)
        ELSE 0
      END
    ), 0) + 1
    FROM %I
    WHERE organization_id = $1
    AND %I LIKE $2',
    CASE p_table_name
      WHEN 'ic_processes' THEN 'code'
      WHEN 'ic_risks' THEN 'risk_code'
      WHEN 'ic_controls' THEN 'control_code'
      WHEN 'ic_control_tests' THEN 'test_code'
      WHEN 'ic_findings' THEN 'finding_code'
      WHEN 'ic_capas' THEN 'capa_code'
    END,
    p_code_prefix,
    CASE p_table_name
      WHEN 'ic_processes' THEN 'code'
      WHEN 'ic_risks' THEN 'risk_code'
      WHEN 'ic_controls' THEN 'control_code'
      WHEN 'ic_control_tests' THEN 'test_code'
      WHEN 'ic_findings' THEN 'finding_code'
      WHEN 'ic_capas' THEN 'capa_code'
    END,
    p_table_name,
    CASE p_table_name
      WHEN 'ic_processes' THEN 'code'
      WHEN 'ic_risks' THEN 'risk_code'
      WHEN 'ic_controls' THEN 'control_code'
      WHEN 'ic_control_tests' THEN 'test_code'
      WHEN 'ic_findings' THEN 'finding_code'
      WHEN 'ic_capas' THEN 'capa_code'
    END
  )
  INTO v_next_number
  USING p_organization_id, p_code_prefix || '-' || v_year || '-%';
  
  -- Kodu oluştur: PREFIX-YEAR-NUMBER (3 haneli)
  v_code := p_code_prefix || '-' || v_year || '-' || LPAD(v_next_number::text, 3, '0');
  
  RETURN v_code;
END;
$$;

-- ============================================
-- SÜREÇ KODU OTOMATİK ÜRET
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_process_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer kod girilmemişse veya boşsa otomatik üret
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_auto_code('ic_processes', 'SRC', NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_process_code ON ic_processes;
CREATE TRIGGER trigger_auto_generate_process_code
  BEFORE INSERT ON ic_processes
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_process_code();

-- ============================================
-- RİSK KODU OTOMATİK ÜRET
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_risk_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer kod girilmemişse veya boşsa otomatik üret
  IF NEW.risk_code IS NULL OR NEW.risk_code = '' THEN
    NEW.risk_code := generate_auto_code('ic_risks', 'RSK', NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_risk_code ON ic_risks;
CREATE TRIGGER trigger_auto_generate_risk_code
  BEFORE INSERT ON ic_risks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_risk_code();

-- ============================================
-- KONTROL KODU OTOMATİK ÜRET
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_control_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer kod girilmemişse veya boşsa otomatik üret
  IF NEW.control_code IS NULL OR NEW.control_code = '' THEN
    NEW.control_code := generate_auto_code('ic_controls', 'KTR', NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_control_code ON ic_controls;
CREATE TRIGGER trigger_auto_generate_control_code
  BEFORE INSERT ON ic_controls
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_control_code();

-- ============================================
-- TEST KODU OTOMATİK ÜRET
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_test_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer kod girilmemişse veya boşsa otomatik üret
  IF NEW.test_code IS NULL OR NEW.test_code = '' THEN
    NEW.test_code := generate_auto_code('ic_control_tests', 'TST', NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_test_code ON ic_control_tests;
CREATE TRIGGER trigger_auto_generate_test_code
  BEFORE INSERT ON ic_control_tests
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_test_code();

-- ============================================
-- BULGU KODU OTOMATİK ÜRET
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_finding_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer kod girilmemişse veya boşsa otomatik üret
  IF NEW.finding_code IS NULL OR NEW.finding_code = '' THEN
    NEW.finding_code := generate_auto_code('ic_findings', 'BLG', NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_finding_code ON ic_findings;
CREATE TRIGGER trigger_auto_generate_finding_code
  BEFORE INSERT ON ic_findings
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_finding_code();

-- ============================================
-- CAPA (DÖF) KODU OTOMATİK ÜRET
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_capa_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer kod girilmemişse veya boşsa otomatik üret
  IF NEW.capa_code IS NULL OR NEW.capa_code = '' THEN
    NEW.capa_code := generate_auto_code('ic_capas', 'CAPA', NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_capa_code ON ic_capas;
CREATE TRIGGER trigger_auto_generate_capa_code
  BEFORE INSERT ON ic_capas
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_capa_code();

-- ============================================
-- KİKS OTOMATİK İLİŞKİLENDİRME
-- ============================================

-- Risk oluşturulurken, eğer süreçte KİKS varsa otomatik ata
CREATE OR REPLACE FUNCTION auto_inherit_kiks_from_process()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer KİKS belirtilmemişse ve süreç belirtilmişse, süreçteki KİKS'i al
  IF NEW.kiks_standard_id IS NULL AND NEW.process_id IS NOT NULL THEN
    SELECT kiks_standard_id INTO NEW.kiks_standard_id
    FROM ic_processes
    WHERE id = NEW.process_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_kiks_from_process_risk ON ic_risks;
CREATE TRIGGER trigger_auto_inherit_kiks_from_process_risk
  BEFORE INSERT ON ic_risks
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_kiks_from_process();

-- Kontrol oluşturulurken, eğer riske göre KİKS varsa otomatik ata
CREATE OR REPLACE FUNCTION auto_inherit_kiks_from_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer KİKS belirtilmemişse ve risk belirtilmişse, riskteki KİKS'i al
  IF NEW.kiks_standard_id IS NULL AND NEW.risk_id IS NOT NULL THEN
    SELECT kiks_standard_id INTO NEW.kiks_standard_id
    FROM ic_risks
    WHERE id = NEW.risk_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_kiks_from_risk_control ON ic_controls;
CREATE TRIGGER trigger_auto_inherit_kiks_from_risk_control
  BEFORE INSERT ON ic_controls
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_kiks_from_risk();

-- Test oluşturulurken, kontrolden KİKS al
CREATE OR REPLACE FUNCTION auto_inherit_kiks_from_control()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer KİKS belirtilmemişse ve kontrol belirtilmişse, kontroldeki KİKS'i al
  IF NEW.kiks_standard_id IS NULL AND NEW.control_id IS NOT NULL THEN
    SELECT kiks_standard_id INTO NEW.kiks_standard_id
    FROM ic_controls
    WHERE id = NEW.control_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_kiks_from_control_test ON ic_control_tests;
CREATE TRIGGER trigger_auto_inherit_kiks_from_control_test
  BEFORE INSERT ON ic_control_tests
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_kiks_from_control();

-- Bulgu oluşturulurken, kontrolden veya riskten KİKS al
CREATE OR REPLACE FUNCTION auto_inherit_kiks_for_finding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer KİKS belirtilmemişse
  IF NEW.kiks_standard_id IS NULL THEN
    -- Önce kontrolden dene
    IF NEW.control_id IS NOT NULL THEN
      SELECT kiks_standard_id INTO NEW.kiks_standard_id
      FROM ic_controls
      WHERE id = NEW.control_id;
    END IF;
    
    -- Eğer hala null ise ve risk varsa, riskten al
    IF NEW.kiks_standard_id IS NULL AND NEW.risk_id IS NOT NULL THEN
      SELECT kiks_standard_id INTO NEW.kiks_standard_id
      FROM ic_risks
      WHERE id = NEW.risk_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_kiks_for_finding ON ic_findings;
CREATE TRIGGER trigger_auto_inherit_kiks_for_finding
  BEFORE INSERT ON ic_findings
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_kiks_for_finding();

-- CAPA oluşturulurken, bulgudan KİKS al
CREATE OR REPLACE FUNCTION auto_inherit_kiks_from_finding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer KİKS belirtilmemişse ve bulgu belirtilmişse, bulgudaki KİKS'i al
  IF NEW.kiks_standard_id IS NULL AND NEW.finding_id IS NOT NULL THEN
    SELECT kiks_standard_id INTO NEW.kiks_standard_id
    FROM ic_findings
    WHERE id = NEW.finding_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_kiks_from_finding_capa ON ic_capas;
CREATE TRIGGER trigger_auto_inherit_kiks_from_finding_capa
  BEFORE INSERT ON ic_capas
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_kiks_from_finding();