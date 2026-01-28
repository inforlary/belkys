/*
  # Kalite Yönetimi Süreç Yönetimi Geliştirmeleri

  1. Değişiklikler
    - Süreç kategorileri güncellendi
    - Risk yönetimi entegrasyonu eklendi
    - Stratejik hedef bağlantısı eklendi
    - İş akışı durumu görünürlüğü sağlandı
    - Durum değerleri sadeleştirildi (ARCHIVED kaldırıldı)

  2. Yeni Alanlar
    - `related_risks` (jsonb[]) - İlgili risk ID'leri
    - `related_goal_id` (uuid) - İlgili stratejik hedef

  3. Kategori Güncellemeleri
    - Ana Hizmet Süreçleri
    - Yönetim Süreçleri
    - Destek Süreçleri
    - İzleme ve Değerlendirme Süreçleri
    - Operasyonel Süreçler
*/

-- İlgili risk bağlantıları için alan ekle
ALTER TABLE qm_processes
ADD COLUMN IF NOT EXISTS related_risks jsonb DEFAULT '[]'::jsonb;

-- Stratejik hedef bağlantısı için alan ekle
ALTER TABLE qm_processes
ADD COLUMN IF NOT EXISTS related_goal_id uuid REFERENCES goals(id) ON DELETE SET NULL;

-- Durum constraint'ini güncelle (ARCHIVED'i kaldır)
ALTER TABLE qm_processes
DROP CONSTRAINT IF EXISTS qm_processes_status_check;

ALTER TABLE qm_processes
ADD CONSTRAINT qm_processes_status_check
CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE'));

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_qm_processes_related_goal ON qm_processes(related_goal_id);
CREATE INDEX IF NOT EXISTS idx_qm_processes_related_risks ON qm_processes USING gin(related_risks);

-- İş akışı durumunu kontrol eden fonksiyon
CREATE OR REPLACE FUNCTION check_process_has_workflow(process_id uuid, org_id uuid)
RETURNS boolean AS $$
DECLARE
  has_workflow boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM workflow_processes
    WHERE organization_id = org_id
    AND (
      code IN (SELECT code FROM qm_processes WHERE id = process_id)
      OR
      name IN (SELECT name FROM qm_processes WHERE id = process_id)
    )
    AND status = 'approved'
  ) INTO has_workflow;

  RETURN has_workflow;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mevcut ARCHIVED durumundaki kayıtları INACTIVE yap
UPDATE qm_processes
SET status = 'INACTIVE'
WHERE status = 'ARCHIVED';

COMMENT ON COLUMN qm_processes.related_risks IS 'İlgili risklerin ID listesi (jsonb array olarak)';
COMMENT ON COLUMN qm_processes.related_goal_id IS 'İlgili stratejik hedef ID si';
COMMENT ON FUNCTION check_process_has_workflow IS 'Sürecin onaylanmış iş akışı olup olmadığını kontrol eder';
