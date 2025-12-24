/*
  # Recreate status constraint

  1. Changes
    - Drop existing status check constraint
    - Recreate with same values
    - This forces PostgreSQL to refresh any cached constraint definitions
*/

-- Drop existing constraint
ALTER TABLE indicator_data_entries 
DROP CONSTRAINT IF EXISTS indicator_data_entries_status_check;

-- Recreate constraint with all valid statuses
ALTER TABLE indicator_data_entries
ADD CONSTRAINT indicator_data_entries_status_check 
CHECK (status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected'));
