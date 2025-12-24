/*
  # Add Mission, Vision, and Values to Organizations

  1. Changes
    - Add `mission` text field to organizations table
    - Add `vision` text field to organizations table
    - Add `values` text field to organizations table
    - Add `strategic_priorities` text field for high-level strategic goals

  2. Purpose
    - Support the Institutional Framework page
    - Store organization's core identity information
    - Enable strategic alignment across all modules
*/

-- Add mission, vision, values, and strategic priorities fields
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS mission text,
ADD COLUMN IF NOT EXISTS vision text,
ADD COLUMN IF NOT EXISTS values text,
ADD COLUMN IF NOT EXISTS strategic_priorities text;