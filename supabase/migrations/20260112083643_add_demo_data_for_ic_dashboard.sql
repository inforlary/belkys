/*
  # İç Kontrol Dashboard Demo Verileri

  1. Demo Veriler
    - Örnek değerlendirmeler (ic_condition_assessments)
    - Örnek toplantı ve kararlar (ic_meetings, ic_meeting_decisions)
    
  2. Notlar
    - Bu veriler sadece dashboard görünümü için test amaçlıdır
    - Gerçek organizasyonlara bağlı olarak eklenmelidir
*/

-- İlk organizasyonu al
DO $$
DECLARE
  v_org_id UUID;
  v_plan_id UUID;
  v_dept_id UUID;
  v_user_id UUID;
  v_meeting_id UUID;
  v_component_id UUID;
  v_standard_id UUID;
  v_condition_id UUID;
BEGIN
  -- İlk organizasyonu al
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping demo data';
    RETURN;
  END IF;

  -- Aktif bir plan var mı kontrol et
  SELECT id INTO v_plan_id 
  FROM ic_action_plans 
  WHERE organization_id = v_org_id AND status = 'ACTIVE'
  LIMIT 1;

  -- Eğer aktif plan yoksa, bir tane oluştur
  IF v_plan_id IS NULL THEN
    INSERT INTO ic_action_plans (
      organization_id, 
      name, 
      description, 
      start_date, 
      end_date, 
      status
    )
    VALUES (
      v_org_id,
      '2025-2026 İç Kontrol Eylem Planı',
      'Kurumun iç kontrol sisteminin güçlendirilmesi için hazırlanan eylem planı',
      '2025-01-01',
      '2026-12-31',
      'ACTIVE'
    )
    RETURNING id INTO v_plan_id;
  END IF;

  -- Bir departman al
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  
  -- Bir kullanıcı al
  SELECT id INTO v_user_id FROM profiles WHERE organization_id = v_org_id LIMIT 1;

  -- Bileşen ve standart al
  SELECT id INTO v_component_id FROM ic_components WHERE organization_id IS NULL LIMIT 1;
  
  IF v_component_id IS NOT NULL THEN
    SELECT id INTO v_standard_id 
    FROM ic_standards 
    WHERE component_id = v_component_id AND organization_id IS NULL 
    LIMIT 1;
    
    IF v_standard_id IS NOT NULL THEN
      SELECT id INTO v_condition_id 
      FROM ic_general_conditions 
      WHERE standard_id = v_standard_id 
      LIMIT 1;
      
      -- Örnek değerlendirmeler ekle
      IF v_condition_id IS NOT NULL THEN
        -- Her bileşen için değerlendirme ekle
        FOR v_component_id IN 
          SELECT id FROM ic_components WHERE organization_id IS NULL LIMIT 5
        LOOP
          FOR v_standard_id IN 
            SELECT id FROM ic_standards 
            WHERE component_id = v_component_id AND organization_id IS NULL 
            LIMIT 3
          LOOP
            FOR v_condition_id IN 
              SELECT id FROM ic_general_conditions 
              WHERE standard_id = v_standard_id 
              LIMIT 2
            LOOP
              INSERT INTO ic_condition_assessments (
                organization_id,
                condition_id,
                action_plan_id,
                compliance_status,
                compliance_score,
                current_situation,
                assessed_by
              )
              VALUES (
                v_org_id,
                v_condition_id,
                v_plan_id,
                'PARTIAL',
                4,
                'Genel şart kısmen karşılanmaktadır.',
                v_user_id
              )
              ON CONFLICT (organization_id, condition_id, action_plan_id) 
              DO NOTHING;
            END LOOP;
          END LOOP;
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- Örnek İKİYK toplantısı ekle
  IF v_dept_id IS NOT NULL THEN
    INSERT INTO ic_meetings (
      organization_id,
      year,
      meeting_number,
      meeting_date,
      meeting_time,
      location,
      chairman_name,
      chairman_title,
      status,
      minutes
    )
    VALUES (
      v_org_id,
      2024,
      4,
      '2024-12-15',
      '14:00',
      'Toplantı Salonu',
      'Genel Sekreter',
      'Genel Sekreter',
      'COMPLETED',
      'İç kontrol sistemi değerlendirildi.'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_meeting_id;

    -- Eğer yeni meeting oluşturulduysa karar ekle
    IF v_meeting_id IS NOT NULL THEN
      -- Örnek kararlar ekle
      INSERT INTO ic_meeting_decisions (
        meeting_id,
        decision_number,
        title,
        description,
        decision_type,
        responsible_department,
        deadline,
        status
      )
      VALUES 
        (
          v_meeting_id,
          '2024/4-3',
          'Etik kuralların güncellenmesi',
          'Kurum etik kurallarının 2025 yılı için güncellenmesi',
          'ACTION',
          'İnsan Kaynakları Müdürlüğü',
          '2025-01-31',
          'IN_PROGRESS'
        ),
        (
          v_meeting_id,
          '2024/4-5',
          'Risk envanterinin gözden geçirilmesi',
          'Kurum risk envanterinin 2025 için gözden geçirilmesi',
          'ACTION',
          'Strateji Geliştirme Başkanlığı',
          '2025-02-15',
          'IN_PROGRESS'
        )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RAISE NOTICE 'Demo data added successfully for organization %', v_org_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding demo data: %', SQLERRM;
END $$;
