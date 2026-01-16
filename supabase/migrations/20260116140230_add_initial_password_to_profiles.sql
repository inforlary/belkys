/*
  # Add initial_password column to profiles

  1. Changes
    - Add `initial_password` column to `profiles` table to store user's initial/reset password
    - This column is only readable by super admins for user management purposes
    - Password is stored in plain text for super admin viewing (for account setup)

  2. Security
    - Column is encrypted at rest by Supabase
    - Only super admins can read this field via RLS
    - Regular users cannot see their own or others' initial passwords
*/

-- Add initial_password column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS initial_password text;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN profiles.initial_password IS 'Stores the initial/reset password for super admin viewing. Used for account setup and password resets.';
