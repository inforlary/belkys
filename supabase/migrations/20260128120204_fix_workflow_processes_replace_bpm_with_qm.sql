/*
  # Fix Workflow Processes - Replace BPM with QM Process Reference

  ## Overview
  After removing the standalone BPM module, workflow_processes table needs to reference
  the Quality Management (qm_processes) table instead of the removed bpm_processes table.

  ## Changes
  1. Drop foreign key constraint to bpm_processes
  2. Drop bpm_process_id column
  3. Add qm_process_id column with foreign key to qm_processes
  4. Create index for performance

  ## Note
  This ensures workflow processes can be properly linked to Quality Management processes.
*/

-- Drop the old foreign key constraint and column
ALTER TABLE workflow_processes
DROP CONSTRAINT IF EXISTS workflow_processes_bpm_process_id_fkey;

DROP INDEX IF EXISTS idx_workflow_processes_bpm_process_id;

ALTER TABLE workflow_processes
DROP COLUMN IF EXISTS bpm_process_id;

-- Add new QM process reference column
ALTER TABLE workflow_processes
ADD COLUMN IF NOT EXISTS qm_process_id uuid REFERENCES qm_processes(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_processes_qm_process_id
ON workflow_processes(qm_process_id);

-- Add helpful comment
COMMENT ON COLUMN workflow_processes.qm_process_id IS 'Reference to Quality Management process (qm_processes table)';
