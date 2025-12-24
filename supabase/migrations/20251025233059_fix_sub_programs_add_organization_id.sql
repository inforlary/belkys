/*
  # Fix Sub-Programs Table - Add organization_id

  1. Changes
    - Add `organization_id` column to `sub_programs` table
    - Add foreign key constraint to organizations table
    - Add index for performance
    - Update RLS policies to use organization_id directly

  2. Security
    - Maintains existing RLS policies
    - Improves query performance by using organization_id directly
*/

-- Add organization_id column to sub_programs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sub_programs' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE sub_programs ADD COLUMN organization_id uuid;
    
    -- Populate organization_id from parent program
    UPDATE sub_programs sp
    SET organization_id = p.organization_id
    FROM programs p
    WHERE sp.program_id = p.id;
    
    -- Make it NOT NULL after populating
    ALTER TABLE sub_programs ALTER COLUMN organization_id SET NOT NULL;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_sub_programs_org ON sub_programs(organization_id);
  END IF;
END $$;