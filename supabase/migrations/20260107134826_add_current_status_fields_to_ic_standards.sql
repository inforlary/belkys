/*
  # Add Current Status Fields to IC Standards

  1. Changes
    - Add `current_situation_description` text field to store the current status/situation description for each standard
    - Add `current_status_satisfied` boolean field to indicate if the current status meets the requirement (no action needed)
  
  2. Purpose
    - Allow documenting the current state of each standard's implementation
    - Enable marking standards as "already satisfied" to avoid unnecessary action items
    - Support better decision-making about which standards need action plans

  3. Notes
    - Both fields are nullable for backward compatibility
    - Default for `current_status_satisfied` is false (null treated as false)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_standards' AND column_name = 'current_situation_description'
  ) THEN
    ALTER TABLE ic_standards ADD COLUMN current_situation_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_standards' AND column_name = 'current_status_satisfied'
  ) THEN
    ALTER TABLE ic_standards ADD COLUMN current_status_satisfied boolean DEFAULT false;
  END IF;
END $$;