/*
  # Add Risk Appetite Description Field

  1. Changes
    - Add `risk_appetite_description` field to risk_settings table

  2. Notes
    - This field stores the explanation of the chosen risk appetite level
*/

ALTER TABLE risk_settings
ADD COLUMN IF NOT EXISTS risk_appetite_description TEXT;
