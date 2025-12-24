/*
  # Fix Profiles Infinite Recursion
  
  1. Problem
    - "allow_security_definer_functions" policy causes infinite recursion
    - Policy queries profiles table within profiles table RLS check
    - Results in "infinite recursion detected in policy for relation profiles" error
    
  2. Solution
    - Remove the problematic policy
    - Existing policies are sufficient:
      - select_own_profile: users can read their own profile
      - select_org_profiles: users can read profiles in their org
      - Other policies handle admin cases
    
  3. Security
    - No security degradation
    - Existing policies provide adequate protection
    - SECURITY DEFINER functions work without this policy
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "allow_security_definer_functions" ON profiles;

-- The trigger function should still work because:
-- 1. It's SECURITY DEFINER so it runs with elevated privileges
-- 2. It only reads the current user's own profile (id = auth.uid())
-- 3. select_own_profile policy allows this without recursion
