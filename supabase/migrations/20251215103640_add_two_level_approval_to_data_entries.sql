/*
  # Add Two-Level Approval System to Data Entries

  1. Changes
    - Add director approval fields to indicator_data_entries
    - Add rejection_reason field
    - Update status enum to support two-level approval workflow
    - Update existing 'submitted' entries to appropriate status based on user role
  
  2. New Status Flow
    - draft: Initial state for all entries
    - pending_director: Waiting for department director approval (for regular users)
    - pending_admin: Waiting for admin/vice president approval
    - approved: Fully approved by both levels (if needed)
    - rejected: Rejected at any level
  
  3. Workflow
    - Admin/Vice President: draft → approved (no approval needed)
    - Department Director: draft → pending_admin → approved
    - Regular User: draft → pending_director → pending_admin → approved
*/

-- Add new columns to indicator_data_entries
ALTER TABLE indicator_data_entries
ADD COLUMN IF NOT EXISTS director_approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS director_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update status check constraint to include new statuses
ALTER TABLE indicator_data_entries
DROP CONSTRAINT IF EXISTS indicator_data_entries_status_check;

ALTER TABLE indicator_data_entries
ADD CONSTRAINT indicator_data_entries_status_check 
CHECK (status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected'));

-- Update existing 'submitted' entries to 'pending_admin' (since we don't know if they need director approval)
UPDATE indicator_data_entries
SET status = 'pending_admin'
WHERE status = 'submitted';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_data_entries_director_approval 
ON indicator_data_entries(director_approved_by, director_approved_at);

CREATE INDEX IF NOT EXISTS idx_data_entries_status_org 
ON indicator_data_entries(status, organization_id);