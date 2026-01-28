/*
  # Update RLS Policies for Department-Based Access Control

  1. QM Processes RLS Updates
    - Users can only view processes in their department or all processes if admin/director
    - Users can only create processes for their own department
    - Users can only edit DRAFT status processes they created
    - Only admin/director can approve/reject processes
    
  2. Workflow Processes RLS Updates
    - Access is controlled through linked QM process
    - Users can only create workflows for QM processes in their department
    - Workflows inherit visibility from their QM process
*/

-- Step 1: Drop existing QM processes policies
DROP POLICY IF EXISTS "qm_processes_select" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_insert" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_update" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_delete" ON qm_processes;
DROP POLICY IF EXISTS "Presidents can view all qm_processes" ON qm_processes;

-- Step 2: Create new department-based QM processes policies

-- SELECT: Users can view processes in their department, admins/directors can view all in organization
CREATE POLICY "Users can view qm_processes in their department or organization"
ON qm_processes FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    -- Super admin can see all
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Admin/Director/President can see all in their organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = qm_processes.organization_id
      AND role IN ('admin', 'director', 'president')
    )
    OR
    -- Users can see processes in their department
    owner_department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  )
);

-- INSERT: Users can create processes for their own department
CREATE POLICY "Users can create qm_processes for their department"
ON qm_processes FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    -- Super admin can create anywhere
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Admin/Director can create for any department in their organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = qm_processes.organization_id
      AND role IN ('admin', 'director')
    )
    OR
    -- Users can create for their own department
    (
      owner_department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      AND status = 'DRAFT'
    )
  )
);

-- UPDATE: Users can update their own DRAFT processes, admins can update any
CREATE POLICY "Users can update their own DRAFT qm_processes"
ON qm_processes FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    -- Super admin can update all
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Admin can update all in organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = qm_processes.organization_id
      AND role = 'admin'
    )
    OR
    -- Director can update all in organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = qm_processes.organization_id
      AND role = 'director'
    )
    OR
    -- Users can only update their own DRAFT or REJECTED processes
    (
      created_by = auth.uid()
      AND status IN ('DRAFT', 'REJECTED')
    )
  )
)
WITH CHECK (
  -- Same as USING clause
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- DELETE: Only admins can delete processes
CREATE POLICY "Admins can delete qm_processes"
ON qm_processes FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role = 'super_admin'
        OR (organization_id = qm_processes.organization_id AND role IN ('admin', 'director'))
      )
    )
  )
);

-- Step 3: Update workflow processes policies
DROP POLICY IF EXISTS "Users can view workflows in their organization" ON workflow_processes;
DROP POLICY IF EXISTS "Users can create workflows in their organization" ON workflow_processes;
DROP POLICY IF EXISTS "Users can update workflows in their organization" ON workflow_processes;
DROP POLICY IF EXISTS "Admins and directors can delete workflows" ON workflow_processes;

-- SELECT: Users can view workflows if they can view the linked QM process
CREATE POLICY "Users can view workflows based on QM process access"
ON workflow_processes FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    -- Super admin can see all
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Admin/Director/President can see all in their organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = workflow_processes.organization_id
      AND role IN ('admin', 'director', 'president')
    )
    OR
    -- Users can see workflows for QM processes in their department
    qm_process_id IN (
      SELECT qm.id FROM qm_processes qm
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE qm.owner_department_id = p.department_id
    )
  )
);

-- INSERT: Users can create workflows only for APPROVED QM processes in their department
CREATE POLICY "Users can create workflows for approved QM processes"
ON workflow_processes FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    -- Super admin can create anywhere
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Admin/Director can create for any QM process in their organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = workflow_processes.organization_id
      AND role IN ('admin', 'director')
    )
    OR
    -- Users can create for APPROVED QM processes in their department
    qm_process_id IN (
      SELECT qm.id FROM qm_processes qm
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE qm.owner_department_id = p.department_id
      AND qm.status = 'APPROVED'
      AND qm.organization_id = workflow_processes.organization_id
    )
  )
);

-- UPDATE: Users can update workflows they created or admins can update any
CREATE POLICY "Users can update workflows they have access to"
ON workflow_processes FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    -- Super admin can update all
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Admin can update all in organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = workflow_processes.organization_id
      AND role = 'admin'
    )
    OR
    -- Director can update all in organization
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = workflow_processes.organization_id
      AND role = 'director'
    )
    OR
    -- Users can update workflows for QM processes in their department
    (
      created_by = auth.uid()
      AND qm_process_id IN (
        SELECT qm.id FROM qm_processes qm
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE qm.owner_department_id = p.department_id
      )
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- DELETE: Only admins and directors can delete workflows
CREATE POLICY "Admins and directors can delete workflows"
ON workflow_processes FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role = 'super_admin'
        OR (organization_id = workflow_processes.organization_id AND role IN ('admin', 'director'))
      )
    )
  )
);

-- Step 4: Add helper function to check if user can approve QM process
CREATE OR REPLACE FUNCTION can_user_approve_qm_process(
  process_id uuid,
  user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  user_org uuid;
  process_org uuid;
  process_creator uuid;
  process_status text;
BEGIN
  -- Get user info
  SELECT role, organization_id INTO user_role, user_org
  FROM profiles
  WHERE id = user_id;

  -- Get process info
  SELECT organization_id, created_by, status INTO process_org, process_creator, process_status
  FROM qm_processes
  WHERE id = process_id;

  -- Check conditions
  RETURN (
    process_status = 'PENDING_APPROVAL'
    AND user_role IN ('admin', 'director', 'super_admin')
    AND (user_org = process_org OR user_role = 'super_admin')
    AND process_creator != user_id
  );
END;
$$;
