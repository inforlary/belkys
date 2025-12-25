/*
  # Add Approval Workflow to Sub Program Activities
  
  1. New Fields
    - status: draft, pending_director_approval, pending_admin_approval, approved, rejected
    - created_by, submitted_by, approved_by: User tracking
    - submitted_at, approved_at, rejected_at: Timestamp tracking
    - rejection_reason: Why rejected
    - organization_id: For RLS filtering (nullable for global codes)
    - department_id: For department filtering
  
  2. Security
    - Enable RLS on sub_program_activities
    - Users can create draft entries
    - Directors can approve/reject department entries
    - Admins can approve/reject all entries
    - Super admins have full access to global codes
  
  3. Notes
    - organization_id is nullable to support global standard codes
    - Global codes (organization_id: null) are managed by super admins
*/

-- Step 1: Add columns if they don't exist
DO $$
BEGIN
  -- Add organization_id (nullable for global codes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add department_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;

  -- Add status column (default approved for existing records)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'status'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN status text DEFAULT 'approved' CHECK (status IN ('draft', 'pending_director_approval', 'pending_admin_approval', 'approved', 'rejected'));
  END IF;

  -- Add tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'submitted_by'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add timestamp columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN submitted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN rejected_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_program_activities' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE sub_program_activities
      ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Step 2: Migrate existing data - set organization_id from sub_programs (only for non-global entries)
UPDATE sub_program_activities spa
SET organization_id = sp.organization_id
FROM sub_programs sp
WHERE spa.sub_program_id = sp.id
  AND spa.organization_id IS NULL
  AND sp.organization_id IS NOT NULL;

-- Step 3: Set default status for existing records
UPDATE sub_program_activities
SET status = 'approved'
WHERE status IS NULL;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sub_program_activities_org_status 
  ON sub_program_activities(organization_id, status) WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sub_program_activities_dept 
  ON sub_program_activities(department_id) WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sub_program_activities_created_by 
  ON sub_program_activities(created_by) WHERE created_by IS NOT NULL;

-- Step 5: Enable RLS
ALTER TABLE sub_program_activities ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if any
DROP POLICY IF EXISTS "Users can view activities in their organization" ON sub_program_activities;
DROP POLICY IF EXISTS "Users can create activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Users can update own draft activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Directors can approve activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Admins can manage all activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Super admins manage global activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Users can delete own draft activities" ON sub_program_activities;

-- Step 7: Create RLS Policies

-- SELECT: View activities in organization or global activities
CREATE POLICY "Users can view activities in their organization"
  ON sub_program_activities
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid())
    )
  );

-- INSERT: Create draft activities
CREATE POLICY "Users can create activities"
  ON sub_program_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      organization_id IS NOT NULL
      AND organization_id IN (
        SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid())
      )
      AND status IN ('draft', 'approved')
      AND (created_by = (SELECT auth.uid()) OR created_by IS NULL)
    )
    OR (
      organization_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = (SELECT auth.uid())
        AND is_super_admin = true
      )
    )
  );

-- UPDATE: Users update drafts, directors/admins approve
CREATE POLICY "Users can update own draft activities"
  ON sub_program_activities
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      (
        created_by = (SELECT auth.uid())
        AND status IN ('draft', 'rejected')
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
        AND p.role = 'director'
        AND p.organization_id = sub_program_activities.organization_id
        AND (
          sub_program_activities.department_id = p.department_id
          OR sub_program_activities.department_id IS NULL
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
        AND p.organization_id = sub_program_activities.organization_id
      )
    )
  );

-- Super admins manage global activities
CREATE POLICY "Super admins manage global activities"
  ON sub_program_activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND is_super_admin = true
    )
  );

-- DELETE: Users can delete own drafts, admins can delete all
CREATE POLICY "Users can delete own draft activities"
  ON sub_program_activities
  FOR DELETE
  TO authenticated
  USING (
    (
      created_by = (SELECT auth.uid())
      AND status = 'draft'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
      AND p.organization_id = sub_program_activities.organization_id
    )
  );

-- Add comments
COMMENT ON COLUMN sub_program_activities.status IS 'Approval workflow status: draft, pending_director_approval, pending_admin_approval, approved, rejected';
COMMENT ON COLUMN sub_program_activities.organization_id IS 'Organization owning this activity (NULL for global codes)';
COMMENT ON COLUMN sub_program_activities.department_id IS 'Department responsible for this activity';
COMMENT ON COLUMN sub_program_activities.created_by IS 'User who created this activity';
COMMENT ON COLUMN sub_program_activities.submitted_by IS 'User who submitted for approval';
COMMENT ON COLUMN sub_program_activities.approved_by IS 'User who approved this activity';
