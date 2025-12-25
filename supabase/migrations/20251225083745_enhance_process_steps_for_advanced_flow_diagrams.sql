/*
  # Enhance Process Steps for Advanced Flow Diagrams

  1. Changes
    - Add ic_plan_id to ic_process_steps for multi-year support
    - Add step_type for different node types (process, decision, parallel_start, parallel_end, subprocess)
    - Add is_critical_control_point for highlighting critical steps
    - Add parallel_group for grouping parallel steps
    - Add next_step_condition for decision branching (yes/no paths)
    - Add subprocess_id to link to child processes
    - Add position_x, position_y for custom diagram layouts
    - Add swim_lane for role/department lanes

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to ic_process_steps
ALTER TABLE ic_process_steps
  ADD COLUMN IF NOT EXISTS ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS step_type text DEFAULT 'process' CHECK (step_type IN ('process', 'decision', 'parallel_start', 'parallel_end', 'subprocess', 'start', 'end')),
  ADD COLUMN IF NOT EXISTS is_critical_control_point boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parallel_group integer,
  ADD COLUMN IF NOT EXISTS next_step_condition text,
  ADD COLUMN IF NOT EXISTS subprocess_id uuid REFERENCES ic_processes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_x integer,
  ADD COLUMN IF NOT EXISTS position_y integer,
  ADD COLUMN IF NOT EXISTS swim_lane text;

-- Add index for ic_plan_id
CREATE INDEX IF NOT EXISTS idx_ic_process_steps_plan ON ic_process_steps(ic_plan_id);

-- Add index for step_type
CREATE INDEX IF NOT EXISTS idx_ic_process_steps_type ON ic_process_steps(step_type);

-- Add index for parallel_group
CREATE INDEX IF NOT EXISTS idx_ic_process_steps_parallel ON ic_process_steps(parallel_group) WHERE parallel_group IS NOT NULL;
