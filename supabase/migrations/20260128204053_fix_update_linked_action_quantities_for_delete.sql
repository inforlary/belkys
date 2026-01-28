/*
  # Fix update_linked_action_quantities for DELETE operations

  1. Changes
    - Update function to properly handle DELETE operations (where NEW is NULL)
    - Use TG_OP to distinguish between INSERT/UPDATE and DELETE operations
    - Fix workflow_processes handling (it has no department_id field)
  
  2. Notes
    - This fixes the "record 'new' has no field 'department_id'" error when deleting workflows
*/

CREATE OR REPLACE FUNCTION update_linked_action_quantities()
RETURNS TRIGGER AS $$
DECLARE
  v_module_name VARCHAR;
  v_org_id UUID;
  v_dept_id UUID;
BEGIN
  -- Tetikleyen tablo adına göre modül adını belirle
  IF TG_TABLE_NAME = 'qm_processes' THEN
    v_module_name := 'surec_yonetimi';
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
      v_dept_id := OLD.department_id;
    ELSE
      v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
      v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'workflow_processes' THEN
    v_module_name := 'is_akis_semalari';
    -- workflow_processes does not have department_id field
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
    ELSE
      v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    END IF;
    v_dept_id := NULL;
    
  ELSIF TG_TABLE_NAME = 'risks' THEN
    v_module_name := 'risk_yonetimi';
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
      v_dept_id := OLD.department_id;
    ELSE
      v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
      v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'sensitive_tasks' THEN
    v_module_name := 'hassas_gorevler';
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
      v_dept_id := OLD.department_id;
    ELSE
      v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
      v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'document_library' THEN
    v_module_name := 'dokuman_yonetimi';
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
      v_dept_id := OLD.department_id;
    ELSE
      v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
      v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
    END IF;
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
