/*
  # Fix Risk Controls and Risk Indicators Insert Policies

  1. Changes
    - Add INSERT policy for risk_controls table
    - Add INSERT policy for risk_indicators table
    - Allow admins and directors to insert risk controls and indicators

  2. Security
    - Users can only insert controls/indicators for risks in their organization
    - Admins, directors, and super_admins can insert
*/

-- Add INSERT policy for risk_controls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'risk_controls' 
    AND policyname = 'Admins can insert risk controls'
  ) THEN
    CREATE POLICY "Admins can insert risk controls"
      ON risk_controls
      FOR INSERT
      TO authenticated
      WITH CHECK (
        risk_id IN (
          SELECT r.id FROM risks r
          INNER JOIN profiles p ON p.organization_id = r.organization_id
          WHERE p.id = auth.uid()
          AND p.role IN ('super_admin', 'admin', 'director')
        )
      );
  END IF;
END $$;

-- Add INSERT policy for risk_indicators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'risk_indicators' 
    AND policyname = 'Admins can insert risk indicators'
  ) THEN
    CREATE POLICY "Admins can insert risk indicators"
      ON risk_indicators
      FOR INSERT
      TO authenticated
      WITH CHECK (
        risk_id IN (
          SELECT r.id FROM risks r
          INNER JOIN profiles p ON p.organization_id = r.organization_id
          WHERE p.id = auth.uid()
          AND p.role IN ('super_admin', 'admin', 'director')
        )
      );
  END IF;
END $$;
