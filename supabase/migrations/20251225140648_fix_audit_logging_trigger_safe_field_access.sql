/*
  # Audit Logging Trigger Hata Düzeltmesi

  1. Sorun
    - Bazı tablolarda name, title, code gibi alanlar yok
    - Record'ları JSON'a çevirirken hata oluşuyor
    
  2. Çözüm
    - Daha defensive field access
    - Try-catch ile güvenli JSON dönüşümü
    - Sadece ID'yi entity_name olarak kullan
*/

-- Improved audit logging trigger function with better error handling
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_name text;
  v_organization_id uuid;
  v_department_id uuid;
  v_action_type text;
  v_entity_name text;
  v_entity_id uuid;
  v_old_value jsonb;
  v_new_value jsonb;
  v_changes_summary text;
  v_severity text;
BEGIN
  -- Get current user info (with error handling)
  BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
      SELECT 
        p.email,
        p.full_name,
        p.organization_id,
        p.department_id
      INTO 
        v_user_email,
        v_user_name,
        v_organization_id,
        v_department_id
      FROM profiles p
      WHERE p.id = v_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue even if profile lookup fails
    NULL;
  END;

  -- Determine action type and safely extract values
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
    v_entity_id := NEW.id;
    v_changes_summary := TG_TABLE_NAME || ' kaydı oluşturuldu';
    v_severity := 'info';
    
    -- Safely convert to JSON
    BEGIN
      v_new_value := to_jsonb(NEW);
    EXCEPTION WHEN OTHERS THEN
      v_new_value := jsonb_build_object('id', NEW.id);
    END;
    
    v_old_value := NULL;
    
    -- Try to get organization_id from new record
    BEGIN
      IF v_organization_id IS NULL THEN
        v_organization_id := (v_new_value->>'organization_id')::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Try to extract a readable name
    BEGIN
      v_entity_name := COALESCE(
        v_new_value->>'name',
        v_new_value->>'title',
        v_new_value->>'code',
        v_new_value->>'full_name',
        v_new_value->>'email',
        NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      v_entity_name := NEW.id::text;
    END;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'update';
    v_entity_id := NEW.id;
    v_changes_summary := TG_TABLE_NAME || ' kaydı güncellendi';
    v_severity := 'info';
    
    -- Safely convert to JSON
    BEGIN
      v_old_value := to_jsonb(OLD);
      v_new_value := to_jsonb(NEW);
    EXCEPTION WHEN OTHERS THEN
      v_old_value := jsonb_build_object('id', OLD.id);
      v_new_value := jsonb_build_object('id', NEW.id);
    END;
    
    -- Try to get organization_id
    BEGIN
      IF v_organization_id IS NULL THEN
        v_organization_id := (v_new_value->>'organization_id')::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Try to extract a readable name
    BEGIN
      v_entity_name := COALESCE(
        v_new_value->>'name',
        v_new_value->>'title',
        v_new_value->>'code',
        v_new_value->>'full_name',
        v_new_value->>'email',
        NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      v_entity_name := NEW.id::text;
    END;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'delete';
    v_entity_id := OLD.id;
    v_changes_summary := TG_TABLE_NAME || ' kaydı silindi';
    v_severity := 'warning';
    
    -- Safely convert to JSON
    BEGIN
      v_old_value := to_jsonb(OLD);
    EXCEPTION WHEN OTHERS THEN
      v_old_value := jsonb_build_object('id', OLD.id);
    END;
    
    v_new_value := NULL;
    
    -- Try to get organization_id
    BEGIN
      IF v_organization_id IS NULL THEN
        v_organization_id := (v_old_value->>'organization_id')::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Try to extract a readable name
    BEGIN
      v_entity_name := COALESCE(
        v_old_value->>'name',
        v_old_value->>'title',
        v_old_value->>'code',
        v_old_value->>'full_name',
        v_old_value->>'email',
        OLD.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      v_entity_name := OLD.id::text;
    END;
  END IF;

  -- Insert audit log (with comprehensive error handling)
  BEGIN
    INSERT INTO system_audit_logs (
      organization_id,
      user_id,
      user_email,
      user_name,
      action_type,
      entity_type,
      entity_id,
      entity_name,
      old_value,
      new_value,
      changes_summary,
      severity,
      status,
      department_id,
      created_at
    ) VALUES (
      v_organization_id,
      v_user_id,
      v_user_email,
      v_user_name,
      v_action_type,
      TG_TABLE_NAME,
      v_entity_id,
      v_entity_name,
      v_old_value,
      v_new_value,
      v_changes_summary,
      v_severity,
      'success',
      v_department_id,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the main transaction
    RAISE WARNING 'Failed to log audit for table %: %', TG_TABLE_NAME, SQLERRM;
  END;

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment explaining the fix
COMMENT ON FUNCTION log_table_changes() IS 
'Audit logging trigger with improved error handling. Safely handles tables with different column structures.';
