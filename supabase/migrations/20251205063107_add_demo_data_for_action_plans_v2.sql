/*
  # Demo Verileri - Eylem Planı Otomatik Oluşturma İçin (v2)
  
  Bu migration eylem planı otomatik oluşturma özelliğinin çalışması için gerekli demo verilerini ekler.
*/

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_dept_id uuid;
  v_process_id1 uuid;
  v_process_id2 uuid;
  v_control_id1 uuid;
  v_control_id2 uuid;
  v_control_id3 uuid;
  v_risk_id1 uuid;
  v_risk_id2 uuid;
  v_risk_id3 uuid;
  v_collab_plan_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  SELECT id INTO v_user_id FROM profiles WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;

  SELECT id INTO v_process_id1 FROM ic_processes WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;
  IF v_process_id1 IS NULL THEN
    INSERT INTO ic_processes (organization_id, code, name, description, is_critical, status)
    VALUES (v_org_id, 'PR001', 'Finansal Raporlama', 'Finansal raporların hazırlanması ve onaylanması süreci', true, 'active')
    RETURNING id INTO v_process_id1;
  END IF;

  SELECT id INTO v_process_id2 FROM ic_processes WHERE organization_id = v_org_id AND id != v_process_id1 ORDER BY created_at LIMIT 1;
  IF v_process_id2 IS NULL THEN
    INSERT INTO ic_processes (organization_id, code, name, description, is_critical, status)
    VALUES (v_org_id, 'PR002', 'Satın Alma', 'Satın alma süreçleri ve onay mekanizmaları', true, 'active')
    RETURNING id INTO v_process_id2;
  END IF;

  SELECT id INTO v_control_id1 FROM ic_controls WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;
  IF v_control_id1 IS NULL THEN
    INSERT INTO ic_controls (organization_id, process_id, control_code, control_title, control_description, control_type, frequency, design_effectiveness, operating_effectiveness, status)
    VALUES (v_org_id, v_process_id1, 'CTR001', 'Mali Rapor Onayı', 'Mali raporların yetkili kişi tarafından onaylanması', 'preventive', 'monthly', 'effective', 'partially_effective', 'active')
    RETURNING id INTO v_control_id1;
  END IF;

  SELECT id INTO v_control_id2 FROM ic_controls WHERE organization_id = v_org_id AND id != v_control_id1 ORDER BY created_at LIMIT 1;
  IF v_control_id2 IS NULL THEN
    INSERT INTO ic_controls (organization_id, process_id, control_code, control_title, control_description, control_type, frequency, design_effectiveness, operating_effectiveness, status)
    VALUES (v_org_id, v_process_id2, 'CTR002', 'Satın Alma Onayı', 'Satın alma taleplerinin bütçe kontrolü ve onayı', 'preventive', 'daily', 'effective', 'ineffective', 'active')
    RETURNING id INTO v_control_id2;
  END IF;

  SELECT id INTO v_control_id3 FROM ic_controls WHERE organization_id = v_org_id AND id != v_control_id1 AND id != v_control_id2 ORDER BY created_at LIMIT 1;
  IF v_control_id3 IS NULL THEN
    INSERT INTO ic_controls (organization_id, process_id, control_code, control_title, control_description, control_type, frequency, design_effectiveness, operating_effectiveness, status)
    VALUES (v_org_id, v_process_id1, 'CTR003', 'Veri Yedekleme', 'Finansal verilerin düzenli olarak yedeklenmesi', 'detective', 'weekly', 'partially_effective', 'ineffective', 'active')
    RETURNING id INTO v_control_id3;
  END IF;

  INSERT INTO ic_risks (organization_id, process_id, risk_code, risk_title, risk_description, risk_category, risk_owner_id, 
                        inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, status)
  VALUES 
    (v_org_id, v_process_id1, 'RSK001', 'Finansal Veri Kaybı', 'Finansal verilerin kaybolması veya zarar görmesi riski', 'financial', v_user_id, 4, 5, 3, 4, 'assessed'),
    (v_org_id, v_process_id2, 'RSK002', 'Yetkisiz Satın Alma', 'Yetkisiz kişiler tarafından satın alma yapılması', 'compliance', v_user_id, 4, 4, 3, 3, 'assessed'),
    (v_org_id, v_process_id1, 'RSK003', 'Hatalı Raporlama', 'Mali raporlarda hata veya manipülasyon riski', 'financial', v_user_id, 3, 5, 2, 4, 'mitigating'),
    (v_org_id, v_process_id2, 'RSK004', 'Tedarikçi Riski', 'Tedarikçi seçiminde yanlış karar verilmesi', 'operational', v_user_id, 4, 4, 3, 3, 'identified'),
    (v_org_id, v_process_id1, 'RSK005', 'Siber Güvenlik', 'Finansal sistemlere siber saldırı riski', 'reputational', v_user_id, 5, 4, 4, 3, 'mitigating');

  SELECT id INTO v_risk_id1 FROM ic_risks WHERE organization_id = v_org_id AND risk_code = 'RSK001' LIMIT 1;
  SELECT id INTO v_risk_id2 FROM ic_risks WHERE organization_id = v_org_id AND risk_code = 'RSK002' LIMIT 1;
  SELECT id INTO v_risk_id3 FROM ic_risks WHERE organization_id = v_org_id AND risk_code = 'RSK003' LIMIT 1;

  INSERT INTO ic_control_tests (organization_id, control_id, test_period_start, test_period_end, tester_id, test_date, 
                                 sample_size, exceptions_found, test_result, test_notes)
  VALUES 
    (v_org_id, v_control_id2, '2024-10-01', '2024-10-31', v_user_id, '2024-11-05', 50, 15, 'fail', 'Bütçe kontrolsüz onaylar tespit edildi'),
    (v_org_id, v_control_id3, '2024-10-01', '2024-10-31', v_user_id, '2024-11-05', 30, 8, 'pass_with_exceptions', 'Bazı yedeklemelerde gecikme var');

  INSERT INTO ic_findings (organization_id, finding_code, finding_title, finding_description, finding_source, control_id, 
                          severity, identified_by, identified_date, status, root_cause_analysis)
  VALUES 
    (v_org_id, 'BLG001', 'Yetkisiz Ödeme Onayları', 'Bütçe kontrolsüz ödeme onayları tespit edildi', 'control_test', v_control_id2, 'high', v_user_id, '2024-11-05', 'open', 'Onay mekanizması eksik'),
    (v_org_id, 'BLG002', 'Veri Yedekleme Eksikliği', 'Kritik finansal verilerin yedeklenmediği tespit edildi', 'internal_audit', v_control_id3, 'critical', v_user_id, '2024-11-01', 'open', 'Otomatik yedekleme sistemi çalışmıyor'),
    (v_org_id, 'BLG003', 'Görevler Ayrılığı İhlali', 'Aynı kişi hem talep ediyor hem onaylıyor', 'self_assessment', v_control_id2, 'high', v_user_id, '2024-10-28', 'open', 'Sistem konfigürasyonu yanlış'),
    (v_org_id, 'BLG004', 'Eksik Dokümantasyon', 'Önemli süreç adımları dokümante edilmemiş', 'management_review', v_control_id1, 'high', v_user_id, '2024-10-20', 'in_progress', 'Dokümantasyon prosedürü yok'),
    (v_org_id, 'BLG005', 'Güvenlik Açığı', 'Sistemde kritik güvenlik açığı tespit edildi', 'external_audit', v_control_id1, 'critical', v_user_id, '2024-10-15', 'open', 'Sistem güncellemesi yapılmamış');

  INSERT INTO ic_capas (organization_id, capa_code, capa_type, title, description, root_cause, proposed_action, 
                       responsible_user_id, responsible_department_id, due_date, priority, status, completion_percentage)
  VALUES 
    (v_org_id, 'CAPA001', 'corrective', 'Onay Mekanizması İyileştirme', 'Bütçe onay sürecinin iyileştirilmesi', 'Sistem kontrolü yetersiz', 'Otomatik bütçe kontrolü eklenmesi', v_user_id, v_dept_id, CURRENT_DATE + INTERVAL '60 days', 'high', 'in_progress', 40),
    (v_org_id, 'CAPA002', 'preventive', 'Yedekleme Sistemi Kurulumu', 'Otomatik yedekleme sisteminin kurulması', 'Yedekleme prosedürü yok', 'Günlük otomatik yedekleme yapılandırması', v_user_id, v_dept_id, CURRENT_DATE + INTERVAL '45 days', 'critical', 'open', 10),
    (v_org_id, 'CAPA003', 'corrective', 'Görevler Ayrılığı Kontrolü', 'Sistem yetkilerinin gözden geçirilmesi', 'Yetki matrisi eksik', 'Yetki matrisi oluşturulması ve uygulanması', v_user_id, v_dept_id, CURRENT_DATE + INTERVAL '30 days', 'high', 'open', 0),
    (v_org_id, 'CAPA004', 'preventive', 'Dokümantasyon Standardı', 'Tüm süreçler için dokümantasyon standardı', 'Standart prosedür yok', 'Dokümantasyon şablonları hazırlanması', v_user_id, v_dept_id, CURRENT_DATE + INTERVAL '90 days', 'medium', 'open', 20);

  SELECT id INTO v_collab_plan_id FROM collaboration_plans WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;
  
  IF v_collab_plan_id IS NOT NULL THEN
    INSERT INTO collaboration_plan_risks (collaboration_plan_id, ic_risk_id, risk_description, risk_category, 
                                         probability, impact, mitigation_strategy, 
                                         responsible_user_id, responsible_department_id, status)
    VALUES 
      (v_collab_plan_id, v_risk_id1, 'İşbirliği sürecinde veri güvenliği riski', 'technological', 'high', 'high', 'Güvenli veri paylaşım protokolü oluşturulması', v_user_id, v_dept_id, 'identified'),
      (v_collab_plan_id, v_risk_id2, 'İşbirliği bütçe aşımı riski', 'financial', 'very_high', 'high', 'Aylık bütçe takip mekanizması kurulması', v_user_id, v_dept_id, 'identified'),
      (v_collab_plan_id, v_risk_id3, 'Koordinasyon eksikliği riski', 'operational', 'high', 'very_high', 'Haftalık koordinasyon toplantıları planlanması', v_user_id, v_dept_id, 'assessed');
  END IF;

END $$;
