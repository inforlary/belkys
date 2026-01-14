/*
  # Risk Onay Süreci Ekle

  1. Yeni Alanlar
    - `approval_status`: Risk onay durumu (DRAFT, IN_REVIEW, PENDING_APPROVAL, APPROVED, REJECTED, CLOSED)
    - `approved_by`: Onaylayan kullanıcı referansı
    - `approved_at`: Onay tarihi
    - `rejection_reason`: Red nedeni (reddedilen riskler için)

  2. Amaç
    - Risklerin onay sürecinden geçmesini sağlamak
    - Risk durumlarını takip etmek
    - Onay ve red işlemlerini kayıt altına almak

  3. İş Akışı
    - DRAFT: Yeni oluşturulan riskler
    - IN_REVIEW: İncelemede olan riskler
    - PENDING_APPROVAL: Onay bekleyen riskler
    - APPROVED: Onaylanmış riskler
    - REJECTED: Reddedilmiş riskler (red nedeni zorunlu)
    - CLOSED: Kapatılmış riskler

  4. Güvenlik
    - Durum değiştirme yetkileri rol bazlı kontrol edilecek
*/

-- Onay durumu için enum tipi oluştur
DO $$ BEGIN
  CREATE TYPE risk_approval_status AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Risks tablosuna onay süreci alanlarını ekle
ALTER TABLE risks 
  ADD COLUMN IF NOT EXISTS approval_status risk_approval_status DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_risks_approval_status ON risks(approval_status);
CREATE INDEX IF NOT EXISTS idx_risks_approved_by ON risks(approved_by);

-- Mevcut riskleri DRAFT olarak işaretle
UPDATE risks 
SET approval_status = 'DRAFT' 
WHERE approval_status IS NULL;

-- Trigger: Onay durumu değiştiğinde tarih güncelle
CREATE OR REPLACE FUNCTION update_risk_approval_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer onaylandıysa ve approved_at boşsa, tarihi set et
  IF NEW.approval_status = 'APPROVED' AND NEW.approved_at IS NULL THEN
    NEW.approved_at = now();
  END IF;
  
  -- Eğer durum REJECTED'dan başka bir şeye çevrilirse rejection_reason'ı temizle
  IF NEW.approval_status != 'REJECTED' AND OLD.approval_status = 'REJECTED' THEN
    NEW.rejection_reason = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_risk_approval_timestamp
  BEFORE UPDATE ON risks
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION update_risk_approval_timestamp();

COMMENT ON COLUMN risks.approval_status IS 'Risk onay durumu: DRAFT, IN_REVIEW, PENDING_APPROVAL, APPROVED, REJECTED, CLOSED';
COMMENT ON COLUMN risks.approved_by IS 'Riski onaylayan kullanıcı';
COMMENT ON COLUMN risks.approved_at IS 'Risk onay tarihi';
COMMENT ON COLUMN risks.rejection_reason IS 'Risk red nedeni (REJECTED durumunda zorunlu)';
