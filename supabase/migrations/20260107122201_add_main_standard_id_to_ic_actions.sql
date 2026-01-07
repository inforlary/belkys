/*
  # Add main_standard_id to ic_actions for direct main standard assignment
  
  1. Changes
    - Add main_standard_id column to ic_actions table
    - Add foreign key constraint to ic_kiks_main_standards
    - Add index for better query performance
  
  2. Notes
    - Either sub_standard_id OR main_standard_id should be set
    - If sub_standard_id is set, main_standard_id can be derived from it
    - If sub_standard_id is NULL, main_standard_id is used for direct assignment
*/

ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS main_standard_id uuid REFERENCES ic_kiks_main_standards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ic_actions_main_standard ON ic_actions(main_standard_id);

COMMENT ON COLUMN ic_actions.main_standard_id IS 'Direct main standard assignment when no sub-standard is selected';
