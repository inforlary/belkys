/*
  # Add Workflow Management Module

  1. Changes
    - Add `module_workflow_management` column to organizations table
    - Set default value to true for all existing organizations
    
  2. Purpose
    - Enable/disable Workflow Management module per organization
    - Make it a standalone main module in the menu
*/

-- Add module_workflow_management column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS module_workflow_management boolean DEFAULT true;

-- Enable for all existing organizations
UPDATE organizations 
SET module_workflow_management = true 
WHERE module_workflow_management IS NULL;
