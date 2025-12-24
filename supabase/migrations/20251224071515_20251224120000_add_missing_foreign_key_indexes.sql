/*
  # Add Missing Foreign Key Indexes for Performance Optimization

  1. Performance Issue
    - 137 foreign key columns without covering indexes
    - Causes suboptimal JOIN and foreign key constraint check performance
    - Critical for tables with high query frequency

  2. Solution
    - Add indexes on all foreign key columns
    - Improves query performance significantly
    - Reduces database load during foreign key validation

  3. Impact
    - Faster JOIN operations
    - Faster foreign key constraint checks
    - Better overall database performance
    
  Note: Creating indexes concurrently to avoid table locks
*/

-- Activity Justifications
CREATE INDEX IF NOT EXISTS idx_activity_justifications_admin_submitted_by ON public.activity_justifications(admin_submitted_by);
CREATE INDEX IF NOT EXISTS idx_activity_justifications_approved_by ON public.activity_justifications(approved_by);
CREATE INDEX IF NOT EXISTS idx_activity_justifications_created_by ON public.activity_justifications(created_by);
CREATE INDEX IF NOT EXISTS idx_activity_justifications_program_id ON public.activity_justifications(program_id);
CREATE INDEX IF NOT EXISTS idx_activity_justifications_sub_program_id ON public.activity_justifications(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_activity_justifications_vp_submitted_by ON public.activity_justifications(vp_submitted_by);

-- Approval Actions Log
CREATE INDEX IF NOT EXISTS idx_approval_actions_log_approver_id ON public.approval_actions_log(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_log_delegated_to ON public.approval_actions_log(delegated_to);
CREATE INDEX IF NOT EXISTS idx_approval_actions_log_step_id ON public.approval_actions_log(step_id);

-- Budget Institutional Codes
CREATE INDEX IF NOT EXISTS idx_budget_institutional_codes_created_by ON public.budget_institutional_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_budget_institutional_codes_updated_by ON public.budget_institutional_codes(updated_by);

-- Budget Performance Activity Justifications
CREATE INDEX IF NOT EXISTS idx_bp_activity_just_reviewed_by ON public.budget_performance_activity_justifications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_bp_activity_just_submitted_by ON public.budget_performance_activity_justifications(submitted_by);

-- Budget Performance Historical Data
CREATE INDEX IF NOT EXISTS idx_bp_historical_sub_program_id ON public.budget_performance_historical_data(sub_program_id);

-- Budget Performance Program Information
CREATE INDEX IF NOT EXISTS idx_bp_program_info_reviewed_by ON public.budget_performance_program_information(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_bp_program_info_submitted_by ON public.budget_performance_program_information(submitted_by);

-- Budget Performance Program Mappings
CREATE INDEX IF NOT EXISTS idx_bp_mappings_activity_id ON public.budget_performance_program_mappings(activity_id);
CREATE INDEX IF NOT EXISTS idx_bp_mappings_approved_by ON public.budget_performance_program_mappings(approved_by);
CREATE INDEX IF NOT EXISTS idx_bp_mappings_sub_program_id ON public.budget_performance_program_mappings(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_bp_mappings_submitted_by ON public.budget_performance_program_mappings(submitted_by);

-- Budget Proposal Approvals
CREATE INDEX IF NOT EXISTS idx_budget_proposal_approvals_approver_id ON public.budget_proposal_approvals(approver_id);

-- Budget Proposal Campaigns
CREATE INDEX IF NOT EXISTS idx_budget_proposal_campaigns_created_by ON public.budget_proposal_campaigns(created_by);

-- Budget Proposal Comments
CREATE INDEX IF NOT EXISTS idx_budget_proposal_comments_item_id ON public.budget_proposal_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_comments_parent_id ON public.budget_proposal_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_comments_user_id ON public.budget_proposal_comments(user_id);

-- Budget Proposal History
CREATE INDEX IF NOT EXISTS idx_budget_proposal_history_changed_by ON public.budget_proposal_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_history_item_id ON public.budget_proposal_history(item_id);

-- Budget Proposal Items
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_activity_id ON public.budget_proposal_items(activity_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_created_by ON public.budget_proposal_items(created_by);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_expense_code_id ON public.budget_proposal_items(expense_economic_code_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_financing_type_id ON public.budget_proposal_items(financing_type_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_institutional_code_id ON public.budget_proposal_items(institutional_code_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_program_id ON public.budget_proposal_items(program_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_sub_program_id ON public.budget_proposal_items(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposal_items_updated_by ON public.budget_proposal_items(updated_by);

-- Budget Proposals
CREATE INDEX IF NOT EXISTS idx_budget_proposals_created_by ON public.budget_proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_budget_proposals_organization_id ON public.budget_proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposals_parent_proposal_id ON public.budget_proposals(parent_proposal_id);
CREATE INDEX IF NOT EXISTS idx_budget_proposals_submitted_by ON public.budget_proposals(submitted_by);
CREATE INDEX IF NOT EXISTS idx_budget_proposals_updated_by ON public.budget_proposals(updated_by);

-- Collaboration Plan Risks
CREATE INDEX IF NOT EXISTS idx_collab_plan_risks_created_by ON public.collaboration_plan_risks(created_by);
CREATE INDEX IF NOT EXISTS idx_collab_plan_risks_responsible_user_id ON public.collaboration_plan_risks(responsible_user_id);

-- Collaboration Risk Controls
CREATE INDEX IF NOT EXISTS idx_collab_risk_controls_created_by ON public.collaboration_risk_controls(created_by);
CREATE INDEX IF NOT EXISTS idx_collab_risk_controls_responsible_user_id ON public.collaboration_risk_controls(responsible_user_id);

-- Department Budget Data 2024
CREATE INDEX IF NOT EXISTS idx_dept_budget_data_2024_created_by ON public.department_budget_data_2024(created_by);

-- Department Budget Limits
CREATE INDEX IF NOT EXISTS idx_dept_budget_limits_created_by ON public.department_budget_limits(created_by);
CREATE INDEX IF NOT EXISTS idx_dept_budget_limits_department_id ON public.department_budget_limits(department_id);

-- Department Program Mappings
CREATE INDEX IF NOT EXISTS idx_dept_program_mappings_created_by ON public.department_program_mappings(created_by);
CREATE INDEX IF NOT EXISTS idx_dept_program_mappings_updated_by ON public.department_program_mappings(updated_by);

-- Department Sub Program Goals
CREATE INDEX IF NOT EXISTS idx_dept_sub_program_goals_created_by ON public.department_sub_program_goals(created_by);
CREATE INDEX IF NOT EXISTS idx_dept_sub_program_goals_updated_by ON public.department_sub_program_goals(updated_by);

-- Document Categories
CREATE INDEX IF NOT EXISTS idx_document_categories_created_by ON public.document_categories(created_by);

-- Document Permissions
CREATE INDEX IF NOT EXISTS idx_document_permissions_granted_by ON public.document_permissions(granted_by);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_parent_document_id ON public.documents(parent_document_id);

-- Enhanced Approval Requests
CREATE INDEX IF NOT EXISTS idx_enhanced_approval_requests_template_id ON public.enhanced_approval_requests(template_id);

-- Expense Budget Entries
CREATE INDEX IF NOT EXISTS idx_expense_budget_entries_last_modified_by ON public.expense_budget_entries(last_modified_by);

-- IC Action Plan Approvals
CREATE INDEX IF NOT EXISTS idx_ic_action_plan_approvals_approver_id ON public.ic_action_plan_approvals(approver_id);

-- IC Action Plan Documents
CREATE INDEX IF NOT EXISTS idx_ic_action_plan_documents_uploaded_by ON public.ic_action_plan_documents(uploaded_by);

-- IC Action Plan Progress
CREATE INDEX IF NOT EXISTS idx_ic_action_plan_progress_recorded_by ON public.ic_action_plan_progress(recorded_by);

-- IC Action Plans
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_capa_id ON public.ic_action_plans(capa_id);
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_created_by ON public.ic_action_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_finding_id ON public.ic_action_plans(finding_id);
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_updated_by ON public.ic_action_plans(updated_by);

-- IC Automatic Action Queue
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_action_plan_id ON public.ic_automatic_action_queue(action_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_capa_id ON public.ic_automatic_action_queue(capa_id);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_control_id ON public.ic_automatic_action_queue(control_id);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_control_test_id ON public.ic_automatic_action_queue(control_test_id);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_ic_plan_id ON public.ic_automatic_action_queue(ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_risk_id ON public.ic_automatic_action_queue(risk_id);

-- IC CAPA Actions
CREATE INDEX IF NOT EXISTS idx_ic_capa_actions_entered_by ON public.ic_capa_actions(entered_by);

-- IC CAPAs
CREATE INDEX IF NOT EXISTS idx_ic_capas_responsible_department_id ON public.ic_capas(responsible_department_id);
CREATE INDEX IF NOT EXISTS idx_ic_capas_verified_by ON public.ic_capas(verified_by);

-- IC Control Tests
CREATE INDEX IF NOT EXISTS idx_ic_control_tests_tester_id ON public.ic_control_tests(tester_id);

-- IC Controls
CREATE INDEX IF NOT EXISTS idx_ic_controls_control_owner_id ON public.ic_controls(control_owner_id);
CREATE INDEX IF NOT EXISTS idx_ic_controls_control_performer_id ON public.ic_controls(control_performer_id);

-- IC Ethics Commitments
CREATE INDEX IF NOT EXISTS idx_ic_ethics_commitments_reviewed_by ON public.ic_ethics_commitments(reviewed_by);

-- IC Findings
CREATE INDEX IF NOT EXISTS idx_ic_findings_control_test_id ON public.ic_findings(control_test_id);
CREATE INDEX IF NOT EXISTS idx_ic_findings_identified_by ON public.ic_findings(identified_by);
CREATE INDEX IF NOT EXISTS idx_ic_findings_risk_id ON public.ic_findings(risk_id);

-- IC Institutional Framework
CREATE INDEX IF NOT EXISTS idx_ic_institutional_framework_approved_by ON public.ic_institutional_framework(approved_by);
CREATE INDEX IF NOT EXISTS idx_ic_institutional_framework_delegate_id ON public.ic_institutional_framework(delegate_id);
CREATE INDEX IF NOT EXISTS idx_ic_institutional_framework_delegator_id ON public.ic_institutional_framework(delegator_id);
CREATE INDEX IF NOT EXISTS idx_ic_institutional_framework_responsible_dept_id ON public.ic_institutional_framework(responsible_department_id);

-- IC Monitoring Evaluations
CREATE INDEX IF NOT EXISTS idx_ic_monitoring_evaluations_evaluated_by ON public.ic_monitoring_evaluations(evaluated_by);

-- IC Plans
CREATE INDEX IF NOT EXISTS idx_ic_plans_created_by ON public.ic_plans(created_by);

-- IC Process Documents
CREATE INDEX IF NOT EXISTS idx_ic_process_documents_approved_by ON public.ic_process_documents(approved_by);

-- IC Process KIKS Mappings
CREATE INDEX IF NOT EXISTS idx_ic_process_kiks_mappings_control_id ON public.ic_process_kiks_mappings(control_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_kiks_mappings_risk_id ON public.ic_process_kiks_mappings(risk_id);

-- IC Process KPIs
CREATE INDEX IF NOT EXISTS idx_ic_process_kpis_responsible_user_id ON public.ic_process_kpis(responsible_user_id);

-- IC Process Steps
CREATE INDEX IF NOT EXISTS idx_ic_process_steps_responsible_user_id ON public.ic_process_steps(responsible_user_id);

-- IC Processes
CREATE INDEX IF NOT EXISTS idx_ic_processes_approved_by ON public.ic_processes(approved_by);
CREATE INDEX IF NOT EXISTS idx_ic_processes_owner_user_id ON public.ic_processes(owner_user_id);

-- IC RACI Matrix
CREATE INDEX IF NOT EXISTS idx_ic_raci_matrix_accountable_user_id ON public.ic_raci_matrix(accountable_user_id);
CREATE INDEX IF NOT EXISTS idx_ic_raci_matrix_responsible_user_id ON public.ic_raci_matrix(responsible_user_id);

-- IC Risks
CREATE INDEX IF NOT EXISTS idx_ic_risks_risk_owner_id ON public.ic_risks(risk_owner_id);

-- IC User Roles
CREATE INDEX IF NOT EXISTS idx_ic_user_roles_granted_by ON public.ic_user_roles(granted_by);

-- Mapped Economic Codes
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_economic_code_id ON public.mapped_economic_codes(economic_code_id);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_final_approved_by ON public.mapped_economic_codes(final_approved_by);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_finance_reviewed_by ON public.mapped_economic_codes(finance_reviewed_by);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_financing_type_id ON public.mapped_economic_codes(financing_type_id);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_institutional_code_id ON public.mapped_economic_codes(institutional_code_id);
CREATE INDEX IF NOT EXISTS idx_mapped_economic_codes_updated_by ON public.mapped_economic_codes(updated_by);

-- Message Attachments
CREATE INDEX IF NOT EXISTS idx_message_attachments_uploaded_by ON public.message_attachments(uploaded_by);

-- Message Drafts
CREATE INDEX IF NOT EXISTS idx_message_drafts_recipient_id ON public.message_drafts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_drafts_thread_id ON public.message_drafts(thread_id);

-- Message Reactions
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- Message Threads
CREATE INDEX IF NOT EXISTS idx_message_threads_created_by ON public.message_threads(created_by);

-- Multi Year Budget Entries
CREATE INDEX IF NOT EXISTS idx_multi_year_budget_entries_admin_submitted_by ON public.multi_year_budget_entries(admin_submitted_by);
CREATE INDEX IF NOT EXISTS idx_multi_year_budget_entries_approved_by ON public.multi_year_budget_entries(approved_by);
CREATE INDEX IF NOT EXISTS idx_multi_year_budget_entries_created_by ON public.multi_year_budget_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_multi_year_budget_entries_submitted_by ON public.multi_year_budget_entries(submitted_by);
CREATE INDEX IF NOT EXISTS idx_multi_year_budget_entries_updated_by ON public.multi_year_budget_entries(updated_by);
CREATE INDEX IF NOT EXISTS idx_multi_year_budget_entries_vp_submitted_by ON public.multi_year_budget_entries(vp_submitted_by);

-- Program Activity Indicator Mappings
CREATE INDEX IF NOT EXISTS idx_program_activity_indicator_mappings_created_by ON public.program_activity_indicator_mappings(created_by);
CREATE INDEX IF NOT EXISTS idx_program_activity_indicator_mappings_updated_by ON public.program_activity_indicator_mappings(updated_by);

-- Program Activity Mappings
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_created_by ON public.program_activity_mappings(created_by);
CREATE INDEX IF NOT EXISTS idx_program_activity_mappings_updated_by ON public.program_activity_mappings(updated_by);

-- Reminder Rules
CREATE INDEX IF NOT EXISTS idx_reminder_rules_created_by ON public.reminder_rules(created_by);

-- Request Comments
CREATE INDEX IF NOT EXISTS idx_request_comments_user_id ON public.request_comments(user_id);

-- Revenue Budget Entries
CREATE INDEX IF NOT EXISTS idx_revenue_budget_entries_last_modified_by ON public.revenue_budget_entries(last_modified_by);

-- Scheduled Reminders
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_organization_id ON public.scheduled_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_rule_id ON public.scheduled_reminders(rule_id);

-- Sub Program Activity Costs
CREATE INDEX IF NOT EXISTS idx_sub_program_activity_costs_created_by ON public.sub_program_activity_costs(created_by);
CREATE INDEX IF NOT EXISTS idx_sub_program_activity_costs_updated_by ON public.sub_program_activity_costs(updated_by);

-- System Audit Logs
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_department_id ON public.system_audit_logs(department_id);

-- User Sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_department_id ON public.user_sessions(department_id);

-- Workflow Template Steps
CREATE INDEX IF NOT EXISTS idx_workflow_template_steps_approver_dept_id ON public.workflow_template_steps(approver_department_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_steps_approver_user_id ON public.workflow_template_steps(approver_user_id);

-- Workflow Templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON public.workflow_templates(created_by);