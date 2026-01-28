/*
  # Add Approval System to QM Processes

  1. Changes to qm_processes table
    - Add approval workflow fields:
      - `status` - Process status (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED)
      - `submitted_at` - When process was submitted for approval
      - `approved_by` - Manager who approved/rejected the process
      - `approved_at` - When process was approved
      - `rejection_reason` - Reason for rejection if applicable
    
  2. Changes to workflow_processes table
    - Make qm_process_id NOT NULL (workflows must be linked to QM process)
    - Standardize status values to match QM processes
    
  3. Security
    - Add constraints for status transitions
    - Add check to prevent self-approval
    
  4. Data Migration
    - Set existing qm_processes to APPROVED status
    - Ensure workflow_processes have valid qm_process_id
*/

-- Step 1: Add approval fields to qm_processes
DO $$
BEGIN
  -- Update status column to use specific values if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qm_processes' AND column_name = 'status'
  ) THEN
    -- Drop existing constraint if any
    ALTER TABLE qm_processes DROP CONSTRAINT IF EXISTS qm_processes_status_check;
    
    -- Add new constraint with approval statuses
    ALTER TABLE qm_processes ADD CONSTRAINT qm_processes_status_check 
      CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'));
    
    -- Update existing ACTIVE statuses to APPROVED
    UPDATE qm_processes SET status = 'APPROVED' WHERE status = 'ACTIVE';
    UPDATE qm_processes SET status = 'DRAFT' WHERE status = 'INACTIVE';
  END IF;

  -- Add submitted_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qm_processes' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE qm_processes ADD COLUMN submitted_at timestamptz;
  END IF;

  -- Add approved_by if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qm_processes' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE qm_processes ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;

  -- Add approved_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qm_processes' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE qm_processes ADD COLUMN approved_at timestamptz;
  END IF;

  -- Add rejection_reason if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qm_processes' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE qm_processes ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Step 2: Create function to handle qm_process approval
CREATE OR REPLACE FUNCTION approve_qm_process(
  process_id uuid,
  approver_id uuid,
  approve boolean,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  process_creator uuid;
  approver_role text;
  process_status text;
BEGIN
  -- Get process creator and current status
  SELECT created_by, status INTO process_creator, process_status
  FROM qm_processes
  WHERE id = process_id;

  -- Get approver role
  SELECT role INTO approver_role
  FROM profiles
  WHERE id = approver_id;

  -- Validations
  IF process_status != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Process must be in PENDING_APPROVAL status';
  END IF;

  IF approver_role NOT IN ('admin', 'director', 'super_admin') THEN
    RAISE EXCEPTION 'Only admin or director can approve processes';
  END IF;

  IF process_creator = approver_id THEN
    RAISE EXCEPTION 'Cannot approve your own process';
  END IF;

  -- Update process
  IF approve THEN
    UPDATE qm_processes
    SET 
      status = 'APPROVED',
      approved_by = approver_id,
      approved_at = now(),
      rejection_reason = NULL
    WHERE id = process_id;
  ELSE
    UPDATE qm_processes
    SET 
      status = 'REJECTED',
      approved_by = approver_id,
      approved_at = now(),
      rejection_reason = reason
    WHERE id = process_id;
  END IF;
END;
$$;

-- Step 3: Create function to submit qm_process for approval
CREATE OR REPLACE FUNCTION submit_qm_process_for_approval(
  process_id uuid,
  submitter_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  process_creator uuid;
  process_status text;
BEGIN
  -- Get process creator and status
  SELECT created_by, status INTO process_creator, process_status
  FROM qm_processes
  WHERE id = process_id;

  -- Validations
  IF process_status NOT IN ('DRAFT', 'REJECTED') THEN
    RAISE EXCEPTION 'Only DRAFT or REJECTED processes can be submitted for approval';
  END IF;

  IF process_creator != submitter_id THEN
    RAISE EXCEPTION 'Only the process creator can submit for approval';
  END IF;

  -- Update process
  UPDATE qm_processes
  SET 
    status = 'PENDING_APPROVAL',
    submitted_at = now(),
    rejection_reason = NULL
  WHERE id = process_id;
END;
$$;

-- Step 4: Create function to revert rejected process to draft
CREATE OR REPLACE FUNCTION revert_qm_process_to_draft(
  process_id uuid,
  user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  process_creator uuid;
  process_status text;
BEGIN
  -- Get process creator and status
  SELECT created_by, status INTO process_creator, process_status
  FROM qm_processes
  WHERE id = process_id;

  -- Validations
  IF process_status != 'REJECTED' THEN
    RAISE EXCEPTION 'Only REJECTED processes can be reverted to DRAFT';
  END IF;

  IF process_creator != user_id THEN
    RAISE EXCEPTION 'Only the process creator can revert to draft';
  END IF;

  -- Update process
  UPDATE qm_processes
  SET 
    status = 'DRAFT',
    rejection_reason = NULL,
    approved_by = NULL,
    approved_at = NULL
  WHERE id = process_id;
END;
$$;

-- Step 5: Update workflow_processes table structure
DO $$
BEGIN
  -- Make qm_process_id NOT NULL for workflow_processes
  -- First, handle any workflows without qm_process_id
  DELETE FROM workflow_processes WHERE qm_process_id IS NULL;
  
  -- Now make it NOT NULL
  ALTER TABLE workflow_processes ALTER COLUMN qm_process_id SET NOT NULL;

  -- Add foreign key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'workflow_processes_qm_process_id_fkey'
  ) THEN
    ALTER TABLE workflow_processes 
    ADD CONSTRAINT workflow_processes_qm_process_id_fkey 
    FOREIGN KEY (qm_process_id) REFERENCES qm_processes(id) ON DELETE CASCADE;
  END IF;

  -- Update workflow_processes status constraint
  ALTER TABLE workflow_processes DROP CONSTRAINT IF EXISTS workflow_processes_status_check;
  ALTER TABLE workflow_processes ADD CONSTRAINT workflow_processes_status_check 
    CHECK (status IN ('draft', 'DRAFT', 'pending_approval', 'PENDING_APPROVAL', 'approved', 'APPROVED', 'rejected', 'REJECTED'));

  -- Standardize existing workflow statuses
  UPDATE workflow_processes SET status = 'DRAFT' WHERE status IN ('draft', 'DRAFT');
  UPDATE workflow_processes SET status = 'APPROVED' WHERE status IN ('approved', 'APPROVED', 'active', 'ACTIVE');
  UPDATE workflow_processes SET status = 'PENDING_APPROVAL' WHERE status IN ('pending_approval', 'PENDING_APPROVAL', 'pending', 'PENDING');
  UPDATE workflow_processes SET status = 'REJECTED' WHERE status IN ('rejected', 'REJECTED', 'inactive', 'INACTIVE');
END $$;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qm_processes_status ON qm_processes(status);
CREATE INDEX IF NOT EXISTS idx_qm_processes_owner_department ON qm_processes(owner_department_id);
CREATE INDEX IF NOT EXISTS idx_qm_processes_approved_by ON qm_processes(approved_by);
CREATE INDEX IF NOT EXISTS idx_workflow_processes_qm_process ON workflow_processes(qm_process_id);

-- Step 7: Add helpful views
CREATE OR REPLACE VIEW qm_processes_with_department AS
SELECT 
  qm.*,
  d.name as department_name,
  d.code as department_code,
  p.full_name as creator_name,
  ap.full_name as approver_name
FROM qm_processes qm
LEFT JOIN departments d ON d.id = qm.owner_department_id
LEFT JOIN profiles p ON p.id = qm.created_by
LEFT JOIN profiles ap ON ap.id = qm.approved_by;

CREATE OR REPLACE VIEW workflow_processes_with_details AS
SELECT 
  wp.id,
  wp.organization_id,
  wp.code,
  wp.name,
  wp.description,
  wp.status,
  wp.trigger_event,
  wp.outputs,
  wp.software_used,
  wp.legal_basis,
  wp.version,
  wp.created_by,
  wp.created_at,
  wp.updated_at,
  wp.approved_by,
  wp.approved_at,
  wp.rejection_reason,
  wp.reviewed_by,
  wp.reviewed_at,
  wp.qm_process_id,
  qm.name as qm_process_name,
  qm.code as qm_process_code,
  qm.owner_department_id,
  d.name as department_name,
  d.code as department_code
FROM workflow_processes wp
LEFT JOIN qm_processes qm ON qm.id = wp.qm_process_id
LEFT JOIN departments d ON d.id = qm.owner_department_id;

-- Grant access to views
GRANT SELECT ON qm_processes_with_department TO authenticated;
GRANT SELECT ON workflow_processes_with_details TO authenticated;
