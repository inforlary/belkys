/*
  # Remove BPM Process Management System

  ## Overview
  This migration removes the standalone BPM (Business Process Management) module 
  to avoid confusion with the Quality Management Process module.

  ## Changes
  1. Drop BPM tables (with CASCADE to handle foreign keys)
     - bpm_approval_logs
     - bpm_process_history
     - bpm_process_documents
     - bpm_process_risks
     - bpm_process_regulations
     - bpm_processes
     - bpm_categories

  2. Remove storage bucket
     - bpm-documents bucket

  3. Remove module column from organizations table
     - module_process_management

  ## Note
  Quality Management Process module (qm_processes) remains active and unaffected.
*/

-- Drop BPM tables in reverse dependency order
DROP TABLE IF EXISTS bpm_approval_logs CASCADE;
DROP TABLE IF EXISTS bpm_process_history CASCADE;
DROP TABLE IF EXISTS bpm_process_documents CASCADE;
DROP TABLE IF EXISTS bpm_process_risks CASCADE;
DROP TABLE IF EXISTS bpm_process_regulations CASCADE;
DROP TABLE IF EXISTS bpm_processes CASCADE;
DROP TABLE IF EXISTS bpm_categories CASCADE;

-- Remove module column from organizations table
ALTER TABLE organizations 
DROP COLUMN IF EXISTS module_process_management;

-- Note: Storage bucket removal is handled separately through Supabase dashboard
-- or storage API as it requires special handling
