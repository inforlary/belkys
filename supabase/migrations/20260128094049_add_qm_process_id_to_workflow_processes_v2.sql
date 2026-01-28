/*
  # Add QM Process Link to Workflow Processes

  1. Changes
    - Add qm_process_id column to workflow_processes table
    - Add foreign key constraint to qm_processes
    - Add index for better query performance
  
  2. Purpose
    - Link workflow processes to quality management processes
    - Allow workflows to be created directly from QM processes
*/

-- Add qm_process_id column
ALTER TABLE workflow_processes 
ADD COLUMN IF NOT EXISTS qm_process_id uuid REFERENCES qm_processes(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_processes_qm_process_id 
ON workflow_processes(qm_process_id);