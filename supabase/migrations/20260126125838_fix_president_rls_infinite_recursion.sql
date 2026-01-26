/*
  # Fix President Role RLS Infinite Recursion

  1. Changes
    - Remove problematic president profile policy that causes infinite recursion
    - President users will be able to view profiles through existing policies

  2. Security
    - Maintains security while fixing the infinite recursion issue
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Presidents can view all organization profiles" ON profiles;

-- Presidents will use the standard profile viewing policies
-- No special policy needed since presidents should use the same access as other authenticated users
