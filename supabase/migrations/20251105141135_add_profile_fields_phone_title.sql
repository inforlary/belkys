/*
  # Add Phone and Title to Profiles
  
  1. Changes
    - Add phone field to profiles
    - Add title field to profiles (job title/position)
    
  2. Notes
    - These fields are used in user profile management
*/

-- Add phone field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;

-- Add title field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'title'
  ) THEN
    ALTER TABLE profiles ADD COLUMN title text;
  END IF;
END $$;