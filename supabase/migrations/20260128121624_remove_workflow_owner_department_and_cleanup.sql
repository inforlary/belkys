/*
  # Remove owner_department_id from workflow_processes

  1. Data Verification
    - Verify all workflows have qm_process_id
    - Report any inconsistencies
    
  2. Remove Column
    - Drop owner_department_id from workflow_processes
    
  3. Set Default Status
    - Update all existing qm_processes to APPROVED (since they're already in use)
    - This prevents breaking existing workflows
*/

-- Step 1: Verify data integrity
DO $$
DECLARE
  workflows_without_qm_process INT;
  qm_processes_without_department INT;
BEGIN
  -- Check workflows without qm_process_id (should be 0 after previous migration)
  SELECT COUNT(*) INTO workflows_without_qm_process
  FROM workflow_processes
  WHERE qm_process_id IS NULL;
  
  IF workflows_without_qm_process > 0 THEN
    RAISE NOTICE 'Warning: % workflows found without qm_process_id', workflows_without_qm_process;
  END IF;

  -- Check qm_processes without department
  SELECT COUNT(*) INTO qm_processes_without_department
  FROM qm_processes
  WHERE owner_department_id IS NULL;
  
  IF qm_processes_without_department > 0 THEN
    RAISE NOTICE 'Warning: % QM processes found without owner_department_id', qm_processes_without_department;
  END IF;

  RAISE NOTICE 'Data integrity check completed';
END $$;

-- Step 2: Update existing QM processes to APPROVED status
-- This ensures existing processes don't break the system
UPDATE qm_processes
SET status = 'APPROVED',
    approved_at = created_at,
    approved_by = created_by
WHERE status IN ('ACTIVE', 'INACTIVE')
   OR status IS NULL;

-- Set any NULL status to DRAFT
UPDATE qm_processes
SET status = 'DRAFT'
WHERE status IS NULL;

-- Step 3: Remove owner_department_id from workflow_processes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_processes' AND column_name = 'owner_department_id'
  ) THEN
    ALTER TABLE workflow_processes DROP COLUMN owner_department_id;
    RAISE NOTICE 'owner_department_id column removed from workflow_processes';
  ELSE
    RAISE NOTICE 'owner_department_id column does not exist in workflow_processes';
  END IF;
END $$;

-- Step 4: Create notification trigger for QM process status changes
CREATE OR REPLACE FUNCTION notify_qm_process_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When process is approved
  IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING_APPROVAL' THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id,
      reference_type,
      organization_id
    ) VALUES (
      NEW.created_by,
      'QM Süreci Onaylandı',
      'QM süreci "' || NEW.name || '" onaylandı.',
      'success',
      NEW.id,
      'qm_process',
      NEW.organization_id
    );
  END IF;

  -- When process is rejected
  IF NEW.status = 'REJECTED' AND OLD.status = 'PENDING_APPROVAL' THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id,
      reference_type,
      organization_id
    ) VALUES (
      NEW.created_by,
      'QM Süreci Reddedildi',
      'QM süreci "' || NEW.name || '" reddedildi. Sebep: ' || COALESCE(NEW.rejection_reason, 'Belirtilmedi'),
      'error',
      NEW.id,
      'qm_process',
      NEW.organization_id
    );
  END IF;

  -- When process is submitted for approval
  IF NEW.status = 'PENDING_APPROVAL' AND OLD.status IN ('DRAFT', 'REJECTED') THEN
    -- Notify admins and directors
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id,
      reference_type,
      organization_id
    )
    SELECT 
      p.id,
      'Yeni QM Süreci Onay Bekliyor',
      'QM süreci "' || NEW.name || '" onay bekliyor.',
      'info',
      NEW.id,
      'qm_process',
      NEW.organization_id
    FROM profiles p
    WHERE p.organization_id = NEW.organization_id
    AND p.role IN ('admin', 'director')
    AND p.id != NEW.created_by;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS qm_process_status_change_trigger ON qm_processes;
CREATE TRIGGER qm_process_status_change_trigger
AFTER UPDATE OF status ON qm_processes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_qm_process_status_change();

-- Step 5: Create function to get pending approvals count
CREATE OR REPLACE FUNCTION get_pending_qm_approvals_count(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  user_org uuid;
  approval_count integer;
BEGIN
  -- Get user info
  SELECT role, organization_id INTO user_role, user_org
  FROM profiles
  WHERE id = user_id;

  -- Only admins and directors can approve
  IF user_role NOT IN ('admin', 'director', 'super_admin') THEN
    RETURN 0;
  END IF;

  -- Count pending approvals
  SELECT COUNT(*)::integer INTO approval_count
  FROM qm_processes
  WHERE status = 'PENDING_APPROVAL'
  AND organization_id = user_org
  AND created_by != user_id;

  RETURN approval_count;
END;
$$;

-- Step 6: Add comment to clarify new structure
COMMENT ON TABLE qm_processes IS 'Quality Management processes with approval workflow. Each process belongs to a department and requires manager approval.';
COMMENT ON TABLE workflow_processes IS 'Workflow diagrams linked to QM processes. Department ownership is inherited from the linked QM process.';
COMMENT ON COLUMN qm_processes.status IS 'Process status: DRAFT (editable), PENDING_APPROVAL (waiting for manager), APPROVED (can create workflows), REJECTED (needs revision)';
COMMENT ON COLUMN workflow_processes.qm_process_id IS 'Required link to QM process. Workflows inherit department ownership from their QM process.';
