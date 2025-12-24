/*
  # Fix Status Constraint for Two-Level Approval System
  
  1. Changes
    - Drop and recreate the status check constraint to allow new statuses
    - Ensures the constraint properly supports: draft, pending_director, pending_admin, approved, rejected
  
  2. Security
    - No RLS changes, only constraint update
*/

-- Drop the existing constraint if it exists
ALTER TABLE indicator_data_entries
DROP CONSTRAINT IF EXISTS indicator_data_entries_status_check;

-- Recreate the constraint with correct values
ALTER TABLE indicator_data_entries
ADD CONSTRAINT indicator_data_entries_status_check 
CHECK (status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected'));
