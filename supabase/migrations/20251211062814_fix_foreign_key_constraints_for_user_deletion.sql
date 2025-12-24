/*
  # Fix Foreign Key Constraints for User Deletion

  1. Problem
    - Several tables have NO ACTION delete rules for profile references
    - This prevents users from being deleted when organization is deleted
    - activity_logs, budget_entry_audit_log, and other audit/log tables block deletions

  2. Changes
    - Change NO ACTION to SET NULL or CASCADE for appropriate tables
    - Audit/log tables should use SET NULL to preserve history
    - Linking tables should use CASCADE for clean deletion

  3. Security
    - Preserves audit trail by setting user_id to NULL instead of blocking
    - Allows proper cascade deletion of organization and all related data
*/

-- Fix activity_logs FK constraint
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix budget_entry_audit_log FK constraint
ALTER TABLE budget_entry_audit_log DROP CONSTRAINT IF EXISTS budget_entry_audit_log_changed_by_fkey;
ALTER TABLE budget_entry_audit_log ADD CONSTRAINT budget_entry_audit_log_changed_by_fkey 
  FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix budget_entry_comments FK constraint
ALTER TABLE budget_entry_comments DROP CONSTRAINT IF EXISTS budget_entry_comments_user_id_fkey;
ALTER TABLE budget_entry_comments ADD CONSTRAINT budget_entry_comments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix budget_institutional_codes FK constraints
ALTER TABLE budget_institutional_codes DROP CONSTRAINT IF EXISTS budget_institutional_codes_created_by_fkey;
ALTER TABLE budget_institutional_codes ADD CONSTRAINT budget_institutional_codes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budget_institutional_codes DROP CONSTRAINT IF EXISTS budget_institutional_codes_updated_by_fkey;
ALTER TABLE budget_institutional_codes ADD CONSTRAINT budget_institutional_codes_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix budget_performance_* FK constraints
ALTER TABLE budget_performance_activity_justifications DROP CONSTRAINT IF EXISTS budget_performance_activity_justifications_submitted_by_fkey;
ALTER TABLE budget_performance_activity_justifications ADD CONSTRAINT budget_performance_activity_justifications_submitted_by_fkey 
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budget_performance_activity_justifications DROP CONSTRAINT IF EXISTS budget_performance_activity_justifications_reviewed_by_fkey;
ALTER TABLE budget_performance_activity_justifications ADD CONSTRAINT budget_performance_activity_justifications_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budget_performance_program_information DROP CONSTRAINT IF EXISTS budget_performance_program_information_submitted_by_fkey;
ALTER TABLE budget_performance_program_information ADD CONSTRAINT budget_performance_program_information_submitted_by_fkey 
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budget_performance_program_information DROP CONSTRAINT IF EXISTS budget_performance_program_information_reviewed_by_fkey;
ALTER TABLE budget_performance_program_information ADD CONSTRAINT budget_performance_program_information_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budget_performance_program_mappings DROP CONSTRAINT IF EXISTS budget_performance_program_mappings_submitted_by_fkey;
ALTER TABLE budget_performance_program_mappings ADD CONSTRAINT budget_performance_program_mappings_submitted_by_fkey 
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budget_performance_program_mappings DROP CONSTRAINT IF EXISTS budget_performance_program_mappings_approved_by_fkey;
ALTER TABLE budget_performance_program_mappings ADD CONSTRAINT budget_performance_program_mappings_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix collaboration_* FK constraints
ALTER TABLE collaboration_plan_risks DROP CONSTRAINT IF EXISTS collaboration_plan_risks_created_by_fkey;
ALTER TABLE collaboration_plan_risks ADD CONSTRAINT collaboration_plan_risks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE collaboration_risk_controls DROP CONSTRAINT IF EXISTS collaboration_risk_controls_created_by_fkey;
ALTER TABLE collaboration_risk_controls ADD CONSTRAINT collaboration_risk_controls_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix data_entry_comments FK constraint
ALTER TABLE data_entry_comments DROP CONSTRAINT IF EXISTS data_entry_comments_user_id_fkey;
ALTER TABLE data_entry_comments ADD CONSTRAINT data_entry_comments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix expense_budget_entries FK constraints
ALTER TABLE expense_budget_entries DROP CONSTRAINT IF EXISTS expense_budget_entries_posted_by_fkey;
ALTER TABLE expense_budget_entries ADD CONSTRAINT expense_budget_entries_posted_by_fkey 
  FOREIGN KEY (posted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE expense_budget_entries DROP CONSTRAINT IF EXISTS expense_budget_entries_approved_by_fkey;
ALTER TABLE expense_budget_entries ADD CONSTRAINT expense_budget_entries_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE expense_budget_entries DROP CONSTRAINT IF EXISTS expense_budget_entries_last_modified_by_fkey;
ALTER TABLE expense_budget_entries ADD CONSTRAINT expense_budget_entries_last_modified_by_fkey 
  FOREIGN KEY (last_modified_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix revenue_budget_entries FK constraints
ALTER TABLE revenue_budget_entries DROP CONSTRAINT IF EXISTS revenue_budget_entries_posted_by_fkey;
ALTER TABLE revenue_budget_entries ADD CONSTRAINT revenue_budget_entries_posted_by_fkey 
  FOREIGN KEY (posted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE revenue_budget_entries DROP CONSTRAINT IF EXISTS revenue_budget_entries_approved_by_fkey;
ALTER TABLE revenue_budget_entries ADD CONSTRAINT revenue_budget_entries_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE revenue_budget_entries DROP CONSTRAINT IF EXISTS revenue_budget_entries_last_modified_by_fkey;
ALTER TABLE revenue_budget_entries ADD CONSTRAINT revenue_budget_entries_last_modified_by_fkey 
  FOREIGN KEY (last_modified_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix IC (Internal Control) FK constraints
ALTER TABLE ic_action_plan_approvals DROP CONSTRAINT IF EXISTS ic_action_plan_approvals_approver_id_fkey;
ALTER TABLE ic_action_plan_approvals ADD CONSTRAINT ic_action_plan_approvals_approver_id_fkey 
  FOREIGN KEY (approver_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_action_plan_documents DROP CONSTRAINT IF EXISTS ic_action_plan_documents_uploaded_by_fkey;
ALTER TABLE ic_action_plan_documents ADD CONSTRAINT ic_action_plan_documents_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_action_plan_progress DROP CONSTRAINT IF EXISTS ic_action_plan_progress_recorded_by_fkey;
ALTER TABLE ic_action_plan_progress ADD CONSTRAINT ic_action_plan_progress_recorded_by_fkey 
  FOREIGN KEY (recorded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_action_plans DROP CONSTRAINT IF EXISTS ic_action_plans_created_by_fkey;
ALTER TABLE ic_action_plans ADD CONSTRAINT ic_action_plans_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_action_plans DROP CONSTRAINT IF EXISTS ic_action_plans_updated_by_fkey;
ALTER TABLE ic_action_plans ADD CONSTRAINT ic_action_plans_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_capa_actions DROP CONSTRAINT IF EXISTS ic_capa_actions_entered_by_fkey;
ALTER TABLE ic_capa_actions ADD CONSTRAINT ic_capa_actions_entered_by_fkey 
  FOREIGN KEY (entered_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_capas DROP CONSTRAINT IF EXISTS ic_capas_responsible_user_id_fkey;
ALTER TABLE ic_capas ADD CONSTRAINT ic_capas_responsible_user_id_fkey 
  FOREIGN KEY (responsible_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_capas DROP CONSTRAINT IF EXISTS ic_capas_verified_by_fkey;
ALTER TABLE ic_capas ADD CONSTRAINT ic_capas_verified_by_fkey 
  FOREIGN KEY (verified_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_control_tests DROP CONSTRAINT IF EXISTS ic_control_tests_tester_id_fkey;
ALTER TABLE ic_control_tests ADD CONSTRAINT ic_control_tests_tester_id_fkey 
  FOREIGN KEY (tester_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_controls DROP CONSTRAINT IF EXISTS ic_controls_control_owner_id_fkey;
ALTER TABLE ic_controls ADD CONSTRAINT ic_controls_control_owner_id_fkey 
  FOREIGN KEY (control_owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_controls DROP CONSTRAINT IF EXISTS ic_controls_control_performer_id_fkey;
ALTER TABLE ic_controls ADD CONSTRAINT ic_controls_control_performer_id_fkey 
  FOREIGN KEY (control_performer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_ethics_commitments DROP CONSTRAINT IF EXISTS ic_ethics_commitments_reviewed_by_fkey;
ALTER TABLE ic_ethics_commitments ADD CONSTRAINT ic_ethics_commitments_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_findings DROP CONSTRAINT IF EXISTS ic_findings_identified_by_fkey;
ALTER TABLE ic_findings ADD CONSTRAINT ic_findings_identified_by_fkey 
  FOREIGN KEY (identified_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_process_steps DROP CONSTRAINT IF EXISTS ic_process_steps_responsible_user_id_fkey;
ALTER TABLE ic_process_steps ADD CONSTRAINT ic_process_steps_responsible_user_id_fkey 
  FOREIGN KEY (responsible_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_processes DROP CONSTRAINT IF EXISTS ic_processes_owner_user_id_fkey;
ALTER TABLE ic_processes ADD CONSTRAINT ic_processes_owner_user_id_fkey 
  FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_raci_matrix DROP CONSTRAINT IF EXISTS ic_raci_matrix_responsible_user_id_fkey;
ALTER TABLE ic_raci_matrix ADD CONSTRAINT ic_raci_matrix_responsible_user_id_fkey 
  FOREIGN KEY (responsible_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_raci_matrix DROP CONSTRAINT IF EXISTS ic_raci_matrix_accountable_user_id_fkey;
ALTER TABLE ic_raci_matrix ADD CONSTRAINT ic_raci_matrix_accountable_user_id_fkey 
  FOREIGN KEY (accountable_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_risks DROP CONSTRAINT IF EXISTS ic_risks_risk_owner_id_fkey;
ALTER TABLE ic_risks ADD CONSTRAINT ic_risks_risk_owner_id_fkey 
  FOREIGN KEY (risk_owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ic_user_roles DROP CONSTRAINT IF EXISTS ic_user_roles_granted_by_fkey;
ALTER TABLE ic_user_roles ADD CONSTRAINT ic_user_roles_granted_by_fkey 
  FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix indicator_* FK constraints
ALTER TABLE indicator_comments DROP CONSTRAINT IF EXISTS indicator_comments_user_id_fkey;
ALTER TABLE indicator_comments ADD CONSTRAINT indicator_comments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE indicator_data_entries DROP CONSTRAINT IF EXISTS indicator_data_entries_reviewed_by_fkey;
ALTER TABLE indicator_data_entries ADD CONSTRAINT indicator_data_entries_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE indicator_files DROP CONSTRAINT IF EXISTS indicator_files_uploaded_by_fkey;
ALTER TABLE indicator_files ADD CONSTRAINT indicator_files_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix mapped_economic_codes FK constraints
ALTER TABLE mapped_economic_codes DROP CONSTRAINT IF EXISTS mapped_economic_codes_created_by_fkey;
ALTER TABLE mapped_economic_codes ADD CONSTRAINT mapped_economic_codes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE mapped_economic_codes DROP CONSTRAINT IF EXISTS mapped_economic_codes_updated_by_fkey;
ALTER TABLE mapped_economic_codes ADD CONSTRAINT mapped_economic_codes_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE mapped_economic_codes DROP CONSTRAINT IF EXISTS mapped_economic_codes_finance_reviewed_by_fkey;
ALTER TABLE mapped_economic_codes ADD CONSTRAINT mapped_economic_codes_finance_reviewed_by_fkey 
  FOREIGN KEY (finance_reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE mapped_economic_codes DROP CONSTRAINT IF EXISTS mapped_economic_codes_final_approved_by_fkey;
ALTER TABLE mapped_economic_codes ADD CONSTRAINT mapped_economic_codes_final_approved_by_fkey 
  FOREIGN KEY (final_approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix program_activity_mappings FK constraints
ALTER TABLE program_activity_mappings DROP CONSTRAINT IF EXISTS program_activity_mappings_created_by_fkey;
ALTER TABLE program_activity_mappings ADD CONSTRAINT program_activity_mappings_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE program_activity_mappings DROP CONSTRAINT IF EXISTS program_activity_mappings_updated_by_fkey;
ALTER TABLE program_activity_mappings ADD CONSTRAINT program_activity_mappings_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix vp_department_assignments FK constraint
ALTER TABLE vp_department_assignments DROP CONSTRAINT IF EXISTS vp_department_assignments_assigned_by_fkey;
ALTER TABLE vp_department_assignments ADD CONSTRAINT vp_department_assignments_assigned_by_fkey 
  FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;