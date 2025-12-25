/*
  # Otomatik Kod Üretiminde Race Condition Düzeltmesi

  ## Sorun
  Aynı anda birden fazla kayıt eklendiğinde aynı kod üretiliyor ve 
  unique constraint hatası veriyor.

  ## Çözüm
  1. Advisory lock ile kod üretimini seri hale getir
  2. SECURITY DEFINER ekle
  3. Unique kod garantisi için retry mekanizması

  ## Etkilenen Tablolar
  - ic_processes
  - ic_risks
  - ic_controls
  - ic_control_tests
  - ic_findings
  - ic_capas
*/

-- Güvenli ve race-condition'dan bağımsız kod üretimi
CREATE OR REPLACE FUNCTION generate_auto_code(
  p_table_name text,
  p_code_prefix text,
  p_organization_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year text;
  v_next_number integer;
  v_code text;
  v_lock_key bigint;
  v_attempt integer := 0;
  v_max_attempts integer := 10;
BEGIN
  -- Organization ID'den unique bir lock key üret
  v_lock_key := ('x' || substr(md5(p_organization_id::text || p_table_name), 1, 15))::bit(60)::bigint;
  
  -- Transaction bazında kilit al (otomatik olarak transaction sonunda serbest bırakılır)
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Birkaç deneme yap (eğer başka bir transaction henüz commit olmamışsa)
  WHILE v_attempt < v_max_attempts LOOP
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
    
    -- Kodun unique olup olmadığını kontrol et
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE organization_id = $1 AND %I = $2',
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
    INTO v_attempt
    USING p_organization_id, v_code;
    
    -- Eğer kod zaten yoksa, döndür
    IF v_attempt = 0 THEN
      RETURN v_code;
    END IF;
    
    -- Kod varsa, bir sonraki numarayı dene
    v_attempt := v_attempt + 1;
  END LOOP;
  
  -- Maksimum deneme sayısına ulaşıldıysa hata ver
  RAISE EXCEPTION 'Maksimum kod üretme denemesine ulaşıldı: % için %', p_table_name, p_code_prefix;
END;
$$;

-- Güvenlik: Function'a erişim izni
GRANT EXECUTE ON FUNCTION generate_auto_code(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_auto_code(text, text, uuid) TO service_role;

-- Trigger fonksiyonlarını da SECURITY DEFINER yap
CREATE OR REPLACE FUNCTION auto_generate_process_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_auto_code('ic_processes', 'SRC', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_risk_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.risk_code IS NULL OR NEW.risk_code = '' THEN
    NEW.risk_code := generate_auto_code('ic_risks', 'RSK', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_control_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.control_code IS NULL OR NEW.control_code = '' THEN
    NEW.control_code := generate_auto_code('ic_controls', 'KTR', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_test_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.test_code IS NULL OR NEW.test_code = '' THEN
    NEW.test_code := generate_auto_code('ic_control_tests', 'TST', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_finding_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.finding_code IS NULL OR NEW.finding_code = '' THEN
    NEW.finding_code := generate_auto_code('ic_findings', 'BLG', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_capa_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.capa_code IS NULL OR NEW.capa_code = '' THEN
    NEW.capa_code := generate_auto_code('ic_capas', 'DFO', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;
