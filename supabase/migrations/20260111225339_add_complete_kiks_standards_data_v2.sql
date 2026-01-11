/*
  # KİKS Standartlarının Tamamını Ekle

  1. Standartlar
    - RD (Risk Değerlendirme) standartlarını ekle: RD.1, RD.2, RD.3, RD.4
    - KF (Kontrol Faaliyetleri) standartlarını ekle: KF.1-KF.6
    - BIL (Bilgi ve İletişim) standartlarını ekle: BIL.1-BIL.4
    - IZL (İzleme) standartlarını ekle: IZL.1-IZL.2
    
  2. Genel Şartlar
    - Her standart için ilgili genel şartları ekle
    
  Not: KOS standartları zaten mevcut, sadece eksik olanları ekliyoruz
*/

DO $$
DECLARE
  v_rd_component_id uuid;
  v_kf_component_id uuid;
  v_bil_component_id uuid;
  v_izl_component_id uuid;
  v_rd1_id uuid;
  v_rd2_id uuid;
  v_rd3_id uuid;
  v_rd4_id uuid;
  v_kf1_id uuid;
  v_kf2_id uuid;
  v_kf3_id uuid;
  v_kf4_id uuid;
  v_kf5_id uuid;
  v_kf6_id uuid;
  v_bil1_id uuid;
  v_bil2_id uuid;
  v_bil3_id uuid;
  v_bil4_id uuid;
  v_izl1_id uuid;
  v_izl2_id uuid;
BEGIN
  -- Bileşen ID'lerini al
  SELECT id INTO v_rd_component_id FROM ic_components WHERE code = 'RD';
  SELECT id INTO v_kf_component_id FROM ic_components WHERE code = 'KF';
  SELECT id INTO v_bil_component_id FROM ic_components WHERE code = 'BIL';
  SELECT id INTO v_izl_component_id FROM ic_components WHERE code = 'IZL';

  -- RD Standartlarını ekle
  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_rd_component_id, 'RD.1', 'Risk Yönetim Stratejisi', 'İdarenin risk yönetim stratejisi belirlenmeli ve dokümante edilmelidir.', 1)
  RETURNING id INTO v_rd1_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_rd_component_id, 'RD.2', 'Risklerin Belirlenmesi', 'İdarenin amaç ve hedeflerine ulaşmasını engelleyebilecek riskler belirlenmeli ve sınıflandırılmalıdır.', 2)
  RETURNING id INTO v_rd2_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_rd_component_id, 'RD.3', 'Risklerin Analizi ve Önceliklendirilmesi', 'Belirlenen riskler, olasılık ve etki açısından analiz edilmeli ve önceliklendirilmelidir.', 3)
  RETURNING id INTO v_rd3_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_rd_component_id, 'RD.4', 'Riske Yanıt Verme', 'Risklere karşı uygun yanıt stratejileri geliştirilmeli ve uygulanmalıdır.', 4)
  RETURNING id INTO v_rd4_id;

  -- RD Genel Şartları
  INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
  VALUES
    (v_rd1_id, 'RD 1.1', 'İdarenin misyonu ve vizyonu dikkate alınarak, risk yönetim stratejisi belirlenmeli ve üst yönetici tarafından onaylanmalıdır.', 1),
    (v_rd1_id, 'RD 1.2', 'Risk yönetim stratejisi ile amaçlara ulaşmayı engelleyebilecek riskleri yönetmek için izlenecek yöntem ve uygulamalar belirlenmelidir.', 2),
    (v_rd1_id, 'RD 1.3', 'Risk yönetimi ile ilgili rol, yetki ve sorumluluklar tanımlanmalıdır.', 3),
    (v_rd2_id, 'RD 2.1', 'İdarenin amaç ve hedeflerine ulaşmasını engelleyebilecek tüm riskler tanımlanmalıdır.', 1),
    (v_rd2_id, 'RD 2.2', 'Riskler, idarenin faaliyet alanlarını kapsayacak şekilde sınıflandırılmalıdır.', 2),
    (v_rd2_id, 'RD 2.3', 'Risk belirleme süreci düzenli aralıklarla tekrarlanmalıdır.', 3),
    (v_rd3_id, 'RD 3.1', 'Belirlenen riskler, gerçekleşme olasılığı ve etki düzeyi açısından analiz edilmelidir.', 1),
    (v_rd3_id, 'RD 3.2', 'Risk analizi sonuçlarına göre riskler önceliklendirilmelidir.', 2),
    (v_rd3_id, 'RD 3.3', 'İdarenin risk iştahı göz önünde bulundurularak kabul edilebilir risk seviyesi belirlenmelidir.', 3),
    (v_rd4_id, 'RD 4.1', 'Önceliklendirilen risklere karşı uygun yanıt stratejileri (kabul etme, azaltma, paylaşma, önleme) belirlenmelidir.', 1),
    (v_rd4_id, 'RD 4.2', 'Risk yanıt stratejileri doğrultusunda gerekli kontrol faaliyetleri tasarlanmalı ve uygulanmalıdır.', 2),
    (v_rd4_id, 'RD 4.3', 'Risklere karşı alınan önlemlerin etkinliği düzenli olarak izlenmeli ve değerlendirilmelidir.', 3);

  -- KF Standartlarını ekle
  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_kf_component_id, 'KF.1', 'Kontrol Stratejileri ve Yöntemleri', 'Kontrol faaliyetlerine ilişkin strateji ve yöntemler belirlenmelidir.', 1)
  RETURNING id INTO v_kf1_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_kf_component_id, 'KF.2', 'Prosedürlerin Belirlenmesi ve Belgelendirilmesi', 'Faaliyetlerin yürütülmesine ilişkin prosedürler yazılı hale getirilmelidir.', 2)
  RETURNING id INTO v_kf2_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_kf_component_id, 'KF.3', 'Görevler Ayrılığı', 'Görevler ayrılığı ilkesi uygulanmalıdır.', 3)
  RETURNING id INTO v_kf3_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_kf_component_id, 'KF.4', 'Hiyerarşik Kontroller', 'Yöneticiler tarafından hiyerarşik kontroller yapılmalıdır.', 4)
  RETURNING id INTO v_kf4_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_kf_component_id, 'KF.5', 'Faaliyetlerin Sürekliliği', 'Faaliyetlerin sürekliliği sağlanmalıdır.', 5)
  RETURNING id INTO v_kf5_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_kf_component_id, 'KF.6', 'Bilgi Sistemleri Kontrolleri', 'Bilgi sistemlerine yönelik kontroller oluşturulmalıdır.', 6)
  RETURNING id INTO v_kf6_id;

  -- KF Genel Şartları
  INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
  VALUES
    (v_kf1_id, 'KF 1.1', 'Kontrol faaliyetleri, risk değerlendirmesi sonuçları dikkate alınarak belirlenmelidir.', 1),
    (v_kf1_id, 'KF 1.2', 'Kontrol faaliyetleri maliyet-fayda dengesi gözetilerek tasarlanmalıdır.', 2),
    (v_kf2_id, 'KF 2.1', 'İdare faaliyetlerinin etkin ve verimli bir şekilde yürütülmesi için prosedürler yazılı olarak belirlenmelidir.', 1),
    (v_kf2_id, 'KF 2.2', 'Prosedürler güncel tutulmalı ve personel tarafından erişilebilir olmalıdır.', 2),
    (v_kf3_id, 'KF 3.1', 'Bir işlemin başlatılması, yürütülmesi, kaydedilmesi ve kontrolü farklı kişiler tarafından gerçekleştirilmelidir.', 1),
    (v_kf3_id, 'KF 3.2', 'Hassas görevlerde rotasyon uygulanmalıdır.', 2),
    (v_kf4_id, 'KF 4.1', 'Yöneticiler, sorumlu oldukları faaliyetleri düzenli olarak gözden geçirmeli ve onaylamalıdır.', 1),
    (v_kf4_id, 'KF 4.2', 'Personelin performansı yöneticiler tarafından izlenmeli ve değerlendirilmelidir.', 2),
    (v_kf5_id, 'KF 5.1', 'Faaliyetlerin kesintiye uğraması durumunda uygulanacak alternatif planlar hazırlanmalıdır.', 1),
    (v_kf5_id, 'KF 5.2', 'Kritik faaliyetler için yedekleme sistemleri oluşturulmalıdır.', 2),
    (v_kf6_id, 'KF 6.1', 'Bilgi sistemlerine erişim yetkileri tanımlanmalı ve kontrol edilmelidir.', 1),
    (v_kf6_id, 'KF 6.2', 'Bilgi sistemlerinin güvenliği sağlanmalı ve düzenli olarak yedekleme yapılmalıdır.', 2),
    (v_kf6_id, 'KF 6.3', 'Bilgi sistemlerinde yapılan değişiklikler kontrol edilmeli ve onaylanmalıdır.', 3);

  -- BIL Standartlarını ekle
  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_bil_component_id, 'BIL.1', 'Bilgi ve İletişim', 'Güvenilir ve zamanında bilgi ve iletişim sağlanmalıdır.', 1)
  RETURNING id INTO v_bil1_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_bil_component_id, 'BIL.2', 'Raporlama', 'Düzenli raporlama sistemi oluşturulmalıdır.', 2)
  RETURNING id INTO v_bil2_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_bil_component_id, 'BIL.3', 'Kayıt ve Dosyalama Sistemi', 'Etkin kayıt ve dosyalama sistemi kurulmalıdır.', 3)
  RETURNING id INTO v_bil3_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_bil_component_id, 'BIL.4', 'Hata, Usulsüzlük ve Yolsuzlukların Bildirilmesi', 'Hata ve usulsüzlüklerin bildirimi için sistem kurulmalıdır.', 4)
  RETURNING id INTO v_bil4_id;

  -- BIL Genel Şartları
  INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
  VALUES
    (v_bil1_id, 'BIL 1.1', 'İdarenin faaliyetlerine ilişkin bilgiler doğru, güvenilir, zamanında ve erişilebilir olmalıdır.', 1),
    (v_bil1_id, 'BIL 1.2', 'Bilgi güvenliği sağlanmalı ve yetkisiz erişim önlenmelidir.', 2),
    (v_bil1_id, 'BIL 1.3', 'İdare içi ve dışı iletişim kanalları etkin şekilde kullanılmalıdır.', 3),
    (v_bil2_id, 'BIL 2.1', 'Faaliyet sonuçları düzenli olarak raporlanmalıdır.', 1),
    (v_bil2_id, 'BIL 2.2', 'Raporlar zamanında ilgili kişi ve birimlere sunulmalıdır.', 2),
    (v_bil2_id, 'BIL 2.3', 'Raporlar güvenilir, anlaşılır ve karşılaştırılabilir olmalıdır.', 3),
    (v_bil3_id, 'BIL 3.1', 'Kayıt ve dosyalama sistemi, bilgi ve belgelere erişimi kolaylaştırmalıdır.', 1),
    (v_bil3_id, 'BIL 3.2', 'Kayıtlar düzenli, eksiksiz ve güncel tutulmalıdır.', 2),
    (v_bil3_id, 'BIL 3.3', 'Belgelerin saklanma süreleri mevzuata uygun olarak belirlenmelidir.', 3),
    (v_bil4_id, 'BIL 4.1', 'Hata, usulsüzlük ve yolsuzlukların bildirimi için güvenli ve etkin bir sistem oluşturulmalıdır.', 1),
    (v_bil4_id, 'BIL 4.2', 'Bildirimlerin değerlendirilmesi için prosedürler belirlenmelidir.', 2),
    (v_bil4_id, 'BIL 4.3', 'Bildirimi yapan personel korunmalıdır.', 3);

  -- IZL Standartlarını ekle
  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_izl_component_id, 'IZL.1', 'İç Kontrolün Değerlendirilmesi', 'İç kontrol sistemi düzenli olarak değerlendirilmelidir.', 1)
  RETURNING id INTO v_izl1_id;

  INSERT INTO ic_standards (component_id, code, name, description, order_index)
  VALUES
    (v_izl_component_id, 'IZL.2', 'İç Denetim', 'İç denetim faaliyeti yürütülmelidir.', 2)
  RETURNING id INTO v_izl2_id;

  -- IZL Genel Şartları
  INSERT INTO ic_general_conditions (standard_id, code, description, order_index)
  VALUES
    (v_izl1_id, 'IZL 1.1', 'İç kontrol sisteminin etkinliği düzenli olarak değerlendirilmelidir.', 1),
    (v_izl1_id, 'IZL 1.2', 'Değerlendirme sonuçları üst yöneticiye raporlanmalıdır.', 2),
    (v_izl1_id, 'IZL 1.3', 'Tespit edilen eksiklikler için düzeltici önlemler alınmalıdır.', 3),
    (v_izl1_id, 'IZL 1.4', 'İç kontrol sistemi sürekli iyileştirilmelidir.', 4),
    (v_izl2_id, 'IZL 2.1', 'İç denetim, bağımsız ve objektif bir güvence ve danışmanlık faaliyetidir.', 1),
    (v_izl2_id, 'IZL 2.2', 'İç denetim, risk yönetimi, kontrol ve yönetişim süreçlerinin etkinliğini değerlendirir.', 2),
    (v_izl2_id, 'IZL 2.3', 'İç denetim bulgularına göre uygun tavsiyelerde bulunulmalıdır.', 3);

END $$;
