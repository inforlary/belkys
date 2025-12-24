/*
  # Add Demo Data for Controls, Findings, and CAPA (Corrected)

  Adds:
  - 8 Control Activities
  - 4 Findings (correct enum values)
  - 4 CAPA records (correct enum values)
*/

DO $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_admin_id uuid;
  v_risk_id_1 uuid;
  v_risk_id_2 uuid;
  v_process_id uuid;
  v_control_id_1 uuid;
  v_control_id_2 uuid;
  v_finding_id_1 uuid;
  v_finding_id_2 uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND organization_id = v_org_id LIMIT 1;
  
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_risk_id_1 FROM ic_risks WHERE organization_id = v_org_id AND risk_code = 'RSK-001';
  SELECT id INTO v_risk_id_2 FROM ic_risks WHERE organization_id = v_org_id AND risk_code = 'RSK-002';
  SELECT id INTO v_process_id FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-001';

  -- ============================================================================
  -- 1. CONTROL ACTIVITIES (8 controls)
  -- ============================================================================
  
  INSERT INTO ic_controls (organization_id, risk_id, process_id, control_code, control_title, control_description, control_type, control_nature, frequency, control_owner_id, control_performer_id, design_effectiveness, operating_effectiveness, status)
  VALUES 
  (v_org_id, v_risk_id_1, v_process_id, 'KNT-001', 'Satın Alma Yetki Matrisi', 'Satın alma işlemleri için yetki limitleri belirlenmiş ve uygulanmaktadır', 'preventive', 'manual', 'continuous', v_admin_id, v_admin_id, 'effective', 'effective', 'active')
  RETURNING id INTO v_control_id_1;
  
  INSERT INTO ic_controls (organization_id, risk_id, process_id, control_code, control_title, control_description, control_type, control_nature, frequency, control_owner_id, control_performer_id, design_effectiveness, operating_effectiveness, status)
  VALUES 
  (v_org_id, v_risk_id_1, v_process_id, 'KNT-002', 'Çift İmza Kontrolü', 'Belirli tutarın üzerindeki satın almalar için çift imza zorunluluğu', 'preventive', 'manual', 'continuous', v_admin_id, v_admin_id, 'effective', 'partially_effective', 'active')
  RETURNING id INTO v_control_id_2;
  
  INSERT INTO ic_controls (organization_id, risk_id, process_id, control_code, control_title, control_description, control_type, control_nature, frequency, control_owner_id, control_performer_id, design_effectiveness, operating_effectiveness, status)
  VALUES 
  (v_org_id, v_risk_id_1, v_process_id, 'KNT-003', 'Sistem Yetkilendirme Kontrolü', 'Satın alma sistemine giriş yetkisi rolü bazlı tanımlanmıştır', 'preventive', 'automated', 'continuous', v_admin_id, v_admin_id, 'effective', 'effective', 'active');

  INSERT INTO ic_controls (organization_id, risk_id, control_code, control_title, control_description, control_type, control_nature, frequency, control_owner_id, control_performer_id, design_effectiveness, operating_effectiveness, status)
  VALUES 
  (v_org_id, v_risk_id_2, 'KNT-004', 'Bütçe Ödenek Kontrolü', 'Harcama öncesi bütçe ödeneği kontrolü yapılmaktadır', 'preventive', 'automated', 'continuous', v_admin_id, v_admin_id, 'effective', 'effective', 'active'),
  (v_org_id, v_risk_id_2, 'KNT-005', 'Aylık Bütçe Gerçekleşme Raporu', 'Aylık bütçe gerçekleşme raporları hazırlanır ve gözden geçirilir', 'detective', 'manual', 'monthly', v_admin_id, v_admin_id, 'effective', 'effective', 'active'),
  (v_org_id, v_risk_id_2, 'KNT-006', 'Bütçe Sapma Uyarı Sistemi', 'Bütçe sapmaları %80 eşiğinde otomatik uyarı verir', 'detective', 'automated', 'continuous', v_admin_id, v_admin_id, 'effective', 'effective', 'active');

  INSERT INTO ic_controls (organization_id, control_code, control_title, control_description, control_type, control_nature, frequency, control_owner_id, control_performer_id, design_effectiveness, operating_effectiveness, status)
  VALUES 
  (v_org_id, 'KNT-007', 'Yedekleme ve Kurtarma Prosedürü', 'Günlük veri yedekleme ve felaket kurtarma planı', 'preventive', 'automated', 'daily', v_admin_id, v_admin_id, 'effective', 'effective', 'active'),
  (v_org_id, 'KNT-008', 'Kullanıcı Erişim Gözden Geçirme', 'Kullanıcı erişim hakları üç ayda bir gözden geçirilir', 'detective', 'manual', 'quarterly', v_admin_id, v_admin_id, 'effective', 'not_assessed', 'active');

  -- ============================================================================
  -- 2. FINDINGS (4 findings - correct sources: internal_audit, external_audit, control_test, self_assessment, management_review)
  -- ============================================================================
  
  INSERT INTO ic_findings (organization_id, finding_code, finding_title, finding_description, finding_source, control_id, risk_id, severity, identified_by, identified_date, status, root_cause_analysis)
  VALUES 
  (v_org_id, 'BLG-001', 'Çift İmza Kontrolünde Eksiklik', 'Üç adet satın alma işleminde çift imza kontrolünün atlandığı tespit edilmiştir', 'internal_audit', v_control_id_2, v_risk_id_1, 'medium', v_admin_id, CURRENT_DATE - INTERVAL '30 days', 'open', 'İş yoğunluğu nedeniyle prosedür uygulanmamış')
  RETURNING id INTO v_finding_id_1;
  
  INSERT INTO ic_findings (organization_id, finding_code, finding_title, finding_description, finding_source, control_id, severity, identified_by, identified_date, status, root_cause_analysis)
  VALUES 
  (v_org_id, 'BLG-002', 'Kullanıcı Erişim Gözden Geçirmesi Yapılmamış', 'Son iki çeyrekte kullanıcı erişim gözden geçirmesi yapılmamıştır', 'self_assessment', v_control_id_2, 'low', v_admin_id, CURRENT_DATE - INTERVAL '20 days', 'open', 'Sorumlu personelin görev değişikliği nedeniyle takip edilmemiş')
  RETURNING id INTO v_finding_id_2;
  
  INSERT INTO ic_findings (organization_id, finding_code, finding_title, finding_description, finding_source, severity, identified_by, identified_date, status, root_cause_analysis)
  VALUES 
  (v_org_id, 'BLG-003', 'Yedekleme Test Eksikliği', 'Yedekleme kurtarma testlerinin düzenli yapılmadığı görülmüştür', 'control_test', 'high', v_admin_id, CURRENT_DATE - INTERVAL '15 days', 'in_progress', 'Test prosedürü tanımlanmamış'),
  (v_org_id, 'BLG-004', 'Bütçe Raporlama Gecikmesi', 'Eylül ayı bütçe gerçekleşme raporu 10 gün gecikmeli hazırlanmıştır', 'management_review', 'low', v_admin_id, CURRENT_DATE - INTERVAL '10 days', 'closed', 'Mali ekipte geçici personel eksikliği');

  -- ============================================================================
  -- 3. CAPA RECORDS (4 CAPAs - status: open, in_progress, pending_verification, verified, closed, overdue)
  -- ============================================================================
  
  INSERT INTO ic_capas (organization_id, capa_code, capa_type, finding_id, title, description, root_cause, proposed_action, responsible_user_id, responsible_department_id, due_date, priority, status, completion_percentage)
  VALUES 
  (v_org_id, 'DÖF-001', 'corrective', v_finding_id_1, 'Çift İmza Prosedürü Uygulaması', 'Çift imza kontrolünün etkin uygulanması için önlemler alınacak', 'İş yoğunluğu ve farkındalık eksikliği', 'Satın alma ekibine prosedür eğitimi verilecek ve sistem hatırlatıcısı eklenecek', v_admin_id, v_dept_id, CURRENT_DATE + INTERVAL '30 days', 'high', 'in_progress', 60),
  
  (v_org_id, 'DÖF-002', 'corrective', v_finding_id_2, 'Kullanıcı Erişim Gözden Geçirme Planı', 'Düzenli kullanıcı erişim gözden geçirme sürecinin oluşturulması', 'Görev tanımı ve hatırlatma sistemi eksikliği', 'BT yöneticisine görev atanacak ve takvim hatırlatıcısı kurulacak', v_admin_id, v_dept_id, CURRENT_DATE + INTERVAL '45 days', 'medium', 'open', 0),
  
  (v_org_id, 'DÖF-003', 'corrective', v_finding_id_1, 'Yedekleme Test Prosedürü Oluşturma', 'Yedekleme kurtarma test prosedürünün hazırlanması ve uygulanması', 'Dokümante edilmiş test prosedürü yok', 'Test prosedürü hazırlanacak ve 6 ayda bir test yapılacak', v_admin_id, v_dept_id, CURRENT_DATE + INTERVAL '60 days', 'high', 'open', 25),
  
  (v_org_id, 'DÖF-004', 'preventive', NULL, 'Bütçe Raporlama Otomasyonu', 'Bütçe raporlama sürecinin otomasyonu ile gecikmelerin önlenmesi', 'Manuel süreç ve kaynak yetersizliği', 'Bütçe raporlama sistemine otomatik rapor üretimi eklenecek', v_admin_id, v_dept_id, CURRENT_DATE + INTERVAL '90 days', 'medium', 'open', 10);

  RAISE NOTICE 'Controls, Findings, and CAPA demo data added successfully';
END $$;