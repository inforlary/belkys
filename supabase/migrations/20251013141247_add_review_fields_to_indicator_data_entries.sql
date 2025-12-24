/*
  # Add review fields to indicator_data_entries

  1. Changes
    - Add reviewed_by column to track who approved/rejected the entry
    - Add reviewed_at column to track when the entry was reviewed
    
  2. Security
    - Fields are nullable since not all entries will be reviewed
    - Foreign key to profiles table for reviewed_by
*/

-- Add reviewed_by column
ALTER TABLE indicator_data_entries
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id);

-- Add reviewed_at column
ALTER TABLE indicator_data_entries
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_indicator_data_entries_reviewed_by 
ON indicator_data_entries(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_indicator_data_entries_status 
ON indicator_data_entries(status);
