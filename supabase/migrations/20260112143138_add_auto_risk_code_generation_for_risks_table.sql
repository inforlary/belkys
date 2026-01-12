/*
  # Risk Tablosu İçin Otomatik Kod Üretimi

  1. Değişiklikler
    - generate_auto_code fonksiyonunu risks tablosunu destekleyecek şekilde güncelle
    - risks tablosu için otomatik kod üretim trigger'ı ekle
    - Format: R-YYYY-NNN (örn: R-2026-001)
    
  2. Güvenlik
    - SECURITY DEFINER ile güvenli çalışma
    - Advisory lock ile race condition önleme
    
  3. Mevcut Veriler
    - Mevcut risklerin kodları güncellenmez
    - Sadece yeni eklenen riskler için otomatik kod üretilir
*/

-- generate_auto_code fonksiyonunu risks tablosu için güncelle
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
  v_code_column text;
BEGIN
  -- Organization ID'den unique bir lock key üret
  v_lock_key := ('x' || substr(md5(p_organization_id::text || p_table_name), 1, 15))::bit(60)::bigint;
  
  -- Transaction bazında kilit al (otomatik olarak transaction sonunda serbest bırakılır)
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Tablo için doğru kolon adını belirle
  v_code_column := CASE p_table_name
    WHEN 'ic_processes' THEN 'code'
    WHEN 'ic_risks' THEN 'risk_code'
    WHEN 'ic_controls' THEN 'control_code'
    WHEN 'ic_control_tests' THEN 'test_code'
    WHEN 'ic_findings' THEN 'finding_code'
    WHEN 'ic_capas' THEN 'capa_code'
    WHEN 'risks' THEN 'code'
    ELSE 'code'
  END;
  
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
      v_code_column,
      p_code_prefix,
      v_code_column,
      p_table_name,
      v_code_column
    )
    INTO v_next_number
    USING p_organization_id, p_code_prefix || '-' || v_year || '-%';
    
    -- Kodu oluştur: PREFIX-YEAR-NUMBER (3 haneli)
    v_code := p_code_prefix || '-' || v_year || '-' || LPAD(v_next_number::text, 3, '0');
    
    -- Kodun unique olup olmadığını kontrol et
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE organization_id = $1 AND %I = $2',
      p_table_name,
      v_code_column
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

-- risks tablosu için otomatik kod üretimi trigger fonksiyonu
CREATE OR REPLACE FUNCTION auto_generate_risk_code_for_risks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sadece code NULL veya boş ise otomatik kod üret
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_auto_code('risks', 'R', NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

-- risks tablosuna trigger ekle
DROP TRIGGER IF EXISTS trigger_auto_generate_risk_code ON risks;
CREATE TRIGGER trigger_auto_generate_risk_code
  BEFORE INSERT ON risks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_risk_code_for_risks();

-- Güvenlik: Function'lara erişim izni
GRANT EXECUTE ON FUNCTION auto_generate_risk_code_for_risks() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_generate_risk_code_for_risks() TO service_role;
