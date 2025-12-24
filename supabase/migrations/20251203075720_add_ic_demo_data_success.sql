/*
  # Internal Control System - Complete Demo Data

  Successfully adds:
  - 20 KIKS Standards (all 5 components)
  - 5 Business Processes
  - 6 Risk Records (correct enums)
*/

DO $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_process_id uuid;
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND organization_id = v_org_id LIMIT 1;
  
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- KIKS STANDARDS
  INSERT INTO ic_kiks_standards (organization_id, code, component, theme, standard_no, title, description, is_critical, weight) VALUES
  (v_org_id, 'KIKS-KO-01', 'kontrol_ortami', 'Etik Değerler ve Dürüstlük', 1, 'Etik Değerler ve Dürüstlük', 'Kamu idaresi yöneticileri ve çalışanları, görevlerini yerine getirirken etik değerlere ve dürüstlük ilkelerine uygun hareket ederler.', true, 5),
  (v_org_id, 'KIKS-KO-02', 'kontrol_ortami', 'Misyon, Organizasyon ve Yetki', 2, 'Misyon, Organizasyon Yapısı ve Görevler', 'İdarenin misyon ve hedefleri belirlenmiş, organizasyon yapısı oluşturulmuş ve görevler tanımlanmıştır.', true, 4),
  (v_org_id, 'KIKS-KO-03', 'kontrol_ortami', 'Personelin Yeterliliği', 3, 'Personelin Yetkinliği ve Performansı', 'Personelin yeterlilik düzeyi belirlenir ve gerekli eğitimler verilir. Performans değerlendirmesi yapılır.', true, 4),
  (v_org_id, 'KIKS-KO-04', 'kontrol_ortami', 'Yetki Devri', 4, 'Yetki Devri ve Sorumluluk', 'Görev ve yetki devri yazılı olarak yapılır. Sorumluluklar açıkça tanımlanır.', false, 3),
  (v_org_id, 'KIKS-RD-01', 'risk_degerlendirme', 'Risk Yönetimi Stratejisi', 5, 'Risk Yönetim Stratejisi', 'İdarede risk yönetimi stratejisi ve politikası oluşturulmuştur.', true, 5),
  (v_org_id, 'KIKS-RD-02', 'risk_degerlendirme', 'Risk Belirleme', 6, 'Risklerin Belirlenmesi', 'İdare hedeflerine ulaşmayı engelleyebilecek riskler belirlenir ve sınıflandırılır.', true, 4),
  (v_org_id, 'KIKS-RD-03', 'risk_degerlendirme', 'Risk Analizi', 7, 'Risklerin Analiz ve Değerlendirilmesi', 'Belirlenen riskler olasılık ve etki açısından analiz edilir ve değerlendirilir.', true, 5),
  (v_org_id, 'KIKS-RD-04', 'risk_degerlendirme', 'Risklere Karşı Önlemler', 8, 'Riske Karşı Alınacak Önlemler', 'Değerlendirilen riskler için uygun önlemler belirlenir ve uygulanır.', true, 4),
  (v_org_id, 'KIKS-KF-01', 'kontrol_faaliyetleri', 'Kontrol Stratejileri', 9, 'Kontrol Stratejileri ve Yöntemleri', 'Riskleri yönetmek için uygun kontrol stratejileri ve yöntemleri belirlenir.', true, 4),
  (v_org_id, 'KIKS-KF-02', 'kontrol_faaliyetleri', 'Prosedür ve Politikalar', 10, 'Prosedürler ve Politikalar', 'Kontrol faaliyetlerinin nasıl gerçekleştirileceği prosedür ve politikalarla belirlenmiştir.', true, 4),
  (v_org_id, 'KIKS-KF-03', 'kontrol_faaliyetleri', 'Görevler Ayrılığı', 11, 'Görevler Ayrılığı', 'Çıkar çatışmasına ve yanlışlığa yol açabilecek görevler farklı kişilere verilmiştir.', true, 5),
  (v_org_id, 'KIKS-KF-04', 'kontrol_faaliyetleri', 'Hiyerarşik Kontroller', 12, 'Hiyerarşik Kontroller', 'İşlemler uygun seviyede yetkilendirilir ve onaylanır.', false, 3),
  (v_org_id, 'KIKS-BI-01', 'bilgi_iletisim', 'Bilgi ve İletişim', 13, 'Bilgi ve İletişim Sistemi', 'İhtiyaç duyulan bilginin zamanında ve doğru olarak sağlanması için bilgi sistemi kurulmuştur.', true, 4),
  (v_org_id, 'KIKS-BI-02', 'bilgi_iletisim', 'İç İletişim', 14, 'İç İletişim', 'İdare içinde etkili iletişim kanalları oluşturulmuştur.', false, 3),
  (v_org_id, 'KIKS-BI-03', 'bilgi_iletisim', 'Dış İletişim', 15, 'Dış İletişim', 'İlgili taraflarla etkili iletişim sağlanmıştır.', false, 3),
  (v_org_id, 'KIKS-BI-04', 'bilgi_iletisim', 'Dokümantasyon', 16, 'Kayıt ve Dosyalama Sistemi', 'İşlemler uygun şekilde kayıt altına alınır ve dosyalanır.', true, 4),
  (v_org_id, 'KIKS-IZ-01', 'izleme', 'İzleme Faaliyetleri', 17, 'Sürekli İzleme', 'İç kontrol sisteminin etkinliği düzenli olarak izlenir.', true, 5),
  (v_org_id, 'KIKS-IZ-02', 'izleme', 'Değerlendirme', 18, 'Ayrı Değerlendirmeler', 'İç kontrol sistemi periyodik olarak bağımsız değerlendirilir.', true, 4),
  (v_org_id, 'KIKS-IZ-03', 'izleme', 'Eksikliklerin Bildirilmesi', 19, 'İç Kontrol Eksikliklerinin Raporlanması', 'Tespit edilen iç kontrol eksiklikleri zamanında raporlanır ve giderilir.', true, 5),
  (v_org_id, 'KIKS-IZ-04', 'izleme', 'İyileştirme', 20, 'Sürekli İyileştirme', 'İç kontrol sisteminin sürekli iyileştirilmesi sağlanır.', false, 3)
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PROCESSES
  INSERT INTO ic_processes (organization_id, department_id, code, name, description, process_category, owner_user_id, is_critical, status)
  VALUES 
  (v_org_id, v_dept_id, 'SRC-001', 'Satın Alma Süreci', 'Mal ve hizmet alımlarının gerçekleştirilmesi süreci', 'Mali Süreçler', v_admin_id, true, 'active'),
  (v_org_id, v_dept_id, 'SRC-002', 'Bütçe Hazırlama Süreci', 'Yıllık bütçenin hazırlanması ve onaylanması süreci', 'Mali Süreçler', v_admin_id, true, 'active'),
  (v_org_id, v_dept_id, 'SRC-003', 'Personel İşe Alım Süreci', 'Yeni personel alımı ve işe başlatma süreci', 'İdari Süreçler', v_admin_id, false, 'active'),
  (v_org_id, v_dept_id, 'SRC-004', 'Performans Değerlendirme Süreci', 'Personel performansının değerlendirilmesi süreci', 'İdari Süreçler', v_admin_id, false, 'active'),
  (v_org_id, v_dept_id, 'SRC-005', 'Bilgi Güvenliği Yönetimi', 'Kurumsal verilerin güvenliğinin sağlanması süreci', 'BT Süreçleri', v_admin_id, true, 'active');

  -- RISKS (status: identified, assessed, mitigating, monitored, accepted, closed)
  SELECT id INTO v_process_id FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-001';
  
  INSERT INTO ic_risks (organization_id, process_id, risk_code, risk_title, risk_description, risk_category, risk_owner_id, inherent_likelihood, inherent_impact, status)
  VALUES 
  (v_org_id, v_process_id, 'RSK-001', 'Yetkisiz Satın Alma Riski', 'Yetkili olmayan kişilerin satın alma yapması riski', 'operational', v_admin_id, 4, 5, 'assessed'),
  (v_org_id, NULL, 'RSK-002', 'Bütçe Aşımı Riski', 'Planlanan bütçenin aşılması riski', 'financial', v_admin_id, 3, 4, 'mitigating'),
  (v_org_id, NULL, 'RSK-003', 'Kalifiye Personel Bulamama', 'İhtiyaç duyulan nitelikte personel temin edilememesi', 'strategic', v_admin_id, 3, 3, 'monitored'),
  (v_org_id, NULL, 'RSK-004', 'Veri Kaybı Riski', 'Kritik verilerin kaybolması veya zarar görmesi', 'operational', v_admin_id, 2, 5, 'assessed'),
  (v_org_id, NULL, 'RSK-005', 'Mevzuata Uyumsuzluk Riski', 'Yasal düzenlemelere uygun hareket edilmemesi', 'compliance', v_admin_id, 2, 4, 'mitigating'),
  (v_org_id, v_process_id, 'RSK-006', 'Tedarikçi Performans Sorunu', 'Tedarikçilerin zamanında ve kaliteli teslimat yapmaması', 'operational', v_admin_id, 3, 3, 'monitored');

END $$;