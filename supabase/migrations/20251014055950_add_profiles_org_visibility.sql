/*
  # Add policy for users to see other profiles in their organization

  1. Problem
    - Users can only see their own profile
    - Cannot see other users in messages recipient list
    
  2. Solution
    - Add policy allowing users to view all profiles in their organization
    
  3. Security
    - Users can only see profiles in their own organization
    - No sensitive data exposure
*/

-- Policy: All users can view profiles in their organization
CREATE POLICY "select_org_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
  );
