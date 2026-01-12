/*
  # KPI Takip Verisi RPC Fonksiyonu

  1. Yeni Fonksiyon
    - `get_kpi_tracking_data` - KPI verilerini dönemsel olarak getirir
    - Hedef ve gerçekleşen değerleri karşılaştırır
    - Durum hesaplama (GOOD, BAD, NO_DATA)
    - Sapma hesaplama
    
  2. Özellikler
    - Performans için optimize edilmiş
    - Filtreleme desteği (yıl, ay, süreç)
    - JSON formatında sonuç döner
*/

CREATE OR REPLACE FUNCTION get_kpi_tracking_data(
  org_id UUID,
  year INT,
  month INT,
  process_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  kpi_id UUID,
  process_code VARCHAR,
  process_name VARCHAR,
  kpi_name VARCHAR,
  unit VARCHAR,
  target_value DECIMAL,
  actual_value DECIMAL,
  direction VARCHAR,
  status VARCHAR,
  variance DECIMAL,
  notes TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.id,
    k.id as kpi_id,
    p.code as process_code,
    p.name as process_name,
    k.name as kpi_name,
    k.unit,
    k.target_value,
    v.value as actual_value,
    k.direction,
    CASE 
      WHEN v.value IS NULL THEN 'NO_DATA'::VARCHAR
      WHEN k.direction = 'UP' AND v.value >= k.target_value THEN 'GOOD'::VARCHAR
      WHEN k.direction = 'DOWN' AND v.value <= k.target_value THEN 'GOOD'::VARCHAR
      ELSE 'BAD'::VARCHAR
    END as status,
    CASE 
      WHEN v.value IS NULL OR k.target_value IS NULL THEN NULL
      WHEN k.direction = 'UP' THEN v.value - k.target_value
      ELSE k.target_value - v.value
    END as variance,
    v.notes
  FROM qm_process_kpis k
  INNER JOIN qm_processes p ON k.process_id = p.id
  LEFT JOIN qm_process_kpi_values v ON v.kpi_id = k.id 
    AND v.period_year = year 
    AND v.period_month = month
  WHERE 
    p.organization_id = org_id 
    AND k.is_active = true
    AND (process_filter IS NULL OR k.process_id = process_filter)
  ORDER BY p.code, k.name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_kpi_tracking_data(UUID, INT, INT, UUID) TO authenticated;
