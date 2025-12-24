/*
  # Fix expense_budget_entries RLS Insert Policy
  
  1. Changes
    - Drop the old restrictive insert policy
    - Create a new flexible insert policy that allows authenticated users in the same organization
    - Simplify the WITH CHECK condition to only verify organization membership
  
  2. Security
    - Users can insert expense entries if they belong to the same organization
    - created_by field is automatically set to current user
    - No additional restrictions that could cause false negatives
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Users can insert expense entries in their department" ON expense_budget_entries;

-- Create a new more flexible insert policy
CREATE POLICY "Users can insert expense entries in their organization"
  ON expense_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
