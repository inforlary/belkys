/*
  # Fix Activities - Make dates nullable for budget activities

  1. Changes
    - Make `start_date` nullable in activities table
    - Make `end_date` nullable in activities table
    - Budget program activities don't require dates initially
    - Strategic planning activities still use dates

  2. Security
    - Maintains existing RLS policies
*/

-- Make start_date and end_date nullable for budget activities
ALTER TABLE activities 
ALTER COLUMN start_date DROP NOT NULL;

ALTER TABLE activities 
ALTER COLUMN end_date DROP NOT NULL;