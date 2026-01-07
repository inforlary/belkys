/*
  # Add KİKS Global Seed Data
  
  1. New Data
    - Add 5 KİKS categories (KOS, RDS, KAS, BİS, İS)
    - Add main standards for each category
    - Add sub-standards for each main standard
  
  2. Notes
    - All data is global (organization_id = NULL)
    - Follows official KİKS structure from Turkish Court of Accounts
*/

-- KİKS Categories
INSERT INTO ic_kiks_categories (id, organization_id, code, name, description, order_index, is_active) VALUES
('11111111-1111-1111-1111-111111111101', NULL, 'KOS', 'Kontrol Ortamı Standardı', 'İç kontrolün etkinliğini doğrudan etkileyen kültür, anlayış ve tutumları içerir', 1, true),
('11111111-1111-1111-1111-111111111102', NULL, 'RDS', 'Risk Değerlendirme Standardı', 'Amaçlara ulaşmayı engelleyebilecek risklerin belirlenmesi ve değerlendirilmesi', 2, true),
('11111111-1111-1111-1111-111111111103', NULL, 'KAS', 'Kontrol Faaliyetleri Standardı', 'Risklerin yönetilebilmesi için alınacak önlemleri içerir', 3, true),
('11111111-1111-1111-1111-111111111104', NULL, 'BİS', 'Bilgi ve İletişim Standardı', 'Bilginin kaydedilmesi, iletilmesi ve raporlanması süreçlerini kapsar', 4, true),
('11111111-1111-1111-1111-111111111105', NULL, 'İS', 'İzleme Standardı', 'İç kontrol sisteminin sürekli izlenmesi ve değerlendirilmesini içerir', 5, true)
ON CONFLICT (id) DO NOTHING;

-- KOS Main Standards
INSERT INTO ic_kiks_main_standards (id, organization_id, category_id, code, title, description, order_index, is_active) VALUES
('22222222-2222-2222-2222-222222222101', NULL, '11111111-1111-1111-1111-111111111101', 'KOS.01', 'Etik Değerler ve Dürüstlük', 'Kurumdaki etik değerler ve dürüstlük anlayışı', 1, true),
('22222222-2222-2222-2222-222222222102', NULL, '11111111-1111-1111-1111-111111111101', 'KOS.02', 'Misyon, Organizasyon Yapısı ve Görevler', 'Kurumun misyonu ve organizasyon yapısı', 2, true),
('22222222-2222-2222-2222-222222222103', NULL, '11111111-1111-1111-1111-111111111101', 'KOS.03', 'Personelin Yeterliliği', 'Personelin bilgi, beceri ve yetkinlikleri', 3, true),
('22222222-2222-2222-2222-222222222104', NULL, '11111111-1111-1111-1111-111111111101', 'KOS.04', 'Yetki Devri', 'Yetki ve sorumluluk devri mekanizmaları', 4, true),
('22222222-2222-2222-2222-222222222105', NULL, '11111111-1111-1111-1111-111111111101', 'KOS.05', 'İnsan Kaynakları Politika ve Uygulamaları', 'İnsan kaynakları yönetim süreçleri', 5, true)
ON CONFLICT (id) DO NOTHING;

-- RDS Main Standards
INSERT INTO ic_kiks_main_standards (id, organization_id, category_id, code, title, description, order_index, is_active) VALUES
('22222222-2222-2222-2222-222222222201', NULL, '11111111-1111-1111-1111-111111111102', 'RDS.01', 'Kurumsal Amaç ve Hedeflerin Belirlenmesi', 'Stratejik amaç ve hedeflerin tanımlanması', 1, true),
('22222222-2222-2222-2222-222222222202', NULL, '11111111-1111-1111-1111-111111111102', 'RDS.02', 'Risk Yönetim Stratejisinin Belirlenmesi', 'Risk yönetim yaklaşımının tanımlanması', 2, true),
('22222222-2222-2222-2222-222222222203', NULL, '11111111-1111-1111-1111-111111111102', 'RDS.03', 'Risklerin Belirlenmesi', 'Kurumu etkileyen risklerin tespiti', 3, true),
('22222222-2222-2222-2222-222222222204', NULL, '11111111-1111-1111-1111-111111111102', 'RDS.04', 'Risklerin Analizi', 'Risklerin olasılık ve etki açısından analizi', 4, true),
('22222222-2222-2222-2222-222222222205', NULL, '11111111-1111-1111-1111-111111111102', 'RDS.05', 'Risklere Karşı Alınacak Önlemler', 'Risk azaltma stratejilerinin belirlenmesi', 5, true)
ON CONFLICT (id) DO NOTHING;

-- KAS Main Standards  
INSERT INTO ic_kiks_main_standards (id, organization_id, category_id, code, title, description, order_index, is_active) VALUES
('22222222-2222-2222-2222-222222222301', NULL, '11111111-1111-1111-1111-111111111103', 'KAS.01', 'Kontrol Stratejileri ve Yöntemleri', 'Kontrol mekanizmalarının tasarımı', 1, true),
('22222222-2222-2222-2222-222222222302', NULL, '11111111-1111-1111-1111-111111111103', 'KAS.02', 'Prosedürlerin Oluşturulması ve Belgelendirilmesi', 'İş süreçlerinin dokümante edilmesi', 2, true),
('22222222-2222-2222-2222-222222222303', NULL, '11111111-1111-1111-1111-111111111103', 'KAS.03', 'Görevler Ayrılığı', 'Görev ve yetki ayrımının sağlanması', 3, true),
('22222222-2222-2222-2222-222222222304', NULL, '11111111-1111-1111-1111-111111111103', 'KAS.04', 'Hiyerarşik Kontroller', 'Üst yönetim kontrol mekanizmaları', 4, true),
('22222222-2222-2222-2222-222222222305', NULL, '11111111-1111-1111-1111-111111111103', 'KAS.05', 'Faaliyetlerin Sürekliliği', 'İş sürekliliği ve devamlılığı', 5, true)
ON CONFLICT (id) DO NOTHING;

-- BİS Main Standards
INSERT INTO ic_kiks_main_standards (id, organization_id, category_id, code, title, description, order_index, is_active) VALUES
('22222222-2222-2222-2222-222222222401', NULL, '11111111-1111-1111-1111-111111111104', 'BİS.01', 'Bilgi ve İletişim', 'Bilgi akışı ve iletişim kanalları', 1, true),
('22222222-2222-2222-2222-222222222402', NULL, '11111111-1111-1111-1111-111111111104', 'BİS.02', 'Raporlama', 'Düzenli raporlama mekanizmaları', 2, true),
('22222222-2222-2222-2222-222222222403', NULL, '11111111-1111-1111-1111-111111111104', 'BİS.03', 'Kayıt ve Dosyalama Sistemi', 'Belge ve kayıt yönetimi', 3, true),
('22222222-2222-2222-2222-222222222404', NULL, '11111111-1111-1111-1111-111111111104', 'BİS.04', 'Hata, Usulsüzlük ve Yolsuzlukların Bildirilmesi', 'İhbar ve şikayet mekanizmaları', 4, true)
ON CONFLICT (id) DO NOTHING;

-- İS Main Standards
INSERT INTO ic_kiks_main_standards (id, organization_id, category_id, code, title, description, order_index, is_active) VALUES
('22222222-2222-2222-2222-222222222501', NULL, '11111111-1111-1111-1111-111111111105', 'İS.01', 'İç Kontrolün Değerlendirilmesi', 'İç kontrol sisteminin etkinliğinin değerlendirilmesi', 1, true),
('22222222-2222-2222-2222-222222222502', NULL, '11111111-1111-1111-1111-111111111105', 'İS.02', 'İç Denetim', 'İç denetim faaliyetlerinin yürütülmesi', 2, true)
ON CONFLICT (id) DO NOTHING;

-- Sub Standards will be added based on requirements
