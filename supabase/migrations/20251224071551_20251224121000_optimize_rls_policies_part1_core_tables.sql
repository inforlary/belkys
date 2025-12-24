/*
  # Optimize RLS Policies - Part 1: Core Tables

  1. Performance Issue
    - RLS policies re-evaluate auth.uid() and current_setting() for each row
    - This causes suboptimal query performance at scale
    - Critical for frequently queried tables

  2. Solution
    - Replace `auth.uid()` with `(select auth.uid())`
    - Replace `current_setting()` with subquery pattern
    - This evaluates the function once instead of per-row

  3. Tables in This Migration
    - departments
    - profiles
    - indicator_data_entries
    - indicator_files
    - indicator_comments
    - data_entry_comments
    - goals
    - indicator_targets
    - activities

  Note: This is part 1 of RLS optimization, focusing on core tables
*/

-- =============================================
-- DEPARTMENTS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view departments in their organization" ON public.departments;
CREATE POLICY "Users can view departments in their organization"
  ON public.departments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_departments" ON public.departments;
CREATE POLICY "insert_departments"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND (role = 'admin' OR is_super_admin = true)
      AND organization_id = departments.organization_id
    )
  );

DROP POLICY IF EXISTS "update_departments" ON public.departments;
CREATE POLICY "update_departments"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND (role = 'admin' OR is_super_admin = true)
      AND organization_id = departments.organization_id
    )
  );

-- =============================================
-- INDICATOR FILES TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can delete their own files" ON public.indicator_files;
CREATE POLICY "Users can delete their own files"
  ON public.indicator_files FOR DELETE
  TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can upload files" ON public.indicator_files;
CREATE POLICY "Users can upload files"
  ON public.indicator_files FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view files in their organization" ON public.indicator_files;
CREATE POLICY "Users can view files in their organization"
  ON public.indicator_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.profiles p ON p.organization_id = i.organization_id
      WHERE i.id = indicator_files.indicator_id
      AND p.id = (SELECT auth.uid())
    )
  );

-- =============================================
-- INDICATOR COMMENTS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can create comments" ON public.indicator_comments;
CREATE POLICY "Users can create comments"
  ON public.indicator_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.indicator_comments;
CREATE POLICY "Users can delete their own comments"
  ON public.indicator_comments FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own comments" ON public.indicator_comments;
CREATE POLICY "Users can update their own comments"
  ON public.indicator_comments FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view comments in their organization" ON public.indicator_comments;
CREATE POLICY "Users can view comments in their organization"
  ON public.indicator_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.profiles p ON p.organization_id = i.organization_id
      WHERE i.id = indicator_comments.indicator_id
      AND p.id = (SELECT auth.uid())
    )
  );

-- =============================================
-- DATA ENTRY COMMENTS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can create data entry comments" ON public.data_entry_comments;
CREATE POLICY "Users can create data entry comments"
  ON public.data_entry_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view data entry comments in their organization" ON public.data_entry_comments;
CREATE POLICY "Users can view data entry comments in their organization"
  ON public.data_entry_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.indicator_data_entries ide
      JOIN public.indicators i ON i.id = ide.indicator_id
      JOIN public.profiles p ON p.organization_id = i.organization_id
      WHERE ide.id = data_entry_comments.data_entry_id
      AND p.id = (SELECT auth.uid())
    )
  );

-- =============================================
-- INDICATOR DATA ENTRIES TABLE
-- =============================================

DROP POLICY IF EXISTS "admins_update_all_entries" ON public.indicator_data_entries;
CREATE POLICY "admins_update_all_entries"
  ON public.indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.indicators i ON i.organization_id = p.organization_id
      WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'admin' OR p.is_super_admin = true)
      AND i.id = indicator_data_entries.indicator_id
    )
  );

DROP POLICY IF EXISTS "delete_own_draft_entries" ON public.indicator_data_entries;
CREATE POLICY "delete_own_draft_entries"
  ON public.indicator_data_entries FOR DELETE
  TO authenticated
  USING (
    entered_by = (SELECT auth.uid())
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "directors_update_entries" ON public.indicator_data_entries;
CREATE POLICY "directors_update_entries"
  ON public.indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.indicators i ON i.organization_id = p.organization_id
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'director'
      AND i.id = indicator_data_entries.indicator_id
      AND (
        indicator_data_entries.department_id = p.department_id
        OR indicator_data_entries.department_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "insert_data_entries" ON public.indicator_data_entries;
CREATE POLICY "insert_data_entries"
  ON public.indicator_data_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.indicators i ON i.organization_id = p.organization_id
      WHERE p.id = (SELECT auth.uid())
      AND i.id = indicator_data_entries.indicator_id
    )
  );

DROP POLICY IF EXISTS "users_update_own_draft_entries" ON public.indicator_data_entries;
CREATE POLICY "users_update_own_draft_entries"
  ON public.indicator_data_entries FOR UPDATE
  TO authenticated
  USING (
    entered_by = (SELECT auth.uid())
    AND status = 'draft'
  );

-- =============================================
-- GOALS TABLE
-- =============================================

DROP POLICY IF EXISTS "select_goals" ON public.goals;
CREATE POLICY "select_goals"
  ON public.goals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())
    )
  );

-- =============================================
-- INDICATOR TARGETS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can manage indicator targets" ON public.indicator_targets;
CREATE POLICY "Users can manage indicator targets"
  ON public.indicator_targets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.profiles p ON p.organization_id = i.organization_id
      WHERE i.id = indicator_targets.indicator_id
      AND p.id = (SELECT auth.uid())
      AND (p.role IN ('admin', 'director', 'manager') OR p.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Users can view indicator targets in their organization" ON public.indicator_targets;
CREATE POLICY "Users can view indicator targets in their organization"
  ON public.indicator_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.profiles p ON p.organization_id = i.organization_id
      WHERE i.id = indicator_targets.indicator_id
      AND p.id = (SELECT auth.uid())
    )
  );

-- =============================================
-- ACTIVITIES TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can create activities in their organization" ON public.activities;
CREATE POLICY "Users can create activities in their organization"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete activities in their organization" ON public.activities;
CREATE POLICY "Users can delete activities in their organization"
  ON public.activities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = (SELECT auth.uid())
      AND (role = 'admin' OR is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Users can update activities in their organization" ON public.activities;
CREATE POLICY "Users can update activities in their organization"
  ON public.activities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view activities in their organization" ON public.activities;
CREATE POLICY "Users can view activities in their organization"
  ON public.activities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())
    )
  );