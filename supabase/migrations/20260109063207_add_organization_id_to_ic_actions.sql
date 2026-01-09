/*
  # ic_actions tablosuna organization_id ekle
  
  1. Changes
    - ic_actions tablosuna organization_id kolonu eklenir
    - Foreign key constraint eklenir
    - Index oluşturulur
    - Mevcut kayıtlar için organization_id doldurulur
*/

-- organization_id kolonu ekle
ALTER TABLE ic_actions
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_ic_actions_organization ON ic_actions(organization_id);

-- Mevcut kayıtlar için organization_id'yi action_plan'dan çek
UPDATE ic_actions
SET organization_id = (
  SELECT organization_id 
  FROM ic_action_plans 
  WHERE ic_action_plans.id = ic_actions.action_plan_id
)
WHERE organization_id IS NULL
AND action_plan_id IS NOT NULL;

-- RLS policy güncelle - organization_id kontrolü ekle
DROP POLICY IF EXISTS "Users view own org actions" ON ic_actions;

CREATE POLICY "Users view own org actions"
  ON ic_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
    )
  );

DROP POLICY IF EXISTS "Users insert own org actions" ON ic_actions;

CREATE POLICY "Users insert own org actions"
  ON ic_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
    )
  );

DROP POLICY IF EXISTS "Users update own org actions" ON ic_actions;

CREATE POLICY "Users update own org actions"
  ON ic_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.organization_id = ic_actions.organization_id
        OR profiles.role = 'SUPER_ADMIN'
      )
    )
  );