/*
  # Faaliyet Raporları RLS Düzeltmesi

  1. Değişiklikler
    - UPDATE politikasını düzelt: Kullanıcılar draft raporları submitted yapabilsin
    - Admin'ler tüm işlemleri yapabilsin
    
  2. Notlar
    - WITH CHECK kısmı yeni değerleri kontrol eder
    - USING kısmı mevcut satırları kontrol eder
*/

-- Eski politikayı kaldır
DROP POLICY IF EXISTS "Users can update their department's draft reports" ON activity_reports;

-- Yeni politika ekle
CREATE POLICY "Users can update their department reports"
  ON activity_reports FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND (
        role = 'admin' OR 
        department_id = activity_reports.department_id
      )
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = activity_reports.organization_id
      AND (
        role = 'admin' OR 
        department_id = activity_reports.department_id
      )
    )
  );
