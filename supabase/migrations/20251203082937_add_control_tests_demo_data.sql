/*
  # Add Control Tests Demo Data

  Adds sample control test data for monitoring and evaluation page:
  - Control tests with various results (pass, fail, pass_with_exceptions)
  - Different test periods (monthly, quarterly)
  - Sample size and exceptions tracking
*/

DO $$
DECLARE
  v_org_id uuid := '525d1056-ba28-46e1-9a9c-0734b9a49cf7';
  v_admin_id uuid := '62b6914c-e524-4116-ae13-c04b81c2ec20';
  v_control_1 uuid;
  v_control_2 uuid;
  v_control_3 uuid;
  v_control_4 uuid;
  v_control_5 uuid;
  v_control_6 uuid;
  v_control_7 uuid;
  v_control_8 uuid;
BEGIN
  -- Get control IDs
  SELECT id INTO v_control_1 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-001';
  SELECT id INTO v_control_2 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-002';
  SELECT id INTO v_control_3 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-003';
  SELECT id INTO v_control_4 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-004';
  SELECT id INTO v_control_5 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-005';
  SELECT id INTO v_control_6 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-006';
  SELECT id INTO v_control_7 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-007';
  SELECT id INTO v_control_8 FROM ic_controls WHERE organization_id = v_org_id AND control_code = 'KNT-008';

  -- Add control tests with various results
  
  -- Test 1: KNT-001 - Başarılı (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_1, '2024-11-01', '2024-11-30',
    v_admin_id, '2024-12-02', 25, 0,
    'pass', 'Satın alma yetki matrisi kontrolü yapıldı. Tüm satın alma işlemleri yetkili kişiler tarafından onaylanmış.'
  );

  -- Test 2: KNT-002 - İstisnalı Başarı (Pass with Exceptions)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_2, '2024-11-01', '2024-11-30',
    v_admin_id, '2024-12-02', 30, 2,
    'pass_with_exceptions', 'Çift imza kontrolü test edildi. 30 işlemden 2 tanesinde ikinci imza eksikliği tespit edildi. İlgili personelle görüşüldü.'
  );

  -- Test 3: KNT-003 - Başarısız (Fail)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_3, '2024-10-01', '2024-10-31',
    v_admin_id, '2024-11-05', 20, 5,
    'fail', 'Sistem yetkilendirme kontrolünde ciddi eksiklikler bulundu. 20 kullanıcıdan 5 tanesinin gereksiz yetkileri var. DÖF açıldı.'
  );

  -- Test 4: KNT-004 - Başarılı (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_4, '2024-11-01', '2024-11-30',
    v_admin_id, '2024-12-01', 50, 0,
    'pass', 'Bütçe ödenek kontrolü başarılı. Tüm harcamalar bütçe ödeneği dahilinde gerçekleştirilmiş.'
  );

  -- Test 5: KNT-005 - Başarılı (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_5, '2024-10-01', '2024-10-31',
    v_admin_id, '2024-11-05', 12, 0,
    'pass', 'Aylık bütçe gerçekleşme raporları zamanında ve eksiksiz hazırlanmış.'
  );

  -- Test 6: KNT-006 - İstisnalı Başarı (Pass with Exceptions)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_6, '2024-09-01', '2024-09-30',
    v_admin_id, '2024-10-10', 15, 1,
    'pass_with_exceptions', 'Bütçe sapma uyarı sistemi çalışıyor. Bir birimde eşik aşımı zamanında bildirilmemiş.'
  );

  -- Test 7: KNT-007 - Başarılı (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_7, '2024-11-01', '2024-11-30',
    v_admin_id, '2024-12-03', 4, 0,
    'pass', 'Yedekleme prosedürü test edildi. Haftalık yedeklemeler başarılı, kurtarma testi yapıldı ve başarılı oldu.'
  );

  -- Test 8: KNT-008 - Başarılı (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_8, '2024-10-01', '2024-12-31',
    v_admin_id, '2024-11-15', 100, 0,
    'pass', 'Üç aylık kullanıcı erişim gözden geçirmesi tamamlandı. Tüm kullanıcı yetkileri uygun bulundu.'
  );

  -- Test 9: KNT-001 - Geçmiş Dönem Testi (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_1, '2024-10-01', '2024-10-31',
    v_admin_id, '2024-11-02', 22, 0,
    'pass', 'Ekim ayı satın alma yetki matrisi kontrolü başarılı.'
  );

  -- Test 10: KNT-004 - Geçmiş Dönem Testi (Pass with Exceptions)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_4, '2024-10-01', '2024-10-31',
    v_admin_id, '2024-11-01', 45, 1,
    'pass_with_exceptions', 'Ekim ayı bütçe ödenek kontrolü. Bir işlemde küçük bir ödenek aşımı tespit edildi ve düzeltildi.'
  );

  -- Test 11: KNT-002 - Geçmiş Dönem Testi (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_2, '2024-10-01', '2024-10-31',
    v_admin_id, '2024-11-03', 28, 0,
    'pass', 'Ekim ayı çift imza kontrolü başarılı. Tüm belgeler iki yetkili tarafından imzalanmış.'
  );

  -- Test 12: KNT-005 - Geçmiş Dönem Testi (Pass)
  INSERT INTO ic_control_tests (
    organization_id, control_id, test_period_start, test_period_end,
    tester_id, test_date, sample_size, exceptions_found,
    test_result, test_notes
  ) VALUES (
    v_org_id, v_control_5, '2024-09-01', '2024-09-30',
    v_admin_id, '2024-10-05', 12, 0,
    'pass', 'Eylül ayı bütçe raporları zamanında hazırlanmış.'
  );

  RAISE NOTICE 'Control tests demo data added successfully - 12 test records created';
END $$;