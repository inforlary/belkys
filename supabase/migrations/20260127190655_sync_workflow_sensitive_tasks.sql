/*
  # İş Akışı - Hassas Görevler Entegrasyonu

  Bu migration, iş akış şemalarındaki hassas adımları otomatik olarak
  hassas görevler yönetim sistemine aktarır.

  ## 1. Fonksiyonlar
  - `sync_sensitive_tasks_from_workflow()` - İş akışı onaylandığında hassas adımları senkronize eder
  - `remove_sensitive_tasks_from_workflow()` - İş akışı silindiğinde ilgili hassas görevleri temizler

  ## 2. Triggers
  - İş akışı status='approved' olduğunda hassas görevleri oluştur
  - İş akışı silindiğinde ilgili hassas görevleri sil

  ## 3. Unique Constraint
  - Aynı workflow_step için tekrar kayıt oluşturulmasını engelle
*/

-- Add unique constraint to prevent duplicate sensitive tasks from same workflow step
ALTER TABLE sensitive_tasks DROP CONSTRAINT IF EXISTS unique_workflow_step_task;
ALTER TABLE sensitive_tasks 
  ADD CONSTRAINT unique_workflow_step_task 
  UNIQUE (workflow_step_id);

-- Function to sync sensitive tasks from workflow when it's approved
CREATE OR REPLACE FUNCTION sync_sensitive_tasks_from_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_step RECORD;
  v_task_id uuid;
BEGIN
  -- Only process when workflow is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Loop through all sensitive steps in this workflow
    FOR v_step IN 
      SELECT 
        ws.id as step_id,
        ws.description,
        ws.actor_id,
        wp.organization_id,
        wp.id as workflow_id,
        wp.name as workflow_name,
        wp.owner_department_id
      FROM workflow_steps ws
      JOIN workflow_processes wp ON wp.id = ws.workflow_id
      WHERE ws.workflow_id = NEW.id
        AND ws.is_sensitive = true
    LOOP
      
      -- Check if sensitive task already exists for this step
      SELECT id INTO v_task_id
      FROM sensitive_tasks
      WHERE workflow_step_id = v_step.step_id;
      
      -- If not exists, create it
      IF v_task_id IS NULL THEN
        INSERT INTO sensitive_tasks (
          organization_id,
          workflow_id,
          workflow_step_id,
          task_name,
          process_name,
          department_id,
          rotation_period,
          status
        ) VALUES (
          v_step.organization_id,
          v_step.workflow_id,
          v_step.step_id,
          v_step.description,
          v_step.workflow_name,
          v_step.owner_department_id,
          'annual', -- Default rotation period
          'awaiting_assignment'
        );
        
        RAISE NOTICE 'Created sensitive task for workflow step: %', v_step.description;
      END IF;
      
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to remove sensitive tasks when workflow is deleted
CREATE OR REPLACE FUNCTION remove_sensitive_tasks_from_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all sensitive tasks associated with this workflow
  DELETE FROM sensitive_tasks
  WHERE workflow_id = OLD.id;
  
  RAISE NOTICE 'Removed sensitive tasks for deleted workflow: %', OLD.name;
  
  RETURN OLD;
END;
$$;

-- Trigger: Sync sensitive tasks when workflow is approved
DROP TRIGGER IF EXISTS trigger_sync_sensitive_tasks ON workflow_processes;
CREATE TRIGGER trigger_sync_sensitive_tasks
  AFTER INSERT OR UPDATE OF status ON workflow_processes
  FOR EACH ROW
  EXECUTE FUNCTION sync_sensitive_tasks_from_workflow();

-- Trigger: Remove sensitive tasks when workflow is deleted
DROP TRIGGER IF EXISTS trigger_remove_sensitive_tasks ON workflow_processes;
CREATE TRIGGER trigger_remove_sensitive_tasks
  BEFORE DELETE ON workflow_processes
  FOR EACH ROW
  EXECUTE FUNCTION remove_sensitive_tasks_from_workflow();

-- Migrate existing approved workflows
DO $$
DECLARE
  v_workflow RECORD;
  v_step RECORD;
  v_task_id uuid;
  v_created_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting migration of existing approved workflows...';
  
  -- Loop through all approved workflows
  FOR v_workflow IN 
    SELECT id, organization_id, name, owner_department_id
    FROM workflow_processes
    WHERE status = 'approved'
  LOOP
    
    -- Loop through sensitive steps in this workflow
    FOR v_step IN 
      SELECT id, description
      FROM workflow_steps
      WHERE workflow_id = v_workflow.id
        AND is_sensitive = true
    LOOP
      
      -- Check if sensitive task already exists
      SELECT id INTO v_task_id
      FROM sensitive_tasks
      WHERE workflow_step_id = v_step.id;
      
      -- Create if not exists
      IF v_task_id IS NULL THEN
        INSERT INTO sensitive_tasks (
          organization_id,
          workflow_id,
          workflow_step_id,
          task_name,
          process_name,
          department_id,
          rotation_period,
          status
        ) VALUES (
          v_workflow.organization_id,
          v_workflow.id,
          v_step.id,
          v_step.description,
          v_workflow.name,
          v_workflow.owner_department_id,
          'annual',
          'awaiting_assignment'
        );
        
        v_created_count := v_created_count + 1;
      END IF;
      
    END LOOP;
    
  END LOOP;
  
  RAISE NOTICE 'Migration completed. Created % sensitive tasks from existing workflows.', v_created_count;
END;
$$;
