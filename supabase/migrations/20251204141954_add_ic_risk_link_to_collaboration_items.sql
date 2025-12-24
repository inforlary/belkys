/*
  # İşbirliği Plan Risklerini İç Kontrole Bağlama
  
  ## Açıklama
  Mevcut işbirliği planlama sistemindeki riskleri (collaboration_plan_items tablosunda 
  category='risk' olanlar) iç kontrol sistemindeki risklerle (ic_risks tablosu) 
  bağlamak için gerekli alanı ekler.
  
  ## Değişiklikler
  1. collaboration_plan_items tablosuna ic_risk_id kolonu eklenir (nullable)
  2. Foreign key constraint eklenir
  3. İndeks oluşturulur
  
  ## Güvenlik
  Mevcut RLS politikaları korunur, değişiklik yapılmaz.
*/

-- Add ic_risk_id column to collaboration_plan_items
ALTER TABLE collaboration_plan_items 
ADD COLUMN IF NOT EXISTS ic_risk_id uuid REFERENCES ic_risks(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_collaboration_plan_items_ic_risk_id 
ON collaboration_plan_items(ic_risk_id) 
WHERE ic_risk_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN collaboration_plan_items.ic_risk_id IS 
'İç kontrol sistemindeki risk kaydına bağlantı. Sadece category=risk olan kayıtlarda kullanılır.';
