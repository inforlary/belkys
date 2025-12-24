/*
  # Remove Unused Indexes - Part 1

  1. Performance Issue
    - 150+ unused indexes consuming disk space
    - Slows down INSERT/UPDATE/DELETE operations
    - Increases maintenance overhead

  2. Solution
    - Drop indexes that have never been used
    - Improves write performance
    - Reduces storage costs

  3. Impact
    - Faster data modifications
    - Reduced disk usage
    - Better overall database performance

  Note: Only dropping indexes that are confirmed unused
*/

-- Drop unused indexes - Part 1: Core tables
DROP INDEX IF EXISTS public.idx_data_entries_director_approval;
DROP INDEX IF EXISTS public.idx_report_deadlines_date;
DROP INDEX IF EXISTS public.idx_activity_logs_org;
DROP INDEX IF EXISTS public.idx_activity_logs_entity;
DROP INDEX IF EXISTS public.idx_activity_logs_created;
DROP INDEX IF EXISTS public.idx_task_assignments_status;
DROP INDEX IF EXISTS public.idx_approval_workflows_entity;
DROP INDEX IF EXISTS public.idx_approval_workflows_status;
DROP INDEX IF EXISTS public.idx_quarter_activations_is_active;
DROP INDEX IF EXISTS public.idx_messages_status;
DROP INDEX IF EXISTS public.idx_messages_priority;
DROP INDEX IF EXISTS public.idx_messages_created_at;
DROP INDEX IF EXISTS public.idx_notifications_created;
DROP INDEX IF EXISTS public.idx_collaborations_org_id;
DROP INDEX IF EXISTS public.idx_collaborations_dept_id;
DROP INDEX IF EXISTS public.idx_workflow_template_steps_template;
DROP INDEX IF EXISTS public.idx_enhanced_requests_entity;
DROP INDEX IF EXISTS public.idx_approval_actions_log_request;
DROP INDEX IF EXISTS public.idx_activity_reports_status;
DROP INDEX IF EXISTS public.idx_institutional_codes_org;
DROP INDEX IF EXISTS public.idx_request_comments_request;
DROP INDEX IF EXISTS public.idx_expense_entries_created_by;
DROP INDEX IF EXISTS public.idx_budget_auth_org;
DROP INDEX IF EXISTS public.idx_revenue_entries_created_by;
DROP INDEX IF EXISTS public.idx_revenue_proposals_entry;
DROP INDEX IF EXISTS public.idx_expense_budget_entries_dept;
DROP INDEX IF EXISTS public.idx_revenue_budget_entries_dept;
DROP INDEX IF EXISTS public.idx_organizations_subdomain;
DROP INDEX IF EXISTS public.idx_profiles_is_super_admin;
DROP INDEX IF EXISTS public.idx_swot_analyses_org;
DROP INDEX IF EXISTS public.idx_swot_analyses_category;
DROP INDEX IF EXISTS public.idx_pestle_analyses_org;
DROP INDEX IF EXISTS public.idx_pestle_analyses_category;
DROP INDEX IF EXISTS public.idx_expense_entries_status;
DROP INDEX IF EXISTS public.idx_revenue_entries_status;
DROP INDEX IF EXISTS public.idx_ic_findings_status;
DROP INDEX IF EXISTS public.idx_proposal_items_proposal;
DROP INDEX IF EXISTS public.idx_approvals_proposal;
DROP INDEX IF EXISTS public.idx_proposal_history_proposal;
DROP INDEX IF EXISTS public.idx_proposal_comments_proposal;
DROP INDEX IF EXISTS public.idx_ic_capas_finding;
DROP INDEX IF EXISTS public.idx_ic_capas_responsible;
DROP INDEX IF EXISTS public.idx_ic_capas_due_date;
DROP INDEX IF EXISTS public.idx_message_threads_participants;
DROP INDEX IF EXISTS public.idx_message_attachments_message;
DROP INDEX IF EXISTS public.idx_message_reactions_message;
DROP INDEX IF EXISTS public.idx_message_read_receipts_message;
DROP INDEX IF EXISTS public.idx_messages_thread;
DROP INDEX IF EXISTS public.idx_messages_archived;
DROP INDEX IF EXISTS public.idx_messages_starred;
DROP INDEX IF EXISTS public.idx_messages_deleted;
DROP INDEX IF EXISTS public.idx_budget_institutional_codes_il;
DROP INDEX IF EXISTS public.idx_budget_institutional_codes_active;
DROP INDEX IF EXISTS public.idx_report_versions_report;
DROP INDEX IF EXISTS public.idx_report_templates_org;
DROP INDEX IF EXISTS public.idx_workflow_stages_org;
DROP INDEX IF EXISTS public.idx_workflow_approvals_status;
DROP INDEX IF EXISTS public.idx_ic_process_kpis_org;
DROP INDEX IF EXISTS public.idx_report_notifications_created;
DROP INDEX IF EXISTS public.idx_activity_reports_template;
DROP INDEX IF EXISTS public.idx_activity_reports_workflow;
DROP INDEX IF EXISTS public.idx_activity_reports_late;
DROP INDEX IF EXISTS public.idx_ic_process_kpis_plan;
DROP INDEX IF EXISTS public.idx_ic_process_kpis_process;
DROP INDEX IF EXISTS public.idx_ic_pk_mappings_kiks;
DROP INDEX IF EXISTS public.idx_ic_process_docs_org;
DROP INDEX IF EXISTS public.idx_ic_process_docs_plan;
DROP INDEX IF EXISTS public.idx_ic_process_docs_process;
DROP INDEX IF EXISTS public.idx_activity_report_comments_parent_comment_id;
DROP INDEX IF EXISTS public.idx_activity_report_templates_created_by;
DROP INDEX IF EXISTS public.idx_activity_report_versions_changed_by;
DROP INDEX IF EXISTS public.idx_activity_report_workflow_approvals_stage_id;
DROP INDEX IF EXISTS public.idx_activity_reports_approved_by;
DROP INDEX IF EXISTS public.idx_activity_reports_created_by;
DROP INDEX IF EXISTS public.idx_budget_performance_forms_created_by;
DROP INDEX IF EXISTS public.idx_budget_performance_forms_program_id;
DROP INDEX IF EXISTS public.idx_budget_performance_forms_sub_program_id;
DROP INDEX IF EXISTS public.idx_collaboration_partners_department_id;
DROP INDEX IF EXISTS public.idx_collaborations_created_by;
DROP INDEX IF EXISTS public.idx_pestle_analyses_created_by;
DROP INDEX IF EXISTS public.idx_swot_analyses_created_by;
DROP INDEX IF EXISTS public.idx_strategic_plans_created_by;
DROP INDEX IF EXISTS public.idx_super_admin_activity_logs_super_admin_id;
DROP INDEX IF EXISTS public.idx_vice_president_departments_department_id;
DROP INDEX IF EXISTS public.idx_vice_president_departments_organization_id;
DROP INDEX IF EXISTS public.idx_audit_logs_user_created;
DROP INDEX IF EXISTS public.idx_audit_logs_action_type;
DROP INDEX IF EXISTS public.idx_audit_logs_entity_type;
DROP INDEX IF EXISTS public.idx_audit_logs_entity_id;
DROP INDEX IF EXISTS public.idx_audit_logs_session_id;
DROP INDEX IF EXISTS public.idx_audit_logs_org_action_created;
DROP INDEX IF EXISTS public.idx_user_sessions_login_at;
DROP INDEX IF EXISTS public.idx_ic_process_interactions_org;
DROP INDEX IF EXISTS public.idx_ic_process_interactions_plan;
DROP INDEX IF EXISTS public.idx_ic_process_interactions_source;
DROP INDEX IF EXISTS public.idx_ic_process_interactions_target;
DROP INDEX IF EXISTS public.idx_documents_entity;
DROP INDEX IF EXISTS public.idx_documents_tags;
DROP INDEX IF EXISTS public.idx_document_permissions_document;
DROP INDEX IF EXISTS public.idx_document_access_logs_document;