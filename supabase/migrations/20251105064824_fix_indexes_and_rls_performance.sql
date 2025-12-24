/*
  # Fix Indexes and RLS Performance Issues
  
  1. Add Missing Indexes on Foreign Keys
    - Adds indexes for all foreign key columns
    - Improves JOIN performance
    
  2. Remove Duplicate Indexes
    - Removes duplicate indexes that waste space
    
  3. Optimize Critical RLS Policies
    - Updates most frequently used policies
    - Uses (select auth.uid()) pattern for better performance
*/

-- =====================================================
-- PART 1: Add Missing Indexes on Foreign Keys
-- =====================================================

-- Activity Report Related
CREATE INDEX IF NOT EXISTS idx_activity_report_attachments_uploaded_by ON public.activity_report_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_activity_report_comments_parent_comment_id ON public.activity_report_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_activity_report_deadlines_created_by ON public.activity_report_deadlines(created_by);
CREATE INDEX IF NOT EXISTS idx_activity_report_notifications_organization_id ON public.activity_report_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_report_templates_created_by ON public.activity_report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_activity_report_versions_changed_by ON public.activity_report_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_activity_report_workflow_approvals_approved_by ON public.activity_report_workflow_approvals(approved_by);
CREATE INDEX IF NOT EXISTS idx_activity_report_workflow_approvals_stage_id ON public.activity_report_workflow_approvals(stage_id);
CREATE INDEX IF NOT EXISTS idx_activity_reports_approved_by ON public.activity_reports(approved_by);
CREATE INDEX IF NOT EXISTS idx_activity_reports_created_by ON public.activity_reports(created_by);

-- Approval Workflows
CREATE INDEX IF NOT EXISTS idx_approval_workflows_requested_by ON public.approval_workflows(requested_by);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_reviewed_by ON public.approval_workflows(reviewed_by);

-- Budget Performance
CREATE INDEX IF NOT EXISTS idx_budget_performance_form_details_economic_code_id ON public.budget_performance_form_details(economic_code_id);
CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_created_by ON public.budget_performance_forms(created_by);
CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_program_id ON public.budget_performance_forms(program_id);
CREATE INDEX IF NOT EXISTS idx_budget_performance_forms_sub_program_id ON public.budget_performance_forms(sub_program_id);

-- Collaboration
CREATE INDEX IF NOT EXISTS idx_collaboration_partners_department_id ON public.collaboration_partners(department_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_plan_partners_department_id ON public.collaboration_plan_partners(department_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_plans_created_by ON public.collaboration_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_collaborations_created_by ON public.collaborations(created_by);

-- Comments
CREATE INDEX IF NOT EXISTS idx_data_entry_comments_data_entry_id ON public.data_entry_comments(data_entry_id);
CREATE INDEX IF NOT EXISTS idx_data_entry_comments_user_id ON public.data_entry_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_indicator_comments_indicator_id ON public.indicator_comments(indicator_id);
CREATE INDEX IF NOT EXISTS idx_indicator_comments_user_id ON public.indicator_comments(user_id);

-- Budget Entries
CREATE INDEX IF NOT EXISTS idx_expense_budget_entries_expense_economic_code_id ON public.expense_budget_entries(expense_economic_code_id);
CREATE INDEX IF NOT EXISTS idx_expense_budget_entries_financing_type_id ON public.expense_budget_entries(financing_type_id);
CREATE INDEX IF NOT EXISTS idx_expense_budget_entries_institutional_code_id ON public.expense_budget_entries(institutional_code_id);

-- Indicator
CREATE INDEX IF NOT EXISTS idx_indicator_data_entries_approved_by ON public.indicator_data_entries(approved_by);
CREATE INDEX IF NOT EXISTS idx_indicator_files_indicator_id ON public.indicator_files(indicator_id);
CREATE INDEX IF NOT EXISTS idx_indicator_files_uploaded_by ON public.indicator_files(uploaded_by);

-- PESTLE/SWOT
CREATE INDEX IF NOT EXISTS idx_pestle_analyses_created_by ON public.pestle_analyses(created_by);
CREATE INDEX IF NOT EXISTS idx_pestle_analysis_comments_user_id ON public.pestle_analysis_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_pestle_swot_relations_created_by ON public.pestle_swot_relations(created_by);
CREATE INDEX IF NOT EXISTS idx_swot_analyses_created_by ON public.swot_analyses(created_by);
CREATE INDEX IF NOT EXISTS idx_swot_analysis_comments_user_id ON public.swot_analysis_comments(user_id);

-- Other
CREATE INDEX IF NOT EXISTS idx_quarter_activations_activated_by ON public.quarter_activations(activated_by);
CREATE INDEX IF NOT EXISTS idx_reminders_indicator_id ON public.reminders(indicator_id);
CREATE INDEX IF NOT EXISTS idx_strategic_plans_created_by ON public.strategic_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_super_admin_activity_logs_super_admin_id ON public.super_admin_activity_logs(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON public.task_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_vice_president_departments_department_id ON public.vice_president_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_vice_president_departments_organization_id ON public.vice_president_departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_vp_department_assignments_assigned_by ON public.vp_department_assignments(assigned_by);

-- =====================================================
-- PART 2: Remove Duplicate Indexes
-- =====================================================

DROP INDEX IF EXISTS public.idx_goals_vice_president;
DROP INDEX IF EXISTS public.idx_entries_status;
DROP INDEX IF EXISTS public.idx_revenue_entries_dept;

-- =====================================================
-- PART 3: Optimize Most Critical RLS Policies
-- =====================================================

-- Profiles (most frequently accessed)
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id);

-- Goals
DROP POLICY IF EXISTS "select_goals" ON public.goals;
CREATE POLICY "select_goals" ON public.goals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.organization_id = goals.organization_id
    )
  );

DROP POLICY IF EXISTS "update_goals" ON public.goals;
CREATE POLICY "update_goals" ON public.goals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.organization_id = goals.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Departments
DROP POLICY IF EXISTS "select_departments" ON public.departments;
CREATE POLICY "select_departments" ON public.departments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.organization_id = departments.organization_id
    )
  );

-- Indicator Data Entries (frequently accessed)
DROP POLICY IF EXISTS "select_data_entries" ON public.indicator_data_entries;
CREATE POLICY "select_data_entries" ON public.indicator_data_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM indicators
      JOIN goals ON goals.id = indicators.goal_id
      JOIN profiles ON profiles.id = (select auth.uid())
      WHERE indicators.id = indicator_data_entries.indicator_id
      AND profiles.organization_id = goals.organization_id
    )
  );

DROP POLICY IF EXISTS "insert_data_entries" ON public.indicator_data_entries;
CREATE POLICY "insert_data_entries" ON public.indicator_data_entries
  FOR INSERT TO authenticated
  WITH CHECK (entered_by = (select auth.uid()));

DROP POLICY IF EXISTS "update_own_draft_entries" ON public.indicator_data_entries;
CREATE POLICY "update_own_draft_entries" ON public.indicator_data_entries
  FOR UPDATE TO authenticated
  USING (entered_by = (select auth.uid()) AND status = 'draft');

DROP POLICY IF EXISTS "delete_own_draft_entries" ON public.indicator_data_entries;
CREATE POLICY "delete_own_draft_entries" ON public.indicator_data_entries
  FOR DELETE TO authenticated
  USING (entered_by = (select auth.uid()) AND status = 'draft');

-- Task Assignments
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.task_assignments;
CREATE POLICY "Users can view their assigned tasks" ON public.task_assignments
  FOR SELECT TO authenticated
  USING (assigned_to = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their tasks" ON public.task_assignments;
CREATE POLICY "Users can update their tasks" ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (assigned_to = (select auth.uid()));

-- Quarter Activations
DROP POLICY IF EXISTS "Users can view activations in their org" ON public.quarter_activations;
CREATE POLICY "Users can view activations in their org" ON public.quarter_activations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.organization_id = quarter_activations.organization_id
    )
  );

-- Messages
DROP POLICY IF EXISTS "select_messages" ON public.messages;
CREATE POLICY "select_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (recipient_id = (select auth.uid()) OR sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "insert_messages" ON public.messages;
CREATE POLICY "insert_messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "update_messages" ON public.messages;
CREATE POLICY "update_messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (recipient_id = (select auth.uid()));
