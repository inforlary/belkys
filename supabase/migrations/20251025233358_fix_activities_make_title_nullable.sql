/*
  # Fix Activities - Make title nullable for budget activities

  1. Changes
    - Make `title` nullable in activities table
    - Budget program activities use 'name' instead of 'title'
    - Strategic planning activities use 'title'

  2. Security
    - Maintains existing RLS policies
*/

-- Make title nullable for budget activities
ALTER TABLE activities 
ALTER COLUMN title DROP NOT NULL;