/*
  # BAĞLANTILI MODÜLLER İÇİN OTOMATİK HESAPLAMA TRİGGERLARI

  ## Açıklama
  Bu migration, bağlantılı modüllerdeki (Süreç Yönetimi, İş Akış, Risk vb.) 
  değişiklikleri takip edip ic_actions tablosundaki current_quantity değerini
  otomatik olarak güncelleyen trigger'ları ekler.

  ## Güncellenen Modüller
  - qm_processes (Süreç Yönetimi)
  - workflow_processes (İş Akış Şemaları)
  - risks (Risk Yönetimi)
  - sensitive_tasks (Hassas Görevler)
  - document_library (Doküman Yönetimi)

  ## İşleyiş
  Her modülde kayıt eklenince/silinince, ilgili ic_actions kayıtlarının
  current_quantity değeri otomatik güncellenir ve ilerleme yüzdesi hesaplanır.
*/

-- Bağlantılı eylem miktarlarını güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_linked_action_quantities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_module_name VARCHAR;
  v_org_id UUID;
  v_dept_id UUID;
BEGIN
  -- Tetikleyen tablo adına göre modül adını belirle
  IF TG_TABLE_NAME = 'qm_processes' THEN
    v_module_name := 'surec_yonetimi';
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    
  ELSIF TG_TABLE_NAME = 'workflow_processes' THEN
    v_module_name := 'is_akis_semalari';
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    
  ELSIF TG_TABLE_NAME = 'risks' THEN
    v_module_name := 'risk_yonetimi';
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    
  ELSIF TG_TABLE_NAME = 'sensitive_tasks' THEN
    v_module_name := 'hassas_gorevler';
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    
  ELSIF TG_TABLE_NAME = 'document_library' THEN
    v_module_name := 'dokuman_yonetimi';
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Bu modülle bağlantılı tüm eylemlerin miktarlarını güncelle
  UPDATE ic_actions
  SET 
    current_quantity = calculate_linked_module_quantity(
      ic_actions.organization_id,
      ic_actions.linked_module,
      ic_actions.responsible_department_id
    ),
    progress_percent = CASE 
      WHEN target_quantity > 0 THEN 
        LEAST(100, (calculate_linked_module_quantity(
          ic_actions.organization_id,
          ic_actions.linked_module,
          ic_actions.responsible_department_id
        )::decimal / target_quantity::decimal * 100)::integer)
      ELSE progress_percent
    END,
    updated_at = now()
  WHERE linked_module = v_module_name
  AND organization_id = v_org_id
  AND action_type = 'baglantili'
  AND (responsible_department_id = v_dept_id OR responsible_department_id IS NULL);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Süreç Yönetimi trigger'ları
DROP TRIGGER IF EXISTS trigger_update_action_on_process_change ON qm_processes;
CREATE TRIGGER trigger_update_action_on_process_change
  AFTER INSERT OR DELETE ON qm_processes
  FOR EACH ROW
  EXECUTE FUNCTION update_linked_action_quantities();

-- İş Akış Şemaları trigger'ları
DROP TRIGGER IF EXISTS trigger_update_action_on_workflow_change ON workflow_processes;
CREATE TRIGGER trigger_update_action_on_workflow_change
  AFTER INSERT OR DELETE ON workflow_processes
  FOR EACH ROW
  EXECUTE FUNCTION update_linked_action_quantities();

-- Risk Yönetimi trigger'ları
DROP TRIGGER IF EXISTS trigger_update_action_on_risk_change ON risks;
CREATE TRIGGER trigger_update_action_on_risk_change
  AFTER INSERT OR DELETE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION update_linked_action_quantities();

-- Hassas Görevler trigger'ları (eğer tablo varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sensitive_tasks') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_action_on_sensitive_task_change ON sensitive_tasks';
    EXECUTE 'CREATE TRIGGER trigger_update_action_on_sensitive_task_change
      AFTER INSERT OR DELETE ON sensitive_tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_linked_action_quantities()';
  END IF;
END $$;

-- Doküman Yönetimi trigger'ları (eğer tablo varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_library') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_action_on_document_change ON document_library';
    EXECUTE 'CREATE TRIGGER trigger_update_action_on_document_change
      AFTER INSERT OR DELETE ON document_library
      FOR EACH ROW
      EXECUTE FUNCTION update_linked_action_quantities()';
  END IF;
END $$;

-- Manuel olarak tüm bağlantılı eylemleri güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION refresh_all_linked_action_quantities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  UPDATE ic_actions
  SET 
    current_quantity = calculate_linked_module_quantity(
      organization_id,
      linked_module,
      responsible_department_id
    ),
    progress_percent = CASE 
      WHEN target_quantity > 0 THEN 
        LEAST(100, (calculate_linked_module_quantity(
          organization_id,
          linked_module,
          responsible_department_id
        )::decimal / target_quantity::decimal * 100)::integer)
      ELSE progress_percent
    END,
    updated_at = now()
  WHERE action_type = 'baglantili'
  AND linked_module IS NOT NULL
  AND target_quantity IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;

-- İlerleme yüzdesi hesaplama view'i
CREATE OR REPLACE VIEW ic_action_progress_summary AS
SELECT 
  a.id,
  a.code,
  a.title,
  a.action_type,
  a.linked_module,
  a.target_quantity,
  a.current_quantity,
  a.target_date,
  a.status,
  a.approval_status,
  a.progress_percent,
  CASE 
    WHEN a.action_type = 'tek_seferlik' THEN
      CASE 
        WHEN a.status = 'COMPLETED' THEN 100
        WHEN a.status = 'IN_PROGRESS' THEN a.progress_percent
        ELSE 0
      END
    WHEN a.action_type = 'surekli' THEN
      CASE 
        WHEN a.compliance_level = 'uygun' THEN 100
        WHEN a.compliance_level = 'kismen_uygun' THEN 50
        WHEN a.compliance_level = 'uygun_degil' THEN 0
        ELSE 0
      END
    WHEN a.action_type = 'baglantili' THEN
      CASE 
        WHEN a.target_quantity > 0 THEN 
          LEAST(100, (a.current_quantity::decimal / a.target_quantity::decimal * 100)::integer)
        ELSE 0
      END
    WHEN a.action_type = 'donemsel' THEN a.progress_percent
    ELSE a.progress_percent
  END as calculated_progress,
  CASE 
    WHEN a.target_date < CURRENT_DATE AND a.status NOT IN ('COMPLETED', 'CANCELLED') THEN true
    ELSE false
  END as is_overdue,
  CASE 
    WHEN a.target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' 
         AND a.status NOT IN ('COMPLETED', 'CANCELLED') THEN true
    ELSE false
  END as is_due_soon,
  d.name as department_name,
  ms.code as main_standard_code,
  ms.title as main_standard_title
FROM ic_actions a
LEFT JOIN departments d ON a.responsible_department_id = d.id
LEFT JOIN ic_kiks_main_standards ms ON a.main_standard_id = ms.id;

COMMENT ON FUNCTION update_linked_action_quantities IS 'Bağlantılı modül değişikliklerinde eylem miktarlarını günceller';
COMMENT ON FUNCTION refresh_all_linked_action_quantities IS 'Tüm bağlantılı eylemlerin miktarlarını manuel olarak yeniler';
COMMENT ON VIEW ic_action_progress_summary IS 'Eylem ilerleme özeti - hesaplanmış değerlerle';
