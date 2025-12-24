/*
  # Alt Program Hedefleri ve Faaliyet Açıklama Onay Sistemi

  1. Yeni Tablolar
    - `department_sub_program_goals`
      - Alt programların hangi stratejik hedefle ilişkilendirildiğini tutar
      - Müdürlük bazında alt program - hedef eşleştirmesi
      - Her müdürlük kendi alt programları için hedef belirleyebilir
  
  2. Mevcut Tabloya Eklenen Alanlar
    - `program_activity_indicator_mappings` tablosuna:
      - `description_status` - açıklama onay durumu (draft, pending_approval, approved, rejected)
      - `description_submitted_at` - açıklama onaya gönderilme tarihi
      - `description_reviewed_at` - açıklama inceleme tarihi
      - `description_reviewed_by` - açıklamayı inceleyen kişi
      - `description_rejection_reason` - red nedeni
  
  3. İş Mantığı
    - Alt programlar hedeflerle eşleştirilir (faaliyet bazında değil)
    - Kullanıcılar ve müdürler faaliyet açıklaması ekleyebilir
    - Açıklamalar onaya gönderilebilir
    - Yöneticiler açıklamaları onaylayabilir veya reddedebilir
    
  4. Güvenlik
    - RLS politikaları ile yetki kontrolü
    - Sadece ilgili müdürlük kendi eşleştirmelerini görebilir
    - Yöneticiler tüm açıklamaları onaylayabilir
*/

CREATE TABLE IF NOT EXISTS department_sub_program_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  sub_program_id uuid REFERENCES sub_programs(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, department_id, sub_program_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_subprog_goals_org ON department_sub_program_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_dept_subprog_goals_dept ON department_sub_program_goals(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_subprog_goals_subprog ON department_sub_program_goals(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_dept_subprog_goals_goal ON department_sub_program_goals(goal_id);

ALTER TABLE department_sub_program_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view department sub program goals"
  ON department_sub_program_goals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and dept users can insert department sub program goals"
  ON department_sub_program_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = department_sub_program_goals.organization_id
      AND (
        role IN ('admin', 'super_admin')
        OR department_id = department_sub_program_goals.department_id
      )
    )
  );

CREATE POLICY "Admins and dept users can update department sub program goals"
  ON department_sub_program_goals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = department_sub_program_goals.organization_id
      AND (
        role IN ('admin', 'super_admin')
        OR department_id = department_sub_program_goals.department_id
      )
    )
  );

CREATE POLICY "Admins can delete department sub program goals"
  ON department_sub_program_goals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = department_sub_program_goals.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_activity_indicator_mappings' 
    AND column_name = 'description_status'
  ) THEN
    ALTER TABLE program_activity_indicator_mappings 
    ADD COLUMN description_status text DEFAULT 'draft' CHECK (description_status IN ('draft', 'pending_approval', 'approved', 'rejected'));
    
    ALTER TABLE program_activity_indicator_mappings 
    ADD COLUMN description_submitted_at timestamptz,
    ADD COLUMN description_reviewed_at timestamptz,
    ADD COLUMN description_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN description_rejection_reason text;
    
    CREATE INDEX IF NOT EXISTS idx_pai_mappings_desc_status ON program_activity_indicator_mappings(description_status);
    CREATE INDEX IF NOT EXISTS idx_pai_mappings_desc_reviewer ON program_activity_indicator_mappings(description_reviewed_by);
  END IF;
END $$;