/*
  # KPI Yön Bilgisi Ekleme

  1. Değişiklikler
    - `qm_process_kpis` tablosuna `direction` kolonu eklenir
    - UP = Yukarı iyi (%, puan, oran vb.)
    - DOWN = Aşağı iyi (gün, hata sayısı, maliyet vb.)
    
  2. Özellikler
    - Varsayılan değer: 'UP'
    - KPI başarı durumu hesaplamak için kullanılır
*/

-- Direction kolonu ekle
ALTER TABLE qm_process_kpis 
ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'UP' 
CHECK (direction IN ('UP', 'DOWN'));

-- Mevcut kayıtları güncelle
UPDATE qm_process_kpis SET direction = 'UP' WHERE direction IS NULL;
