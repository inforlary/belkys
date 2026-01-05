/*
  # Add Department Filter to Year-End Report Functions
  
  1. Changes
    - Add optional p_department_id parameter to all report functions
    - Allow users and directors to view their department's reports
    - Admin and VP can view all departments (pass NULL)
  
  2. Security
    - Functions remain SECURITY DEFINER
    - Department filtering applied consistently
*/

-- Update get_year_end_evaluation_summary to accept department_id
CREATE OR REPLACE FUNCTION get_year_end_evaluation_summary(
  p_organization_id uuid,
  p_fiscal_year integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  department_id uuid,
  department_name text,
  evaluation_id uuid,
  status text,
  submitted_at timestamptz,
  director_approved_at timestamptz,
  admin_approved_at timestamptz,
  general_performance_summary text,
  achievements text,
  challenges text,
  recommendations text,
  director_comments text,
  admin_comments text,
  total_indicators integer,
  completed_indicator_evaluations integer,
  completion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as department_id,
    d.name as department_name,
    ye.id as evaluation_id,
    ye.status,
    ye.submitted_at,
    ye.director_approved_at,
    ye.admin_approved_at,
    ye.general_performance_summary,
    ye.achievements,
    ye.challenges,
    ye.recommendations,
    ye.director_comments,
    ye.admin_comments,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicators i
      INNER JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = d.id
      AND g.organization_id = p_organization_id
    ), 0) as total_indicators,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicator_year_evaluations iye
      WHERE iye.year_end_evaluation_id = ye.id
      AND (
        iye.relevance_environment_changes IS NOT NULL OR
        iye.effectiveness_target_achieved IS NOT NULL OR
        iye.efficiency_unexpected_costs IS NOT NULL OR
        iye.sustainability_risks IS NOT NULL
      )
    ), 0) as completed_indicator_evaluations,
    CASE
      WHEN COALESCE((
        SELECT COUNT(*)
        FROM indicators i
        INNER JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = d.id
        AND g.organization_id = p_organization_id
      ), 0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE((
          SELECT COUNT(*)
          FROM indicator_year_evaluations iye
          WHERE iye.year_end_evaluation_id = ye.id
          AND (
            iye.relevance_environment_changes IS NOT NULL OR
            iye.effectiveness_target_achieved IS NOT NULL OR
            iye.efficiency_unexpected_costs IS NOT NULL OR
            iye.sustainability_risks IS NOT NULL
          )
        ), 0)::numeric /
        COALESCE((
          SELECT COUNT(*)
          FROM indicators i
          INNER JOIN goals g ON i.goal_id = g.id
          WHERE g.department_id = d.id
          AND g.organization_id = p_organization_id
        ), 1)::numeric) * 100, 2
      )
    END as completion_rate
  FROM departments d
  LEFT JOIN year_end_evaluations ye
    ON ye.department_id = d.id
    AND ye.fiscal_year = p_fiscal_year
  WHERE d.organization_id = p_organization_id
  AND (p_department_id IS NULL OR d.id = p_department_id)
  ORDER BY d.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_criteria_analysis_report to accept department_id
CREATE OR REPLACE FUNCTION get_criteria_analysis_report(
  p_organization_id uuid,
  p_fiscal_year integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  criteria_category text,
  total_responses integer,
  indicators_with_concerns integer,
  indicators_needing_update integer,
  concern_percentage numeric,
  common_themes text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH relevance_analysis AS (
    SELECT
      'İlgililik (Relevance)' as criteria,
      COUNT(DISTINCT iye.indicator_id)::integer as total_resp,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.relevance_needs_change, '')) LIKE '%önemli%' OR
             LOWER(COALESCE(iye.relevance_needs_change, '')) LIKE '%ciddi%'
        THEN iye.indicator_id
      END)::integer as concerns,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%evet%' OR
             LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%yes%'
        THEN iye.indicator_id
      END)::integer as updates
    FROM indicator_year_evaluations iye
    INNER JOIN year_end_evaluations ye ON iye.year_end_evaluation_id = ye.id
    INNER JOIN indicators i ON iye.indicator_id = i.id
    INNER JOIN goals g ON i.goal_id = g.id
    INNER JOIN departments d ON g.department_id = d.id
    WHERE ye.organization_id = p_organization_id
    AND ye.fiscal_year = p_fiscal_year
    AND (p_department_id IS NULL OR d.id = p_department_id)
  ),
  effectiveness_analysis AS (
    SELECT
      'Etkililik (Effectiveness)' as criteria,
      COUNT(DISTINCT iye.indicator_id)::integer as total_resp,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.effectiveness_target_achieved, '')) LIKE '%hayır%' OR
             LOWER(COALESCE(iye.effectiveness_target_achieved, '')) LIKE '%kısmen%' OR
             LOWER(COALESCE(iye.effectiveness_needs_met, '')) LIKE '%hayır%'
        THEN iye.indicator_id
      END)::integer as concerns,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.effectiveness_update_needed, '')) LIKE '%evet%' OR
             LOWER(COALESCE(iye.effectiveness_update_needed, '')) LIKE '%yes%'
        THEN iye.indicator_id
      END)::integer as updates
    FROM indicator_year_evaluations iye
    INNER JOIN year_end_evaluations ye ON iye.year_end_evaluation_id = ye.id
    INNER JOIN indicators i ON iye.indicator_id = i.id
    INNER JOIN goals g ON i.goal_id = g.id
    INNER JOIN departments d ON g.department_id = d.id
    WHERE ye.organization_id = p_organization_id
    AND ye.fiscal_year = p_fiscal_year
    AND (p_department_id IS NULL OR d.id = p_department_id)
  ),
  efficiency_analysis AS (
    SELECT
      'Etkinlik (Efficiency)' as criteria,
      COUNT(DISTINCT iye.indicator_id)::integer as total_resp,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.efficiency_unexpected_costs, '')) LIKE '%evet%' OR
             LOWER(COALESCE(iye.efficiency_unexpected_costs, '')) LIKE '%yes%'
        THEN iye.indicator_id
      END)::integer as concerns,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.efficiency_cost_table_update, '')) LIKE '%evet%' OR
             LOWER(COALESCE(iye.efficiency_cost_table_update, '')) LIKE '%yes%'
        THEN iye.indicator_id
      END)::integer as updates
    FROM indicator_year_evaluations iye
    INNER JOIN year_end_evaluations ye ON iye.year_end_evaluation_id = ye.id
    INNER JOIN indicators i ON iye.indicator_id = i.id
    INNER JOIN goals g ON i.goal_id = g.id
    INNER JOIN departments d ON g.department_id = d.id
    WHERE ye.organization_id = p_organization_id
    AND ye.fiscal_year = p_fiscal_year
    AND (p_department_id IS NULL OR d.id = p_department_id)
  ),
  sustainability_analysis AS (
    SELECT
      'Sürdürülebilirlik (Sustainability)' as criteria,
      COUNT(DISTINCT iye.indicator_id)::integer as total_resp,
      COUNT(DISTINCT CASE
        WHEN iye.sustainability_risks IS NOT NULL AND LENGTH(iye.sustainability_risks) > 10
        THEN iye.indicator_id
      END)::integer as concerns,
      COUNT(DISTINCT CASE
        WHEN LOWER(COALESCE(iye.sustainability_plan_update_needed, '')) LIKE '%evet%' OR
             LOWER(COALESCE(iye.sustainability_plan_update_needed, '')) LIKE '%yes%'
        THEN iye.indicator_id
      END)::integer as updates
    FROM indicator_year_evaluations iye
    INNER JOIN year_end_evaluations ye ON iye.year_end_evaluation_id = ye.id
    INNER JOIN indicators i ON iye.indicator_id = i.id
    INNER JOIN goals g ON i.goal_id = g.id
    INNER JOIN departments d ON g.department_id = d.id
    WHERE ye.organization_id = p_organization_id
    AND ye.fiscal_year = p_fiscal_year
    AND (p_department_id IS NULL OR d.id = p_department_id)
  )
  SELECT
    criteria as criteria_category,
    total_resp as total_responses,
    concerns as indicators_with_concerns,
    updates as indicators_needing_update,
    CASE
      WHEN total_resp = 0 THEN 0
      ELSE ROUND((concerns::numeric / total_resp::numeric) * 100, 2)
    END as concern_percentage,
    ARRAY[]::text[] as common_themes
  FROM relevance_analysis
  UNION ALL
  SELECT
    criteria, total_resp, concerns, updates,
    CASE WHEN total_resp = 0 THEN 0
         ELSE ROUND((concerns::numeric / total_resp::numeric) * 100, 2) END,
    ARRAY[]::text[]
  FROM effectiveness_analysis
  UNION ALL
  SELECT
    criteria, total_resp, concerns, updates,
    CASE WHEN total_resp = 0 THEN 0
         ELSE ROUND((concerns::numeric / total_resp::numeric) * 100, 2) END,
    ARRAY[]::text[]
  FROM efficiency_analysis
  UNION ALL
  SELECT
    criteria, total_resp, concerns, updates,
    CASE WHEN total_resp = 0 THEN 0
         ELSE ROUND((concerns::numeric / total_resp::numeric) * 100, 2) END,
    ARRAY[]::text[]
  FROM sustainability_analysis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_department_evaluation_comparison to accept department_id
CREATE OR REPLACE FUNCTION get_department_evaluation_comparison(
  p_organization_id uuid,
  p_fiscal_year integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  department_name text,
  total_indicators integer,
  indicators_needing_relevance_update integer,
  indicators_not_meeting_effectiveness integer,
  indicators_with_cost_issues integer,
  indicators_with_sustainability_risks integer,
  overall_risk_score integer,
  status text,
  completion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.name as department_name,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicators i
      INNER JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = d.id
    ), 0) as total_indicators,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicator_year_evaluations iye
      INNER JOIN indicators i ON iye.indicator_id = i.id
      INNER JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = d.id
      AND iye.year_end_evaluation_id = ye.id
      AND (
        LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%evet%' OR
        LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%yes%'
      )
    ), 0) as indicators_needing_relevance_update,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicator_year_evaluations iye
      INNER JOIN indicators i ON iye.indicator_id = i.id
      INNER JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = d.id
      AND iye.year_end_evaluation_id = ye.id
      AND (
        LOWER(COALESCE(iye.effectiveness_target_achieved, '')) LIKE '%hayır%' OR
        LOWER(COALESCE(iye.effectiveness_needs_met, '')) LIKE '%hayır%'
      )
    ), 0) as indicators_not_meeting_effectiveness,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicator_year_evaluations iye
      INNER JOIN indicators i ON iye.indicator_id = i.id
      INNER JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = d.id
      AND iye.year_end_evaluation_id = ye.id
      AND (
        LOWER(COALESCE(iye.efficiency_unexpected_costs, '')) LIKE '%evet%' OR
        LOWER(COALESCE(iye.efficiency_unexpected_costs, '')) LIKE '%yes%'
      )
    ), 0) as indicators_with_cost_issues,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM indicator_year_evaluations iye
      INNER JOIN indicators i ON iye.indicator_id = i.id
      INNER JOIN goals g ON i.goal_id = g.id
      WHERE g.department_id = d.id
      AND iye.year_end_evaluation_id = ye.id
      AND (
        iye.sustainability_risks IS NOT NULL AND LENGTH(iye.sustainability_risks) > 10
      )
    ), 0) as indicators_with_sustainability_risks,
    (
      COALESCE((SELECT COUNT(*) FROM indicator_year_evaluations iye
        INNER JOIN indicators i ON iye.indicator_id = i.id
        INNER JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = d.id AND iye.year_end_evaluation_id = ye.id
        AND LOWER(COALESCE(iye.relevance_target_change_needed, '')) LIKE '%evet%'), 0) +
      COALESCE((SELECT COUNT(*) FROM indicator_year_evaluations iye
        INNER JOIN indicators i ON iye.indicator_id = i.id
        INNER JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = d.id AND iye.year_end_evaluation_id = ye.id
        AND LOWER(COALESCE(iye.effectiveness_target_achieved, '')) LIKE '%hayır%'), 0) +
      COALESCE((SELECT COUNT(*) FROM indicator_year_evaluations iye
        INNER JOIN indicators i ON iye.indicator_id = i.id
        INNER JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = d.id AND iye.year_end_evaluation_id = ye.id
        AND LOWER(COALESCE(iye.efficiency_unexpected_costs, '')) LIKE '%evet%'), 0) +
      COALESCE((SELECT COUNT(*) FROM indicator_year_evaluations iye
        INNER JOIN indicators i ON iye.indicator_id = i.id
        INNER JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = d.id AND iye.year_end_evaluation_id = ye.id
        AND iye.sustainability_risks IS NOT NULL), 0)
    )::integer as overall_risk_score,
    COALESCE(ye.status, 'draft') as status,
    CASE
      WHEN COALESCE((
        SELECT COUNT(*) FROM indicators i
        INNER JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = d.id
      ), 0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE((
          SELECT COUNT(*)
          FROM indicator_year_evaluations iye
          WHERE iye.year_end_evaluation_id = ye.id
          AND (
            iye.relevance_environment_changes IS NOT NULL OR
            iye.effectiveness_target_achieved IS NOT NULL
          )
        ), 0)::numeric /
        COALESCE((
          SELECT COUNT(*)
          FROM indicators i
          INNER JOIN goals g ON i.goal_id = g.id
          WHERE g.department_id = d.id
        ), 1)::numeric) * 100, 2
      )
    END as completion_rate
  FROM departments d
  LEFT JOIN year_end_evaluations ye
    ON ye.department_id = d.id
    AND ye.fiscal_year = p_fiscal_year
  WHERE d.organization_id = p_organization_id
  AND (p_department_id IS NULL OR d.id = p_department_id)
  ORDER BY d.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
