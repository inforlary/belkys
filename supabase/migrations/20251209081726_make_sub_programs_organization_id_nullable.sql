/*
  # Make organization_id nullable in sub_programs and sub_program_activities

  1. Changes
    - Make organization_id column nullable in sub_programs table to allow global standard codes
    - Make organization_id column nullable in sub_program_activities table (if exists)
    - This aligns with programs, expense_codes, revenue_codes, and financing_types tables
    
  2. Notes
    - Global standard codes (organization_id: null) are managed by Super Admins
    - Organization-specific codes have organization_id set
*/

-- Make organization_id nullable in sub_programs table
ALTER TABLE sub_programs 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Check if sub_program_activities has organization_id column and make it nullable if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE sub_program_activities 
      ALTER COLUMN organization_id DROP NOT NULL;
  END IF;
END $$;
