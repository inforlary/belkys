/*
  # Add SELECT policy for risk_controls table

  1. Changes
    - Add SELECT policy for risk_controls table if not exists
    - Allow users to view risk controls for risks in their organization

  2. Security
    - Users can only view controls for risks in their organization
    - Super admins can view all controls
*/

-- Add SELECT policy for risk_controls (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'risk_controls' 
    AND policyname = 'Users can view risk controls in their organization'
  ) THEN
    CREATE POLICY "Users can view risk controls in their organization"
      ON risk_controls FOR SELECT
      TO authenticated
      USING (
        -- Super admins can see all
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'super_admin'
        )
        OR
        -- Regular users can see controls for risks in their organization
        risk_id IN (
          SELECT id FROM risks WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;