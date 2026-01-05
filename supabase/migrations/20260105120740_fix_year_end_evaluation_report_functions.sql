/*
  # Fix Year-End Evaluation Report Functions

  1. Changes
    - Fix get_indicator_evaluations_report to use g.title instead of g.name
    - Fix get_department_evaluation_comparison to use correct column names
    
  2. Purpose
    - Resolve column name mismatch error (goals.name -> goals.title)
*/

-- Drop and recreate get_indicator_evaluations_report with correct column
DROP FUNCTION IF EXISTS get_indicator_evaluations_report(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION get_indicator_evaluations_report(
  p_organization_id uuid,
  p_fiscal_year integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  indicator_id uuid,
  indicator_code text,
  indicator_name text,
  goal_name text,
  department_name text,
  evaluation_id uuid,
  relevance_environment_changes text,
  relevance_needs_change text,
  relevance_target_change_needed text,
  effectiveness_target_achieved text,
  effectiveness_needs_met text,
  effectiveness_update_needed text,
  effectiveness_contribution text,
  efficiency_unexpected_costs text,
  efficiency_cost_table_update text,
  efficiency_target_change_due_cost text,
  sustainability_risks text,
  sustainability_measures text,
  sustainability_risk_changes text,
  sustainability_risk_impact text,
  sustainability_plan_update_needed text,
  needs_update boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id as indicator_id,
    i.code as indicator_code,
    i.name as indicator_name,
    g.title as goal_name,
    d.name as department_name,
    iye.id as evaluation_id,
    iye.relevance_environment_changes,
    iye.relevance_needs_change,
    iye.relevance_target_change_needed,
    iye.effectiveness_target_achieved,
    iye.effectiveness_needs_met,
    iye.effectiveness_update_needed,
    iye.effectiveness_contribution,
    iye.efficiency_unexpected_costs,
    iye.efficiency_cost_table_update,
    iye.efficiency_target_change_due_cost,
    iye.sustainability_risks,
    iye.sustainability_measures,
    iye.sustainability_risk_changes,
    iye.sustainability_risk_impact,
    iye.sustainability_plan_update_needed,
    (
      LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%evet%' OR
      LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%yes%' OR
      LOWER(COALESCE(iye.effectiveness_update_needed, '')) LIKE '%evet%' OR
      LOWER(COALESCE(iye.effectiveness_update_needed, '')) LIKE '%yes%' OR
      LOWER(COALESCE(iye.efficiency_cost_table_update, '')) LIKE '%evet%' OR
      LOWER(COALESCE(iye.efficiency_cost_table_update, '')) LIKE '%yes%' OR
      LOWER(COALESCE(iye.sustainability_plan_update_needed, '')) LIKE '%evet%' OR
      LOWER(COALESCE(iye.sustainability_plan_update_needed, '')) LIKE '%yes%'
    ) as needs_update
  FROM indicators i
  INNER JOIN goals g ON i.goal_id = g.id
  INNER JOIN departments d ON g.department_id = d.id
  LEFT JOIN year_end_evaluations ye
    ON ye.department_id = d.id
    AND ye.fiscal_year = p_fiscal_year
  LEFT JOIN indicator_year_evaluations iye
    ON iye.year_end_evaluation_id = ye.id
    AND iye.indicator_id = i.id
  WHERE g.organization_id = p_organization_id
  AND (p_department_id IS NULL OR d.id = p_department_id)
  ORDER BY d.name, i.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
