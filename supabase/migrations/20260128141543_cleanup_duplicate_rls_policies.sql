/*
  # Cleanup Duplicate RLS Policies

  1. Changes
    - Remove old/duplicate RLS policies that conflict with new department-based policies
    - Keep only the new standardized policies
    
  2. Tables Affected
    - qm_processes
    - risks
*/

-- Clean up QM Processes duplicate policies
DROP POLICY IF EXISTS "Users can view qm_processes in their department or organization" ON qm_processes;
DROP POLICY IF EXISTS "Users can update their own DRAFT qm_processes" ON qm_processes;
DROP POLICY IF EXISTS "Users can create qm_processes for their department" ON qm_processes;
DROP POLICY IF EXISTS "Admins can delete qm_processes" ON qm_processes;

-- Clean up Risks duplicate policies
DROP POLICY IF EXISTS "Admins can delete risks" ON risks;
DROP POLICY IF EXISTS "Admins can update all organization risks" ON risks;
DROP POLICY IF EXISTS "Admins can view all organization risks" ON risks;
DROP POLICY IF EXISTS "Directors can update department risks for review" ON risks;
DROP POLICY IF EXISTS "Directors can view their department risks" ON risks;
DROP POLICY IF EXISTS "Presidents can view all risks" ON risks;
DROP POLICY IF EXISTS "Super admins full access to risks" ON risks;
DROP POLICY IF EXISTS "Users can create risks in their department" ON risks;
DROP POLICY IF EXISTS "Users can create risks in their organization" ON risks;
DROP POLICY IF EXISTS "Users can update their draft risks" ON risks;
DROP POLICY IF EXISTS "Users can view their department risks" ON risks;