/*
  # KPI Values Unique Constraint Düzeltmesi

  1. Değişiklikler
    - Mevcut unique constraint kaldırılır (period_quarter içeren)
    - Yeni unique constraint eklenir (sadece kpi_id, period_year, period_month)
    
  2. Sebep
    - Aylık takip için quarter kolonu gereksiz
    - UPSERT işlemlerinin çalışması için doğru constraint
*/

-- Eski constraint'i kaldır
ALTER TABLE qm_process_kpi_values 
DROP CONSTRAINT IF EXISTS qm_process_kpi_values_kpi_id_period_year_period_month_perio_key;

-- Yeni constraint ekle (sadece ay bazında)
ALTER TABLE qm_process_kpi_values 
ADD CONSTRAINT qm_process_kpi_values_kpi_period_unique 
UNIQUE (kpi_id, period_year, period_month);
