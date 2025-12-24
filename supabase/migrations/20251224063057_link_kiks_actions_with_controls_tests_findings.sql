/*
  # KİKS Eylem Planları ile Kontrol, Test, Bulgu ve CAPA Entegrasyonu
  
  İç Kontrol Yönetmeliği ve KİKS Tebliği'ne göre:
  - Eylem planları → Kontrol faaliyetleri oluşturulmalı
  - Kontroller → Test edilmeli
  - Testler → Bulgular üretmeli (varsa)
  - Bulgular → CAPA/DÖF ile çözülmeli
  
  1. Yeni Alanlar
    - `ic_controls` tablosuna `kiks_action_id` (eylem planı bağlantısı)
    - `ic_controls` tablosuna `ic_plan_id` (iç kontrol planı bağlantısı)
    - `ic_control_tests` tablosuna `kiks_action_id` (eylem planı bağlantısı)
    - `ic_findings` tablosuna `kiks_action_id` (eylem planı bağlantısı)
    - `ic_capas` tablosuna `kiks_action_id` (eylem planı bağlantısı)
    - `ic_capas` tablosuna `kiks_standard_id` (standart bağlantısı)
    
  2. İlişki Zinciri
    KİKS Genel Şartı → Mevcut Durum → Eylem Planı → Kontrol → Test → Bulgu → CAPA
    
  3. Özellikler
    - Eylem planlarından kontroller oluşturulabilir
    - Kontrol testleri eylem planlarıyla ilişkilendirilir
    - Bulgular hangi eylem planından kaynaklandığını gösterir
    - CAPA'lar hem eylem hem standart bazlı izlenebilir
    
  4. Notlar
    - Mevcut veriler korunur
    - Tüm ilişkiler opsiyoneldir
    - Cascade delete yapılandırılmıştır
*/

-- ============================================
-- YENİ ALAN EKLEMELERİ
-- ============================================

-- ic_controls tablosuna kiks_action_id ve ic_plan_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_controls' AND column_name = 'kiks_action_id'
  ) THEN
    ALTER TABLE ic_controls 
    ADD COLUMN kiks_action_id uuid REFERENCES ic_kiks_actions(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_controls_kiks_action ON ic_controls(kiks_action_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_controls' AND column_name = 'ic_plan_id'
  ) THEN
    ALTER TABLE ic_controls 
    ADD COLUMN ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE;
    CREATE INDEX idx_ic_controls_ic_plan ON ic_controls(ic_plan_id);
  END IF;
END $$;

-- ic_control_tests tablosuna kiks_action_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_control_tests' AND column_name = 'kiks_action_id'
  ) THEN
    ALTER TABLE ic_control_tests 
    ADD COLUMN kiks_action_id uuid REFERENCES ic_kiks_actions(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_control_tests_kiks_action ON ic_control_tests(kiks_action_id);
  END IF;
END $$;

-- ic_findings tablosuna kiks_action_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_findings' AND column_name = 'kiks_action_id'
  ) THEN
    ALTER TABLE ic_findings 
    ADD COLUMN kiks_action_id uuid REFERENCES ic_kiks_actions(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_findings_kiks_action ON ic_findings(kiks_action_id);
  END IF;
END $$;

-- ic_capas tablosuna kiks_action_id ve kiks_standard_id ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_capas' AND column_name = 'kiks_action_id'
  ) THEN
    ALTER TABLE ic_capas 
    ADD COLUMN kiks_action_id uuid REFERENCES ic_kiks_actions(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_capas_kiks_action ON ic_capas(kiks_action_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_capas' AND column_name = 'kiks_standard_id'
  ) THEN
    ALTER TABLE ic_capas 
    ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
    CREATE INDEX idx_ic_capas_kiks_standard ON ic_capas(kiks_standard_id);
  END IF;
END $$;

-- ============================================
-- OTOMATİK İLİŞKİLENDİRME TRİGGERLARI
-- ============================================

-- Kontrolden teste eylem planı aktarımı
CREATE OR REPLACE FUNCTION auto_inherit_action_from_control()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer eylem planı belirtilmemişse ve kontrol belirtilmişse, kontroldeki eylem planını al
  IF NEW.kiks_action_id IS NULL AND NEW.control_id IS NOT NULL THEN
    SELECT kiks_action_id INTO NEW.kiks_action_id
    FROM ic_controls
    WHERE id = NEW.control_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_action_from_control ON ic_control_tests;
CREATE TRIGGER trigger_auto_inherit_action_from_control
  BEFORE INSERT ON ic_control_tests
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_action_from_control();

-- Bulgu oluşturulurken, kontrolden veya testten eylem planını al
CREATE OR REPLACE FUNCTION auto_inherit_action_for_finding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer eylem planı belirtilmemişse
  IF NEW.kiks_action_id IS NULL THEN
    -- Önce kontrolden almayı dene
    IF NEW.control_id IS NOT NULL THEN
      SELECT kiks_action_id INTO NEW.kiks_action_id
      FROM ic_controls
      WHERE id = NEW.control_id;
    END IF;
    
    -- Kontrolde yoksa, testten almayı dene
    IF NEW.kiks_action_id IS NULL AND NEW.control_test_id IS NOT NULL THEN
      SELECT kiks_action_id INTO NEW.kiks_action_id
      FROM ic_control_tests
      WHERE id = NEW.control_test_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_action_for_finding ON ic_findings;
CREATE TRIGGER trigger_auto_inherit_action_for_finding
  BEFORE INSERT ON ic_findings
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_action_for_finding();

-- CAPA oluşturulurken, bulgudan eylem planını ve standardı al
CREATE OR REPLACE FUNCTION auto_inherit_action_and_standard_for_capa()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eğer bulgu belirtilmişse, bulgudan bilgileri al
  IF NEW.finding_id IS NOT NULL THEN
    -- Eylem planını al
    IF NEW.kiks_action_id IS NULL THEN
      SELECT kiks_action_id INTO NEW.kiks_action_id
      FROM ic_findings
      WHERE id = NEW.finding_id;
    END IF;
    
    -- KİKS standardını al
    IF NEW.kiks_standard_id IS NULL THEN
      SELECT kiks_standard_id INTO NEW.kiks_standard_id
      FROM ic_findings
      WHERE id = NEW.finding_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_inherit_for_capa ON ic_capas;
CREATE TRIGGER trigger_auto_inherit_for_capa
  BEFORE INSERT ON ic_capas
  FOR EACH ROW
  EXECUTE FUNCTION auto_inherit_action_and_standard_for_capa();

-- ============================================
-- YARDIMCI VİEW: EYLEM PLANI İÇİN KONTROL ÖZETİ
-- ============================================

CREATE OR REPLACE VIEW v_action_plan_control_summary AS
SELECT 
  ap.id AS action_plan_id,
  ap.plan_code,
  ka.code AS kiks_action_code,
  ka.description AS kiks_action_description,
  COUNT(DISTINCT c.id) AS total_controls,
  COUNT(DISTINCT ct.id) AS total_tests,
  COUNT(DISTINCT CASE WHEN ct.test_result = 'fail' THEN ct.id END) AS failed_tests,
  COUNT(DISTINCT f.id) AS total_findings,
  COUNT(DISTINCT cap.id) AS total_capas,
  COUNT(DISTINCT CASE WHEN cap.status = 'closed' THEN cap.id END) AS closed_capas
FROM ic_action_plans ap
LEFT JOIN ic_kiks_actions ka ON ap.kiks_action_id = ka.id
LEFT JOIN ic_controls c ON c.kiks_action_id = ka.id
LEFT JOIN ic_control_tests ct ON ct.control_id = c.id
LEFT JOIN ic_findings f ON f.control_id = c.id OR f.control_test_id = ct.id
LEFT JOIN ic_capas cap ON cap.finding_id = f.id
GROUP BY ap.id, ap.plan_code, ka.code, ka.description;

COMMENT ON VIEW v_action_plan_control_summary IS 
'Eylem planları için kontrol, test, bulgu ve CAPA özetini gösterir';
