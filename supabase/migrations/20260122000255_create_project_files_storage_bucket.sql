/*
  # Proje Dosyaları Storage Bucket ve Politikalar

  1. Yeni Bucket
    - project-files: Proje dosyaları (fotoğraf, PDF, Excel, Word)
  
  2. Security
    - Organization bazlı erişim kontrolü
    - Kullanıcılar kendi organizasyonlarının proje dosyalarını görebilir
    - Yükleyebilir ve silebilir
*/

-- Storage bucket oluştur
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS politikaları
CREATE POLICY "Users can view project files in their organization"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can upload project files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update project files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
