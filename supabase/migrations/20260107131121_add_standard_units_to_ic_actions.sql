/*
  # İç Kontrol Eylemlerine Standart Roller Ekleme

  1. Değişiklikler
    - `ic_actions` tablosuna `special_responsible_type` ENUM kolonu eklenir
    - `special_responsible` TEXT kolonu eklenir (OTHER seçeneği için)
    - Standart roller:
      - TOP_MANAGEMENT (Üst Yönetim)
      - INTERNAL_AUDITOR (İç Denetçi / İç Denetim Birimi)
      - ETHICS_COMMITTEE (Etik Komisyonu)
      - IT_COORDINATOR (Bilgi Teknolojileri Koordinatörü)
      - HR_COORDINATOR (İnsan Kaynakları Koordinatörü)
      - QUALITY_MANAGER (Kalite Yönetim Temsilcisi)
      - RISK_COORDINATOR (Risk Koordinatörü)
      - STRATEGY_COORDINATOR (Strateji Geliştirme Koordinatörü)
      - OTHER (Diğer)
    
  2. Notlar
    - Bu standart roller hem Sorumlu Birim hem de İlgili Birim olarak kullanılabilir
    - Mevcut veriler korunur
*/

DO $$
BEGIN
  -- special_responsible_type enum kolonu varsa önce sil
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_actions' 
    AND column_name = 'special_responsible_type'
  ) THEN
    ALTER TABLE ic_actions DROP COLUMN special_responsible_type;
  END IF;
  
  -- special_responsible kolonu varsa önce sil
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ic_actions' 
    AND column_name = 'special_responsible'
  ) THEN
    ALTER TABLE ic_actions DROP COLUMN special_responsible;
  END IF;
END $$;

-- Special responsible type kolonu ekle
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS special_responsible_type text;

-- Special responsible custom text kolonu ekle (OTHER seçeneği için)
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS special_responsible text;

-- Check constraint ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ic_actions_special_responsible_type_check'
  ) THEN
    ALTER TABLE ic_actions 
    ADD CONSTRAINT ic_actions_special_responsible_type_check 
    CHECK (special_responsible_type IN (
      'TOP_MANAGEMENT',
      'INTERNAL_AUDITOR',
      'ETHICS_COMMITTEE',
      'IT_COORDINATOR',
      'HR_COORDINATOR',
      'QUALITY_MANAGER',
      'RISK_COORDINATOR',
      'STRATEGY_COORDINATOR',
      'OTHER'
    ));
  END IF;
END $$;

-- related_special_responsible_types için jsonb kolonu ekle (İlgili Birimler için)
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS related_special_responsible_types jsonb;