/*
  # Fix all RLS policies to avoid infinite recursion

  1. Problem
    - All policies use SELECT on profiles table causing infinite recursion
    - Uses current_user_org() helper function

  2. Solution
    - Replace all policies to use current_user_org() function
    - This avoids nested SELECT queries on profiles table

  3. Affected Tables
    - organizations
    - strategic_plans
    - objectives
    - goals
    - indicators
    - activities
*/

-- Drop all existing policies on these tables
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerini görüntüleyebilir" ON organizations;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin planlarını görüntüleyebilir" ON strategic_plans;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyeleri için plan oluşturabilir" ON strategic_plans;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin planlarını güncelleyebilir" ON strategic_plans;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin planlarını silebilir" ON strategic_plans;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin amaçlarını görüntüleyebilir" ON objectives;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyeleri için amaç oluşturabilir" ON objectives;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin amaçlarını güncelleyebilir" ON objectives;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin amaçlarını silebilir" ON objectives;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin hedeflerini görüntüleyebilir" ON goals;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyeleri için hedef oluşturabilir" ON goals;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin hedeflerini güncelleyebilir" ON goals;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin hedeflerini silebilir" ON goals;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin göstergelerini görüntüleyebilir" ON indicators;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyeleri için gösterge oluşturabilir" ON indicators;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin göstergelerini güncelleyebilir" ON indicators;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin göstergelerini silebilir" ON indicators;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin faaliyetlerini görüntüleyebilir" ON activities;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyeleri için faaliyet oluşturabilir" ON activities;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin faaliyetlerini güncelleyebilir" ON activities;
DROP POLICY IF EXISTS "Kullanıcılar kendi belediyelerinin faaliyetlerini silebilir" ON activities;

-- Organizations Policies
CREATE POLICY "select_organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (id = current_user_org());

-- Strategic Plans Policies
CREATE POLICY "select_strategic_plans"
  ON strategic_plans FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

CREATE POLICY "insert_strategic_plans"
  ON strategic_plans FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "update_strategic_plans"
  ON strategic_plans FOR UPDATE
  TO authenticated
  USING (organization_id = current_user_org())
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "delete_strategic_plans"
  ON strategic_plans FOR DELETE
  TO authenticated
  USING (organization_id = current_user_org());

-- Objectives Policies
CREATE POLICY "select_objectives"
  ON objectives FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

CREATE POLICY "insert_objectives"
  ON objectives FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "update_objectives"
  ON objectives FOR UPDATE
  TO authenticated
  USING (organization_id = current_user_org())
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "delete_objectives"
  ON objectives FOR DELETE
  TO authenticated
  USING (organization_id = current_user_org());

-- Goals Policies
CREATE POLICY "select_goals"
  ON goals FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

CREATE POLICY "insert_goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "update_goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (organization_id = current_user_org())
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "delete_goals"
  ON goals FOR DELETE
  TO authenticated
  USING (organization_id = current_user_org());

-- Indicators Policies
CREATE POLICY "select_indicators"
  ON indicators FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

CREATE POLICY "insert_indicators"
  ON indicators FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "update_indicators"
  ON indicators FOR UPDATE
  TO authenticated
  USING (organization_id = current_user_org())
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "delete_indicators"
  ON indicators FOR DELETE
  TO authenticated
  USING (organization_id = current_user_org());

-- Activities Policies
CREATE POLICY "select_activities"
  ON activities FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

CREATE POLICY "insert_activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "update_activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (organization_id = current_user_org())
  WITH CHECK (organization_id = current_user_org());

CREATE POLICY "delete_activities"
  ON activities FOR DELETE
  TO authenticated
  USING (organization_id = current_user_org());
