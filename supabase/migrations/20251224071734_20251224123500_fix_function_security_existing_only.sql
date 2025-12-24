/*
  # Fix Function Security - Immutable Search Path (Existing Functions Only)

  1. Security Issue
    - Functions have role mutable search_path
    - Creates SQL injection vulnerability risk
    
  2. Solution
    - Set search_path explicitly for existing functions
    - Uses DO block to check function existence first
    - Prevents errors if function doesn't exist

  3. Impact
    - Eliminates SQL injection vector for existing functions
    - Maintains function functionality
    - Critical security enhancement
*/

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Get all functions with mutable search_path
  FOR func_record IN 
    SELECT 
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS function_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'enforce_single_active_authorization',
      'is_super_admin',
      'get_user_context',
      'update_indicator_data_entries_updated_at',
      'get_user_organization_id',
      'update_action_plan_updated_at',
      'update_quarter_activations_updated_at',
      'update_messages_updated_at',
      'update_cost_estimate_updated_at',
      'is_admin',
      'current_user_org',
      'current_user_dept',
      'check_action_plan_delay',
      'update_activity_costs_updated_at',
      'has_ic_role',
      'set_activity_costs_created_by',
      'get_user_ic_roles',
      'is_ic_coordinator',
      'can_manage_department_ic',
      'auto_inherit_action_from_control',
      'can_manage_process',
      'update_ic_user_roles_updated_at',
      'update_collaboration_risk_updated_at',
      'log_user_action',
      'start_user_session',
      'end_user_session',
      'update_session_activity',
      'generate_auto_code',
      'auto_generate_process_code',
      'auto_generate_risk_code',
      'auto_generate_control_code',
      'auto_generate_test_code',
      'auto_generate_finding_code',
      'auto_generate_capa_code',
      'auto_inherit_kiks_from_process',
      'auto_inherit_kiks_from_risk',
      'auto_inherit_kiks_from_control',
      'update_documents_timestamp',
      'log_document_access',
      'auto_inherit_kiks_for_finding',
      'auto_inherit_kiks_from_finding',
      'auto_inherit_action_for_finding',
      'auto_inherit_action_and_standard_for_capa',
      'generate_activity_deadline_reminders',
      'generate_data_entry_reminders',
      'send_pending_reminders',
      'check_overdue_items',
      'update_reminder_preferences_timestamp',
      'update_budget_performance_updated_at',
      'update_thread_last_message',
      'mark_message_as_read',
      'get_unread_message_count',
      'toggle_message_archive',
      'toggle_message_star',
      'soft_delete_message',
      'update_draft_timestamp',
      'initialize_budget_years',
      'log_budget_entry_changes',
      'update_activity_justifications_updated_at',
      'clone_budget_for_next_year',
      'auto_suggest_action_for_high_risk',
      'auto_suggest_capa_for_failed_test',
      'update_risk_after_capa_closure',
      'generate_budget_institutional_tam_kod',
      'update_proposal_totals',
      'update_updated_at_column'
    )
  LOOP
    -- Set search_path for each function
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
        func_record.function_name,
        func_record.function_args
      );
      RAISE NOTICE 'Fixed search_path for function: %(%)', func_record.function_name, func_record.function_args;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not fix function % - Error: %', func_record.function_name, SQLERRM;
    END;
  END LOOP;
END $$;