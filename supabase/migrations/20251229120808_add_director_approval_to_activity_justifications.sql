/*
  # Faaliyet Gerekçelerine Müdür Onayı Ekleme

  Bütçe ve Performans Modülü için 4 aşamalı onay süreci:
  - Kullanıcı → Müdür → Başkan Yardımcısı → Yönetici
  - Yöneticinin girdiği veri direkt onaylı sayılır

  ## Yeni Status Değerleri
  - draft - Taslak
  - submitted_to_director - Müdüre gönderildi
  - director_approved - Müdür onayladı
  - submitted_to_vp - Başkan yardımcısına gönderildi
  - vp_approved - Başkan yardımcısı onayladı
  - submitted_to_admin - Yöneticiye gönderildi
  - admin_approved - Yönetici onayladı (final)
  - rejected - Reddedildi

  ## Değişiklikler
  1. Status constraint güncellendi
  2. Müdür onay metadata alanları eklendi
  3. RLS policy'leri güncellendi
*/

-- Eski constraint'i kaldır
ALTER TABLE activity_justifications DROP CONSTRAINT IF EXISTS activity_justifications_status_check;

-- Yeni constraint ekle
ALTER TABLE activity_justifications
ADD CONSTRAINT activity_justifications_status_check
CHECK (status IN (
  'draft', 
  'submitted_to_director', 
  'director_approved',
  'submitted_to_vp', 
  'vp_approved', 
  'submitted_to_admin', 
  'admin_approved', 
  'rejected'
));

-- Müdür onay alanlarını ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_justifications'
    AND column_name = 'director_submitted_at'
  ) THEN
    ALTER TABLE activity_justifications
    ADD COLUMN director_submitted_at timestamptz,
    ADD COLUMN director_submitted_by uuid REFERENCES profiles(id),
    ADD COLUMN director_reviewed_at timestamptz,
    ADD COLUMN director_reviewed_by uuid REFERENCES profiles(id),
    ADD COLUMN director_rejection_reason text;

    CREATE INDEX IF NOT EXISTS idx_activity_justifications_director_reviewed_by
    ON activity_justifications(director_reviewed_by);
  END IF;
END $$;

-- Müdürlerin onay yapabilmesi için RLS policy ekle
DROP POLICY IF EXISTS "Directors can review submitted justifications" ON activity_justifications;

CREATE POLICY "Directors can review submitted justifications"
  ON activity_justifications FOR UPDATE
  TO authenticated
  USING (
    status IN ('submitted_to_director', 'director_approved')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = activity_justifications.organization_id
      AND profiles.department_id = activity_justifications.department_id
      AND profiles.role = 'director'
    )
  );
