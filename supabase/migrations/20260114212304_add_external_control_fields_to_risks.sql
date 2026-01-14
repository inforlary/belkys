/*
  # Dış Kontrol Alanları Ekleme

  1. Değişiklikler
    - `risks` tablosuna dış kontrol bilgileri için kolonlar eklenir:
      - `external_organization`: Yetkili dış kurum adı
      - `external_contact`: Dış kurum iletişim bilgisi
      - `coordination_department_id`: Koordinasyonu sağlayan birim

  2. Amaç
    - Kontrol dışı ve kısmen kontrol edilebilir riskler için dış kurum bilgilerini saklamak
    - Koordinasyonu sağlayan birim bilgisini izlemek
    - Dış kurumla iletişim detaylarını tutmak
*/

-- Dış kontrol kolonlarını ekle
ALTER TABLE risks
ADD COLUMN IF NOT EXISTS external_organization VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_contact VARCHAR(255),
ADD COLUMN IF NOT EXISTS coordination_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_risks_coordination_department ON risks(coordination_department_id);

COMMENT ON COLUMN risks.external_organization IS 'Kontrol dışı/kısmen kontrol edilebilir riskler için yetkili dış kurum adı';
COMMENT ON COLUMN risks.external_contact IS 'Dış kurum iletişim bilgisi (kişi, telefon, email vb.)';
COMMENT ON COLUMN risks.coordination_department_id IS 'Dış kurumla koordinasyonu sağlayan birim';
