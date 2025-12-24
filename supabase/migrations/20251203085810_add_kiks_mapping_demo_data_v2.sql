/*
  # Add KİKS Process Mapping Demo Data v2

  Adds sample process-to-KIKS standard mappings for reporting with mapping_type:
  - Maps existing processes to KIKS standards
  - Various compliance levels for realistic reporting
*/

DO $$
DECLARE
  v_org_id uuid := '525d1056-ba28-46e1-9a9c-0734b9a49cf7';
  v_process_1 uuid;
  v_process_2 uuid;
  v_process_3 uuid;
  v_process_4 uuid;
  v_kiks_1 uuid;
  v_kiks_2 uuid;
  v_kiks_3 uuid;
  v_kiks_4 uuid;
BEGIN
  -- Get process IDs
  SELECT id INTO v_process_1 FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-001' LIMIT 1;
  SELECT id INTO v_process_2 FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-002' LIMIT 1;
  SELECT id INTO v_process_3 FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-003' LIMIT 1;
  SELECT id INTO v_process_4 FROM ic_processes WHERE organization_id = v_org_id AND code = 'SRC-004' LIMIT 1;

  -- Get KIKS standard IDs
  SELECT id INTO v_kiks_1 FROM ic_kiks_standards WHERE organization_id = v_org_id AND code = 'Bİ.9.1' LIMIT 1;
  SELECT id INTO v_kiks_2 FROM ic_kiks_standards WHERE organization_id = v_org_id AND code = 'Bİ.9.2' LIMIT 1;
  SELECT id INTO v_kiks_3 FROM ic_kiks_standards WHERE organization_id = v_org_id AND code = 'Bİ.10.1' LIMIT 1;
  SELECT id INTO v_kiks_4 FROM ic_kiks_standards WHERE organization_id = v_org_id AND code = 'İZ.11.1' LIMIT 1;

  -- Only insert if we have valid IDs
  IF v_process_1 IS NOT NULL AND v_kiks_1 IS NOT NULL THEN
    INSERT INTO ic_process_kiks_mappings (
      organization_id, process_id, kiks_standard_id, mapping_type, compliance_level, notes
    ) VALUES
    (v_org_id, v_process_1, v_kiks_1, 'process', 'fully_compliant', 'Bilgi ve iletişim süreçleri tam uyumludur.'),
    (v_org_id, v_process_1, v_kiks_2, 'process', 'compliant', 'Raporlama süreçleri uyumludur.');
  END IF;

  IF v_process_2 IS NOT NULL AND v_kiks_3 IS NOT NULL THEN
    INSERT INTO ic_process_kiks_mappings (
      organization_id, process_id, kiks_standard_id, mapping_type, compliance_level, notes
    ) VALUES
    (v_org_id, v_process_2, v_kiks_3, 'process', 'compliant', 'Bilgi sistemleri kontrolü uygulanıyor.');
  END IF;

  IF v_process_3 IS NOT NULL AND v_kiks_4 IS NOT NULL THEN
    INSERT INTO ic_process_kiks_mappings (
      organization_id, process_id, kiks_standard_id, mapping_type, compliance_level, notes
    ) VALUES
    (v_org_id, v_process_3, v_kiks_4, 'process', 'partially_compliant', 'İç kontrol değerlendirmesi kısmen uyumlu, iyileştirme devam ediyor.');
  END IF;

  IF v_process_4 IS NOT NULL AND v_kiks_1 IS NOT NULL THEN
    INSERT INTO ic_process_kiks_mappings (
      organization_id, process_id, kiks_standard_id, mapping_type, compliance_level, notes
    ) VALUES
    (v_org_id, v_process_4, v_kiks_1, 'process', 'compliant', 'Bilgi ve iletişim standardına uyumludur.');
  END IF;

  RAISE NOTICE 'KIKS mapping demo data added successfully';
END $$;