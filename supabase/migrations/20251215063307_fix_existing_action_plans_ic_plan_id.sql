/*
  # Fix Existing Action Plans with Missing ic_plan_id

  1. Problem
    - Existing `ic_action_plans` records have null `ic_plan_id` values
    - This causes filtering issues when different IC plans are selected

  2. Solution
    - Update all existing action plans to link them with their organization's first active IC plan
    - If no active plan exists, create a default one for the organization

  3. Security
    - No RLS changes needed
*/

-- First, ensure all organizations have at least one IC plan
INSERT INTO ic_plans (organization_id, name, start_year, end_year, status, created_by)
SELECT DISTINCT
  o.id as organization_id,
  '2023-2024 İç Kontrol Eylem Planı' as name,
  2023 as start_year,
  2024 as end_year,
  'active' as status,
  (SELECT id FROM profiles WHERE organization_id = o.id AND role IN ('admin', 'super_admin') LIMIT 1) as created_by
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM ic_plans
  WHERE ic_plans.organization_id = o.id
)
AND o.id IS NOT NULL;

-- Update ic_action_plans with null ic_plan_id to use the organization's first active plan
UPDATE ic_action_plans
SET ic_plan_id = (
  SELECT id
  FROM ic_plans
  WHERE ic_plans.organization_id = ic_action_plans.organization_id
  AND ic_plans.status = 'active'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE ic_plan_id IS NULL
AND organization_id IS NOT NULL;

-- If still null (no active plan), use the first plan of any status
UPDATE ic_action_plans
SET ic_plan_id = (
  SELECT id
  FROM ic_plans
  WHERE ic_plans.organization_id = ic_action_plans.organization_id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE ic_plan_id IS NULL
AND organization_id IS NOT NULL;

-- Update ic_kiks_actions with null ic_plan_id
UPDATE ic_kiks_actions
SET ic_plan_id = (
  SELECT id
  FROM ic_plans
  WHERE ic_plans.organization_id = ic_kiks_actions.organization_id
  AND ic_plans.status = 'active'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE ic_plan_id IS NULL
AND organization_id IS NOT NULL;

-- If still null for ic_kiks_actions
UPDATE ic_kiks_actions
SET ic_plan_id = (
  SELECT id
  FROM ic_plans
  WHERE ic_plans.organization_id = ic_kiks_actions.organization_id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE ic_plan_id IS NULL
AND organization_id IS NOT NULL;
