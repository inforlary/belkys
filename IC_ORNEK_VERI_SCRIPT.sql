-- ============================================
-- İÇ KONTROL MODÜLÜ - KAPSAMLI ÖRNEK VERİ SETİ
-- ============================================
-- Bu script, iç kontrol modülündeki tüm sayfalar için
-- birbirine entegre örnek veriler oluşturur.

-- KULLANIM:
-- 1. Supabase SQL Editor'de çalıştırın
-- 2. Veya psql ile: psql -f IC_ORNEK_VERI_SCRIPT.sql

-- NOT: Bu script, mevcut organizasyon için örnek veriler ekler.
-- Eğer veriler zaten mevcutsa, hata vermez ve geçer.

-- ============================================
-- DEĞİŞKENLER
-- ============================================
DO $$
DECLARE
  v_org_id uuid := '525d1056-ba28-46e1-9a9c-0734b9a49cf7';
  v_plan_id uuid;
  v_dept_id uuid := 'c57bc255-2926-41e0-98f1-b09c35fe5820';
  v_user_id uuid := '62b6914c-e524-4116-ae13-c04b81c2ec20';
  v_kiks_cat_id uuid;
  v_kiks_main_id uuid;
  v_kiks_sub_id uuid;
  v_process_id uuid;
  v_risk_id uuid;
  v_control_id uuid;
  v_test_id uuid;
  v_finding_id uuid;
  v_capa_id uuid;
  v_action_plan_id uuid;
BEGIN

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  İÇ KONTROL MODÜLÜ ÖRNEK VERİ OLUŞTURMA BAŞLADI';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- ============================================
  -- 1. İÇ KONTROL PLANI
  -- ============================================
  RAISE NOTICE '1️⃣  İç Kontrol Planı oluşturuluyor...';

  INSERT INTO ic_plans (organization_id, name, description, start_year, end_year, status, created_by)
  VALUES (
    v_org_id,
    '2024 Yılı İç Kontrol Planı',
    'Kadıköy Belediyesi 2024 yılı iç kontrol sistemi uygulamaları ve KİKS standartlarına uyum çalışmaları',
    2024, 2024, 'active', v_user_id
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_plan_id FROM ic_plans
  WHERE organization_id = v_org_id AND name = '2024 Yılı İç Kontrol Planı';

  RAISE NOTICE '   ✅ Plan ID: %', v_plan_id;

  -- ============================================
  -- 2. KİKS STANDARTLARI
  -- ============================================
  RAISE NOTICE '2️⃣  KİKS Standartları oluşturuluyor...';

  -- Kategori
  INSERT INTO ic_kiks_categories (organization_id, ic_plan_id, code, name, description, order_index)
  VALUES (
    v_org_id, v_plan_id, 'KO', 'Kontrol Ortamı',
    'Kurumun iç kontrol sisteminin temelini oluşturan etik değerler, yönetim anlayışı ve kurumsal yapı', 1
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_kiks_cat_id FROM ic_kiks_categories
  WHERE organization_id = v_org_id AND ic_plan_id = v_plan_id AND code = 'KO';

  -- Ana Standart
  INSERT INTO ic_kiks_main_standards (organization_id, ic_plan_id, category_id, code, title, description)
  VALUES (
    v_org_id, v_plan_id, v_kiks_cat_id, 'KO.01', 'Etik Değerler ve Dürüstlük',
    'Kurum personelinin etik değerlere ve dürüstlüğe bağlı kalmasını sağlayan standartlar'
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_kiks_main_id FROM ic_kiks_main_standards
  WHERE organization_id = v_org_id AND ic_plan_id = v_plan_id AND code = 'KO.01';

  -- Alt Standart
  INSERT INTO ic_kiks_sub_standards (organization_id, ic_plan_id, main_standard_id, code, title, description, order_index)
  VALUES (
    v_org_id, v_plan_id, v_kiks_main_id, 'KO.01.01', 'Etik Kurallar ve Davranış Kuralları',
    'Kurumda yazılı etik kurallar ve davranış kuralları oluşturulmalı, tüm personele duyurulmalı ve uygulanmalıdır', 1
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_kiks_sub_id FROM ic_kiks_sub_standards
  WHERE organization_id = v_org_id AND ic_plan_id = v_plan_id AND code = 'KO.01.01';

  RAISE NOTICE '   ✅ KİKS: KO > KO.01 > KO.01.01';

  -- ============================================
  -- 3. SÜREÇ YÖNETİMİ
  -- ============================================
  RAISE NOTICE '3️⃣  Süreç Yönetimi - Satın Alma Süreci oluşturuluyor...';

  INSERT INTO ic_processes (
    organization_id, ic_plan_id, department_id, code, name, description,
    owner_user_id, process_category, is_critical, status, kiks_standard_id
  ) VALUES (
    v_org_id, v_plan_id, v_dept_id, 'SRC-2024-001',
    'Satın Alma ve İhale Süreci',
    'Kurumun mal ve hizmet alımlarında izlenen süreç. 4734 sayılı Kamu İhale Kanununa uygun olarak yürütülür.',
    v_user_id, 'Mali', true, 'active', v_kiks_sub_id
  )
  ON CONFLICT (organization_id, code) DO NOTHING;

  SELECT id INTO v_process_id FROM ic_processes
  WHERE organization_id = v_org_id AND code = 'SRC-2024-001';

  -- Süreç Adımları
  INSERT INTO ic_process_steps (organization_id, ic_plan_id, process_id, step_number, step_name, step_description, responsible_role, responsible_user_id, inputs, outputs, tools_used, estimated_duration, step_type, is_critical_control_point) VALUES
  (v_org_id, v_plan_id, v_process_id, 1, 'İhtiyaç Tespiti', 'İlgili birim ihtiyacını tespit eder ve talep formu doldurur', 'Birim Yetkilisi', v_user_id, 'İhtiyaç Analizi', 'Talep Formu', 'Talep Formu Şablonu', '1 gün', 'process', false),
  (v_org_id, v_plan_id, v_process_id, 2, 'Talep Onayı', 'Birim müdürü talebi inceler ve onaylar', 'Birim Müdürü', v_user_id, 'Talep Formu', 'Onaylı Talep', 'Doküman Yönetim Sistemi', '2 saat', 'decision', true),
  (v_org_id, v_plan_id, v_process_id, 3, 'Bütçe Kontrolü', 'Mali hizmetler birimi bütçe uygunluğunu kontrol eder', 'Mali Uzman', v_user_id, 'Onaylı Talep, Bütçe Verileri', 'Bütçe Uygunluk Formu', 'Bütçe Sistemi', '4 saat', 'process', true),
  (v_org_id, v_plan_id, v_process_id, 4, 'İhale Hazırlık', 'Satın alma birimi ihale dosyası hazırlar', 'Satın Alma Uzmanı', v_user_id, 'Teknik Şartname', 'İhale Dosyası', 'İhale Dosya Şablonları', '1 hafta', 'process', false),
  (v_org_id, v_plan_id, v_process_id, 5, 'İhale Komisyonu Değerlendirme', 'İhale komisyonu teklifleri değerlendirir ve karara bağlar', 'İhale Komisyonu', v_user_id, 'Teklifler', 'Değerlendirme Raporu', 'Değerlendirme Formu', '3 gün', 'process', true),
  (v_org_id, v_plan_id, v_process_id, 6, 'Sözleşme İmzalama', 'Kazanan firma ile sözleşme imzalanır', 'Hukuk Müşaviri', v_user_id, 'İhale Kararı', 'İmzalı Sözleşme', 'Sözleşme Şablonu', '1 gün', 'process', false),
  (v_org_id, v_plan_id, v_process_id, 7, 'Muayene ve Kabul', 'Mal/hizmet teslim alınır ve muayene edilir', 'Muayene Komisyonu', v_user_id, 'Teslim Belgesi', 'Muayene Kabul Tutanağı', 'Muayene Formu', '2 gün', 'process', true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '   ✅ Süreç: SRC-2024-001 (7 adım)';

  -- ============================================
  -- 4. RİSK YÖNETİMİ
  -- ============================================
  RAISE NOTICE '4️⃣  Risk Yönetimi oluşturuluyor...';

  INSERT INTO ic_risks (
    organization_id, ic_plan_id, process_id, risk_code, risk_title, risk_description,
    risk_category, risk_owner_id, inherent_likelihood, inherent_impact,
    residual_likelihood, residual_impact, status, last_assessment_date, kiks_standard_id
  ) VALUES (
    v_org_id, v_plan_id, v_process_id, 'RSK-2024-001',
    'Tedarikçi Seçiminde Objektiflik Riski',
    'İhale değerlendirmesinde subjektif kriterler kullanılması veya çıkar çatışması durumunun oluşması riski. Bu durum, haksız rekabet ve kamu kaynağının etkin kullanılamamasına yol açabilir.',
    'compliance', v_user_id, 5, 4, 2, 3, 'mitigating', CURRENT_DATE, v_kiks_sub_id
  )
  ON CONFLICT (organization_id, risk_code) DO NOTHING;

  SELECT id INTO v_risk_id FROM ic_risks
  WHERE organization_id = v_org_id AND risk_code = 'RSK-2024-001';

  RAISE NOTICE '   ✅ Risk: RSK-2024-001 (Doğal: 20, Artık: 6)';

  -- ============================================
  -- 5. KONTROL FAALİYETLERİ
  -- ============================================
  RAISE NOTICE '5️⃣  Kontrol Faaliyetleri oluşturuluyor...';

  INSERT INTO ic_controls (
    organization_id, ic_plan_id, risk_id, process_id, control_code, control_title,
    control_description, control_type, control_nature, frequency,
    control_owner_id, control_performer_id,
    design_effectiveness, operating_effectiveness, status, evidence_required
  ) VALUES (
    v_org_id, v_plan_id, v_risk_id, v_process_id, 'KTR-2024-001',
    'Dört Göz Prensibi Uygulaması',
    'Tüm ihale değerlendirme süreçlerinde en az iki yetkili personelin onayının alınması. İhale komisyonu kararlarının tek kişi tarafından alınmaması, çapraz kontrol mekanizmasının işletilmesi.',
    'preventive', 'manual', 'monthly',
    v_user_id, v_user_id,
    'effective', 'effective', 'active',
    'İmzalı değerlendirme formları, komisyon tutanakları, onay evrakları'
  )
  ON CONFLICT (organization_id, control_code) DO NOTHING;

  SELECT id INTO v_control_id FROM ic_controls
  WHERE organization_id = v_org_id AND control_code = 'KTR-2024-001';

  RAISE NOTICE '   ✅ Kontrol: KTR-2024-001 (Dört Göz Prensibi)';

  -- ============================================
  -- 6. İZLEME & DEĞERLENDİRME
  -- ============================================
  RAISE NOTICE '6️⃣  Kontrol Testi oluşturuluyor...';

  INSERT INTO ic_control_tests (
    organization_id, ic_plan_id, control_id,
    test_period_start, test_period_end, tester_id, test_date,
    sample_size, exceptions_found, test_result, test_notes
  ) VALUES (
    v_org_id, v_plan_id, v_control_id,
    '2024-01-01', '2024-03-31', v_user_id, '2024-04-15',
    10, 3, 'pass_with_exceptions',
    'Q1 2024 döneminde gerçekleştirilen 10 ihaleden 3 tanesinde (IHL-2024-012, IHL-2024-018, IHL-2024-023) değerlendirme formlarında ikinci onay eksikliği tespit edilmiştir. Kontrol genel olarak etkin çalışmaktadır ancak belirtilen eksiklikler giderilmelidir.'
  );

  SELECT id INTO v_test_id FROM ic_control_tests
  WHERE organization_id = v_org_id AND control_id = v_control_id
  ORDER BY created_at DESC LIMIT 1;

  RAISE NOTICE '   ✅ Test: Q1 2024 (3 istisna bulundu)';

  -- ============================================
  -- 7. BULGU YÖNETİMİ
  -- ============================================
  RAISE NOTICE '7️⃣  Bulgu oluşturuluyor...';

  INSERT INTO ic_findings (
    organization_id, ic_plan_id, finding_code, finding_title, finding_description,
    finding_source, control_test_id, risk_id, control_id,
    severity, identified_by, identified_date, status, root_cause_analysis
  ) VALUES (
    v_org_id, v_plan_id, 'BLG-2024-001',
    '3 İhalede Değerlendirme Formlarında İkinci Onay Eksikliği',
    'Q1 2024 döneminde yapılan kontrol testinde, 10 ihale dosyasından 3 tanesinde değerlendirme formlarının sadece bir yetkili tarafından onaylandığı, dört göz prensibinin uygulanmadığı tespit edilmiştir. İhaleler: IHL-2024-012 (50.000 TL), IHL-2024-018 (120.000 TL), IHL-2024-023 (85.000 TL)',
    'control_test', v_test_id, v_risk_id, v_control_id,
    'medium', v_user_id, '2024-04-15', 'open',
    'Kök Neden Analizi: İhale yoğunluğunun artması nedeniyle ikinci onaylayıcıların yetişememesi. İş yükü dağılımının dengeli olmayışı ve yedek onaylayıcı mekanizmasının bulunmaması.'
  )
  ON CONFLICT (organization_id, finding_code) DO NOTHING;

  SELECT id INTO v_finding_id FROM ic_findings
  WHERE organization_id = v_org_id AND finding_code = 'BLG-2024-001';

  RAISE NOTICE '   ✅ Bulgu: BLG-2024-001';

  -- ============================================
  -- 8. CAPA YÖNETİMİ
  -- ============================================
  RAISE NOTICE '8️⃣  CAPA (Düzeltici/Önleyici Faaliyet) oluşturuluyor...';

  INSERT INTO ic_capas (
    organization_id, ic_plan_id, capa_code, capa_type, finding_id,
    title, description, root_cause, proposed_action,
    responsible_user_id, responsible_department_id,
    due_date, priority, status, completion_percentage
  ) VALUES (
    v_org_id, v_plan_id, 'DÖF-2024-001', 'both', v_finding_id,
    'İhale Değerlendirme Sürecinde Dört Göz Prensibinin Güçlendirilmesi',
    'Tüm ihale değerlendirme formlarının mutlaka iki yetkili tarafından onaylanmasını sağlayacak sistem iyileştirmeleri',
    'İş yükü dengesizliği ve yedek onaylayıcı mekanizmasının olmaması',
    'DÜZELTİCİ: 1) Eksik olan 3 ihale dosyasının ikinci onayları tamamlanacak. 2) Tüm personele dört göz prensibi hatırlatması. ÖNLEYİCİ: 1) Elektronik onay sistemi kurulacak. 2) Yedek onaylayıcı listesi oluşturulacak. 3) İş yükü dengeleme mekanizması.',
    v_user_id, v_dept_id,
    CURRENT_DATE + INTERVAL '60 days', 'high', 'in_progress', 40
  )
  ON CONFLICT (organization_id, capa_code) DO NOTHING;

  SELECT id INTO v_capa_id FROM ic_capas
  WHERE organization_id = v_org_id AND capa_code = 'DÖF-2024-001';

  -- CAPA Aksiyonları
  INSERT INTO ic_capa_actions (organization_id, ic_plan_id, capa_id, action_date, action_taken, completion_percentage, entered_by, notes) VALUES
  (v_org_id, v_plan_id, v_capa_id, CURRENT_DATE - INTERVAL '5 days', 'Eksik olan 3 ihale dosyasının ikinci onayları tamamlandı', 100, v_user_id, 'Düzeltici faaliyet tamamlandı'),
  (v_org_id, v_plan_id, v_capa_id, CURRENT_DATE - INTERVAL '3 days', 'Tüm satın alma personeline eğitim verildi (12 kişi)', 100, v_user_id, 'Eğitim katılım listesi mevcut'),
  (v_org_id, v_plan_id, v_capa_id, CURRENT_DATE, 'Elektronik onay sistemi için yazılım firması ile görüşme yapıldı', 30, v_user_id, 'Önleyici faaliyet devam ediyor')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '   ✅ CAPA: DÖF-2024-001 (3 aksiyon)';

  -- ============================================
  -- 9. EYLEM PLANLARI
  -- ============================================
  RAISE NOTICE '9️⃣  Eylem Planı oluşturuluyor...';

  INSERT INTO ic_action_plans (
    organization_id, ic_plan_id, action_code, title, description,
    kiks_sub_standard_id, risk_id, process_id,
    responsible_user_id, responsible_department_id,
    start_date, target_date, priority, status, completion_percentage
  ) VALUES (
    v_org_id, v_plan_id, 'EP-2024-001',
    'Satın Alma Prosedürlerinin Güncellenmesi ve Etik Kuralların Entegrasyonu',
    'Mevcut satın alma prosedürlerinin KİKS standartlarına uygun şekilde güncellenmesi, etik kuralların prosedüre entegre edilmesi ve tüm personele eğitim verilmesi.',
    v_kiks_sub_id, v_risk_id, v_process_id,
    v_user_id, v_dept_id,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days',
    'high', 'in_progress', 60
  )
  ON CONFLICT (organization_id, action_code) DO NOTHING;

  SELECT id INTO v_action_plan_id FROM ic_action_plans
  WHERE organization_id = v_org_id AND action_code = 'EP-2024-001';

  -- KİKS Aksiyonları
  INSERT INTO ic_kiks_actions (organization_id, ic_plan_id, action_plan_id, kiks_sub_standard_id, action_number, action_description, responsible_user_id, target_date, status, completion_percentage, output_result) VALUES
  (v_org_id, v_plan_id, v_action_plan_id, v_kiks_sub_id, 1, 'Satın alma prosedürü taslağının hazırlanması', v_user_id, CURRENT_DATE + INTERVAL '30 days', 'completed', 100, 'Prosedür taslağı hazırlandı ve ilgili birimlerle paylaşıldı'),
  (v_org_id, v_plan_id, v_action_plan_id, v_kiks_sub_id, 2, 'Etik kurallar ve çıkar çatışması prosedürlerinin eklenmesi', v_user_id, CURRENT_DATE + INTERVAL '60 days', 'in_progress', 70, 'Etik kurallar bölümü eklendi, çıkar çatışması kısmı hazırlanıyor'),
  (v_org_id, v_plan_id, v_action_plan_id, v_kiks_sub_id, 3, 'Personel eğitim programının düzenlenmesi', v_user_id, CURRENT_DATE + INTERVAL '90 days', 'planned', 0, NULL)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '   ✅ Eylem Planı: EP-2024-001 (3 aksiyon)';

  -- ============================================
  -- 10. ÖZDEĞERLENDİRME
  -- ============================================
  RAISE NOTICE '🔟 Özdeğerlendirme oluşturuluyor...';

  INSERT INTO ic_kiks_sub_standard_organization_statuses (
    organization_id, ic_plan_id, kiks_sub_standard_id,
    current_status, compliance_percentage, provides_reasonable_assurance,
    evidence_documents, assessment_notes, last_assessment_date
  ) VALUES (
    v_org_id, v_plan_id, v_kiks_sub_id,
    'substantially_compliant', 80, true,
    'Etik kurallar belgesi (2023-ETK-001), Personel eğitim kayıtları (150 kişi), İmza formları (tüm personel), Uygulama örnekleri',
    'Kurum genelinde etik kurallar oluşturulmuş ve duyurulmuştur. Personelin %85''i eğitim almıştır. Bazı birimlerde uygulama eksiklikleri mevcuttur ancak genel olarak sistem işlemektedir. Yıllık güncelleme ve eğitimlerle uyumun %90''a çıkarılması hedeflenmektedir.',
    CURRENT_DATE
  )
  ON CONFLICT (organization_id, ic_plan_id, kiks_sub_standard_id)
  DO UPDATE SET
    current_status = EXCLUDED.current_status,
    compliance_percentage = EXCLUDED.compliance_percentage,
    provides_reasonable_assurance = EXCLUDED.provides_reasonable_assurance,
    last_assessment_date = EXCLUDED.last_assessment_date;

  RAISE NOTICE '   ✅ Özdeğerlendirme: %%80 Uyumlu - Makul Güvence';

  -- ============================================
  -- ÖZET RAPOR
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ TÜM ÖRNEK VERİLER BAŞARIYLA OLUŞTURULDU!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Oluşturulan Kayıtlar:';
  RAISE NOTICE '   1. İç Kontrol Planı: 2024 Yılı İç Kontrol Planı';
  RAISE NOTICE '   2. KİKS Standardı: KO.01.01 - Etik Kurallar';
  RAISE NOTICE '   3. Süreç: SRC-2024-001 - Satın Alma (7 adım)';
  RAISE NOTICE '   4. Risk: RSK-2024-001 (Doğal:20 → Artık:6)';
  RAISE NOTICE '   5. Kontrol: KTR-2024-001 - Dört Göz Prensibi';
  RAISE NOTICE '   6. Test: Q1 2024 (10 dosya, 3 istisna)';
  RAISE NOTICE '   7. Bulgu: BLG-2024-001 - 3 İhalede Onay Eksikliği';
  RAISE NOTICE '   8. CAPA: DÖF-2024-001 (Düzeltici+Önleyici, 3 aksiyon)';
  RAISE NOTICE '   9. Eylem Planı: EP-2024-001 (KİKS Uyum, 3 aksiyon)';
  RAISE NOTICE '   10. Özdeğerlendirme: %%80 Uyumlu - Makul Güvence Sağlıyor';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Entegrasyon Akışı:';
  RAISE NOTICE '   Plan → KİKS → Süreç → Risk → Kontrol → Test → Bulgu → CAPA → Eylem';
  RAISE NOTICE '';
  RAISE NOTICE '✨ Artık tüm iç kontrol modülü sayfalarını test edebilirsiniz!';
  RAISE NOTICE '';
  RAISE NOTICE 'Detaylı bilgi için: IC_MODUL_ENTEGRASYON_REHBERI.md';
  RAISE NOTICE '';

END $$;
