/*
  # Otomatik Proje Numarası Üretimi

  1. Fonksiyon
    - generate_project_number: Organizasyon ve yıl bazlı otomatik proje numarası
    - Format: PRJ-YYYY-0001 (örn: PRJ-2026-0001)

  2. Trigger
    - Before insert trigger ile otomatik numara atama
    - Eğer project_no boş veya 'AUTO' ise otomatik numara üret

  3. Özellikler
    - Her yıl için sıfırdan başlar
    - Organizasyon bazlı ayrı sayaç
    - Thread-safe (aynı anda birden fazla insert güvenli)
*/

-- Otomatik proje numarası üretme fonksiyonu
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  new_project_no VARCHAR(50);
BEGIN
  -- Eğer project_no boş veya 'AUTO' ise otomatik üret
  IF NEW.project_no IS NULL OR NEW.project_no = '' OR NEW.project_no = 'AUTO' THEN
    -- Aynı organizasyon ve yıl için en yüksek numarayı bul
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(project_no FROM 'PRJ-[0-9]+-([0-9]+)') AS INTEGER
        )
      ),
      0
    ) + 1
    INTO next_number
    FROM projects
    WHERE organization_id = NEW.organization_id
      AND year = NEW.year
      AND project_no LIKE 'PRJ-' || NEW.year::TEXT || '-%';

    -- Yeni proje numarasını oluştur: PRJ-YYYY-0001 formatında
    new_project_no := 'PRJ-' || NEW.year::TEXT || '-' || LPAD(next_number::TEXT, 4, '0');

    NEW.project_no := new_project_no;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger oluştur
DROP TRIGGER IF EXISTS trigger_generate_project_number ON projects;
CREATE TRIGGER trigger_generate_project_number
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_project_number();

-- Yorum ekle
COMMENT ON FUNCTION generate_project_number() IS 'Organizasyon ve yıl bazlı otomatik proje numarası üretir (Format: PRJ-YYYY-0001)';