/*
  # Otomatik Eylem Kuyruğu RLS Politikalarını Düzelt
  
  1. Sorun
    - `ic_automatic_action_queue` tablosunda INSERT politikası eksik
    - Trigger'lar otomatik kayıt eklemeye çalışırken RLS engeli alıyor
    - Bu yüzden test kaydetme işlemi 403 hatası veriyor
  
  2. Çözüm
    - INSERT, UPDATE ve DELETE politikaları ekleniyor
    - Trigger'ların otomatik kayıt ekleyebilmesi için erişim sağlanıyor
*/

-- INSERT politikası: Trigger'ların ve adminlerin kayıt eklemesine izin ver
CREATE POLICY "System can insert automatic actions"
  ON ic_automatic_action_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE politikası: Adminler kuyruk durumunu güncelleyebilir
CREATE POLICY "Admins can update automatic action queue"
  ON ic_automatic_action_queue FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- DELETE politikası: Adminler kuyruk kayıtlarını silebilir
CREATE POLICY "Admins can delete automatic action queue"
  ON ic_automatic_action_queue FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );
