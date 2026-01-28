/*
  # Fix trigger_update_action_on_workflow_change for workflow_processes

  1. Changes
    - Update trigger function to handle workflow_processes without department_id
    - workflow_processes does not have department_id field, so we use NULL for it
  
  2. Notes
    - This fixes the "record 'new' has no field 'department_id'" error when deleting workflows
*/

CREATE OR REPLACE FUNCTION trigger_update_action_on_workflow_change()
RETURNS TRIGGER AS $$
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
    -- workflow_processes does not have department_id field
    v_dept_id := NULL;
    
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
    AND (v_dept_id IS NULL OR responsible_department_id = v_dept_id OR responsible_department_id IS NULL);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
