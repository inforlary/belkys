/*
  # Otomatik Aktivite Loglama Trigger'ları

  1. Genel Trigger Fonksiyonu
    - Tüm tablolar için kullanılabilecek generic trigger fonksiyonu
    - INSERT, UPDATE, DELETE işlemlerini otomatik loglar
    
  2. Kritik Tablolar İçin Trigger'lar
    - departments: Müdürlük yönetimi
    - users/profiles: Kullanıcı yönetimi  
    - goals: Hedef yönetimi
    - objectives: Amaç yönetimi
    - indicators: Gösterge yönetimi
    - activities: Faaliyet yönetimi
    - budget_entries: Bütçe girişleri
    - data_entries: Veri girişleri
    - approvals: Onay işlemleri
    
  3. Özellikler
    - Her CRUD operasyonu otomatik loglanır
    - Eski ve yeni değerler JSON olarak saklanır
    - Kullanıcı ve organizasyon bilgisi otomatik eklenir
    - Departman bilgisi varsa eklenir
*/

-- Generic audit logging trigger function
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
  v_old_value jsonb;
  v_new_value jsonb;
  v_changes_summary text;
  v_severity text;
  v_profile record;
BEGIN
  -- Get current user info
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

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
    v_new_value := to_jsonb(NEW);
    v_old_value := NULL;
    v_entity_name := COALESCE(
      NEW.name::text,
      NEW.title::text,
      NEW.code::text,
      NEW.id::text
    );
    v_changes_summary := TG_TABLE_NAME || ' kaydı oluşturuldu';
    v_severity := 'info';
    
    -- Get organization_id from new record if not from profile
    IF v_organization_id IS NULL AND NEW.organization_id IS NOT NULL THEN
      v_organization_id := NEW.organization_id;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'update';
    v_old_value := to_jsonb(OLD);
    v_new_value := to_jsonb(NEW);
    v_entity_name := COALESCE(
      NEW.name::text,
      NEW.title::text,
      NEW.code::text,
      NEW.id::text
    );
    v_changes_summary := TG_TABLE_NAME || ' kaydı güncellendi';
    v_severity := 'info';
    
    IF v_organization_id IS NULL AND NEW.organization_id IS NOT NULL THEN
      v_organization_id := NEW.organization_id;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'delete';
    v_old_value := to_jsonb(OLD);
    v_new_value := NULL;
    v_entity_name := COALESCE(
      OLD.name::text,
      OLD.title::text,
      OLD.code::text,
      OLD.id::text
    );
    v_changes_summary := TG_TABLE_NAME || ' kaydı silindi';
    v_severity := 'warning';
    
    IF v_organization_id IS NULL AND OLD.organization_id IS NOT NULL THEN
      v_organization_id := OLD.organization_id;
    END IF;
  END IF;

  -- Insert audit log (ignore errors to prevent transaction rollback)
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
      COALESCE(NEW.id, OLD.id),
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
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to log audit: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for critical tables

-- Departments
DROP TRIGGER IF EXISTS departments_audit_trigger ON departments;
CREATE TRIGGER departments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON departments
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Profiles (user management)
DROP TRIGGER IF EXISTS profiles_audit_trigger ON profiles;
CREATE TRIGGER profiles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Goals
DROP TRIGGER IF EXISTS goals_audit_trigger ON goals;
CREATE TRIGGER goals_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON goals
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Objectives
DROP TRIGGER IF EXISTS objectives_audit_trigger ON objectives;
CREATE TRIGGER objectives_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON objectives
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Indicators
DROP TRIGGER IF EXISTS indicators_audit_trigger ON indicators;
CREATE TRIGGER indicators_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON indicators
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Activities
DROP TRIGGER IF EXISTS activities_audit_trigger ON activities;
CREATE TRIGGER activities_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Indicator Data Entries
DROP TRIGGER IF EXISTS indicator_data_entries_audit_trigger ON indicator_data_entries;
CREATE TRIGGER indicator_data_entries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON indicator_data_entries
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Expense Budget Entries
DROP TRIGGER IF EXISTS expense_budget_entries_audit_trigger ON expense_budget_entries;
CREATE TRIGGER expense_budget_entries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON expense_budget_entries
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Revenue Budget Entries
DROP TRIGGER IF EXISTS revenue_budget_entries_audit_trigger ON revenue_budget_entries;
CREATE TRIGGER revenue_budget_entries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON revenue_budget_entries
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Programs
DROP TRIGGER IF EXISTS programs_audit_trigger ON programs;
CREATE TRIGGER programs_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON programs
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Sub Programs  
DROP TRIGGER IF EXISTS sub_programs_audit_trigger ON sub_programs;
CREATE TRIGGER sub_programs_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON sub_programs
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Program Activity Indicator Mappings
DROP TRIGGER IF EXISTS program_activity_indicator_mappings_audit_trigger ON program_activity_indicator_mappings;
CREATE TRIGGER program_activity_indicator_mappings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON program_activity_indicator_mappings
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Strategic Plans
DROP TRIGGER IF EXISTS strategic_plans_audit_trigger ON strategic_plans;
CREATE TRIGGER strategic_plans_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON strategic_plans
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Activity Reports
DROP TRIGGER IF EXISTS activity_reports_audit_trigger ON activity_reports;
CREATE TRIGGER activity_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON activity_reports
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Collaborations
DROP TRIGGER IF EXISTS collaborations_audit_trigger ON collaborations;
CREATE TRIGGER collaborations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON collaborations
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- IC Plans (Internal Control Plans)
DROP TRIGGER IF EXISTS ic_plans_audit_trigger ON ic_plans;
CREATE TRIGGER ic_plans_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ic_plans
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- IC Risks
DROP TRIGGER IF EXISTS ic_risks_audit_trigger ON ic_risks;
CREATE TRIGGER ic_risks_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ic_risks
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- IC Controls
DROP TRIGGER IF EXISTS ic_controls_audit_trigger ON ic_controls;
CREATE TRIGGER ic_controls_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ic_controls
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Organizations (for super admin)
DROP TRIGGER IF EXISTS organizations_audit_trigger ON organizations;
CREATE TRIGGER organizations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();
