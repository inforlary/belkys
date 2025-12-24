/*
  # Fix collaboration_plans organization_id foreign key
  
  1. Changes
    - Drop incorrect foreign key constraint (organization_id -> auth.users)
    - Add correct foreign key constraint (organization_id -> organizations)
    
  2. Rationale
    - organization_id should reference the organizations table, not auth.users
    - This was causing insert failures with "Key is not present in table users" error
*/

-- Drop the incorrect foreign key constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'collaboration_plans_organization_id_fkey'
    AND table_name = 'collaboration_plans'
  ) THEN
    ALTER TABLE collaboration_plans DROP CONSTRAINT collaboration_plans_organization_id_fkey;
  END IF;
END $$;

-- Add the correct foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'collaboration_plans_organization_id_fkey'
    AND table_name = 'collaboration_plans'
  ) THEN
    ALTER TABLE collaboration_plans 
    ADD CONSTRAINT collaboration_plans_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;
  END IF;
END $$;
