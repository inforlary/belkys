/*
  # ic_action_plans tablosuna approval_status kolonu ekle

  1. Değişiklikler
    - approval_status kolonu eklenir (draft, pending_approval, approved, rejected)
    - rejected_by ve rejected_at kolonları eklenir
    - Mevcut kayıtlar için default olarak 'draft' atanır
    
  2. Notlar
    - Dashboard ve ActionPlan sayfalarında kullanılan approval_status kolonu artık mevcut olacak
*/

-- approval_status kolonu ekle
ALTER TABLE ic_action_plans 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'draft' 
CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected'));

-- rejected_by ve rejected_at kolonları ekle
ALTER TABLE ic_action_plans 
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Mevcut kayıtlar için varsayılan değer ata
UPDATE ic_action_plans 
SET approval_status = 'draft' 
WHERE approval_status IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_approval_status 
ON ic_action_plans(approval_status);

-- approved_at değeri olan kayıtların durumunu güncelle
UPDATE ic_action_plans 
SET approval_status = 'approved' 
WHERE approved_at IS NOT NULL AND approval_status = 'draft';
