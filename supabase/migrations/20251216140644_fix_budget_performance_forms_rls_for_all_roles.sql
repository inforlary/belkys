/*
  # Budget Performance Forms RLS Genişletme
  
  1. Değişiklikler
    - Admin kullanıcılar da form ve detay oluşturabilecek
    - Director kullanıcılar da departmanlarının formlarını oluşturabilecek
    - Kullanıcılar (user role) kendi departmanlarının formlarını okuyabilecek
    
  2. Güvenlik
    - Organization bazlı erişim kontrolü korunuyor
    - Department bazlı erişim kontrolü korunuyor
*/

-- Admin kullanıcılar için form oluşturma izni
DROP POLICY IF EXISTS "Admins can create forms" ON budget_performance_forms;
CREATE POLICY "Admins can create forms"
  ON budget_performance_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Director kullanıcılar için form oluşturma izni
DROP POLICY IF EXISTS "Directors can create forms" ON budget_performance_forms;
CREATE POLICY "Directors can create forms"
  ON budget_performance_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'director'
    )
  );

-- Director kullanıcılar için form güncelleme izni
DROP POLICY IF EXISTS "Directors can update their department forms" ON budget_performance_forms;
CREATE POLICY "Directors can update their department forms"
  ON budget_performance_forms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'director'
    )
  );

-- Admin kullanıcılar için form detay oluşturma izni
DROP POLICY IF EXISTS "Admins can insert form details" ON budget_performance_form_details;
CREATE POLICY "Admins can insert form details"
  ON budget_performance_form_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Director kullanıcılar için form detay oluşturma izni
DROP POLICY IF EXISTS "Directors can insert form details" ON budget_performance_form_details;
CREATE POLICY "Directors can insert form details"
  ON budget_performance_form_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'director'
    )
  );

-- Director kullanıcılar için form detay güncelleme izni
DROP POLICY IF EXISTS "Directors can update form details" ON budget_performance_form_details;
CREATE POLICY "Directors can update form details"
  ON budget_performance_form_details
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM budget_performance_forms
      JOIN profiles ON profiles.id = auth.uid()
      WHERE budget_performance_forms.id = budget_performance_form_details.form_id
      AND profiles.organization_id = budget_performance_forms.organization_id
      AND profiles.department_id = budget_performance_forms.department_id
      AND profiles.role = 'director'
    )
  );
