/*
  # Add Missing Columns to DOF Table

  1. Changes
    - Add corrective_action column for corrective actions
    - Add preventive_action column for preventive actions
    - Add verification_result column for verification results
    - Add verification_date for verification tracking
    - Add verification_by for verification responsible person
    - Add process_kpi_id to link with KPI tracking

  2. Security
    - No RLS changes needed, existing policies apply
*/

ALTER TABLE qm_nonconformities 
ADD COLUMN IF NOT EXISTS corrective_action text,
ADD COLUMN IF NOT EXISTS preventive_action text,
ADD COLUMN IF NOT EXISTS verification_result text,
ADD COLUMN IF NOT EXISTS verification_date date,
ADD COLUMN IF NOT EXISTS verification_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS process_kpi_id uuid REFERENCES qm_process_kpis(id);
