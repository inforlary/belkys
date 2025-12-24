/*
  # Activity Reports Storage Bucket Politikaları

  1. Yeni Bucket
    - `activity-reports` - Faaliyet raporu görselleri için

  2. RLS Politikaları
    - INSERT: Kullanıcılar kendi organizasyonlarına yükleyebilir
    - SELECT: Kullanıcılar kendi organizasyonlarının dosyalarını görüntüleyebilir
    - DELETE: Kullanıcılar kendi yükledikleri dosyaları silebilir

  3. Notlar
    - 10MB dosya boyutu limiti
    - Sadece görsel formatları: JPEG, PNG, GIF, WebP
*/

-- Bucket varsa güncelle, yoksa oluştur
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-reports',
  'activity-reports',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

-- Eski politikaları temizle
DROP POLICY IF EXISTS "Users can upload to their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their org files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "activity_reports_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "activity_reports_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "activity_reports_delete_policy" ON storage.objects;

-- INSERT: Kullanıcılar kendi organizasyonlarına dosya yükleyebilir
CREATE POLICY "activity_reports_insert_policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'activity-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- SELECT: Kullanıcılar kendi organizasyonlarının dosyalarını görüntüleyebilir
CREATE POLICY "activity_reports_select_policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'activity-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: Kullanıcılar kendi organizasyonlarının dosyalarını silebilir
CREATE POLICY "activity_reports_delete_policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'activity-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );
