/*
  # Fix RLS Policies for Super Admin Data Access

  1. Problem
    - Super admins cannot see organization data (Plans, Goals, Objectives, Indicators)
    - SELECT policies only check current_user_org() which returns null for super admins
    - This causes all counts to show as 0 in Super Admin dashboard

  2. Changes
    - Update SELECT policies for strategic_plans table to include super admin check
    - Update SELECT policies for goals table to include super admin check
    - Update SELECT policies for objectives table to include super admin check
    - Update SELECT policies for indicators table to include super admin check
    
  3. Security
    - Super admins can view all organization data (required for management)
    - Regular users can only view data from their own organization
    - Existing restrictions remain in place for non-super-admin users
*/

-- Drop and recreate SELECT policy for strategic_plans
DROP POLICY IF EXISTS "select_strategic_plans" ON strategic_plans;
CREATE POLICY "select_strategic_plans"
  ON strategic_plans
  FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org() OR is_super_admin());

-- Drop and recreate SELECT policy for goals
DROP POLICY IF EXISTS "select_goals" ON goals;
CREATE POLICY "select_goals"
  ON goals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = goals.organization_id
    )
    OR is_super_admin()
  );

-- Drop and recreate SELECT policy for objectives
DROP POLICY IF EXISTS "select_objectives" ON objectives;
CREATE POLICY "select_objectives"
  ON objectives
  FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org() OR is_super_admin());

-- Drop and recreate SELECT policy for indicators
DROP POLICY IF EXISTS "select_indicators" ON indicators;
CREATE POLICY "select_indicators"
  ON indicators
  FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org() OR is_super_admin());