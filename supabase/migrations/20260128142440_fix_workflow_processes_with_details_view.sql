/*
  # Fix workflow_processes_with_details View
  
  1. Changes
    - Remove wp.owner_department_id reference (column doesn't exist)
    - qm.owner_department_id is already selected from qm_processes
    
  2. Security
    - View is read-only, RLS still applies to underlying tables
*/

-- Drop and recreate the view with correct column references
DROP VIEW IF EXISTS workflow_processes_with_details CASCADE;

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
  wp.final_approved_by,
  wp.final_approved_at,
  wp.qm_process_id,
  qm.name AS qm_process_name,
  qm.code AS qm_process_code,
  qm.owner_department_id,
  d.name AS department_name,
  d.code AS department_code
FROM workflow_processes wp
LEFT JOIN qm_processes qm ON qm.id = wp.qm_process_id
LEFT JOIN departments d ON d.id = qm.owner_department_id;

COMMENT ON VIEW workflow_processes_with_details IS 'Workflow processes with related QM process and department information';