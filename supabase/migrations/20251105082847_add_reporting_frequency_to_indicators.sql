/*
  # Add Reporting Frequency to Indicators
  
  1. Changes
    - Add reporting_frequency column to indicators table
    - This complements the existing measurement_frequency field
    - Allows tracking how often the indicator should be reported
  
  2. Notes
    - Values like: "Aylık", "3 Aylık", "6 Aylık", "Yıllık", etc.
*/

-- Add reporting frequency column
ALTER TABLE public.indicators 
ADD COLUMN IF NOT EXISTS reporting_frequency text;

-- Add comment
COMMENT ON COLUMN public.indicators.reporting_frequency IS 'How often the indicator should be reported (e.g., monthly, quarterly, yearly)';
