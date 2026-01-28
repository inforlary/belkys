/*
  # Update check_process_has_workflow Function

  1. Changes
    - Update function to check qm_process_id directly
    - More reliable than checking code/name
  
  2. Purpose
    - Use the new qm_process_id foreign key for accurate workflow detection
*/

CREATE OR REPLACE FUNCTION public.check_process_has_workflow(process_id uuid, org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_workflow boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM workflow_processes
    WHERE organization_id = org_id
    AND qm_process_id = process_id
  ) INTO has_workflow;

  RETURN has_workflow;
END;
$$;