/*
  # Fix action plans cascade delete

  1. Changes
    - Update `ic_action_plans.kiks_action_id` foreign key constraint
    - Change from ON DELETE SET NULL to ON DELETE CASCADE
    - When a KİKS action is deleted, its related action plan should also be deleted
  
  2. Purpose
    - Maintain data integrity by automatically cleaning up orphaned action plans
    - Prevent action plans from remaining when their parent action is deleted
*/

-- Drop existing foreign key constraint and recreate with CASCADE
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ic_action_plans_kiks_action_id_fkey' 
    AND table_name = 'ic_action_plans'
  ) THEN
    ALTER TABLE ic_action_plans DROP CONSTRAINT ic_action_plans_kiks_action_id_fkey;
  END IF;

  -- Add new constraint with CASCADE delete
  ALTER TABLE ic_action_plans 
  ADD CONSTRAINT ic_action_plans_kiks_action_id_fkey 
  FOREIGN KEY (kiks_action_id) 
  REFERENCES ic_kiks_actions(id) 
  ON DELETE CASCADE;
END $$;