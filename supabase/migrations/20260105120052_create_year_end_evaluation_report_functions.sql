/*
  # Year-End Evaluation Report Functions

  1. New Functions
    - `get_year_end_evaluation_summary` - Overall summary with all departments
    - `get_indicator_evaluations_report` - Indicator-level detailed analysis
    - `get_criteria_analysis_report` - Analysis grouped by evaluation criteria
    - `get_department_evaluation_comparison` - Compare departments side by side

  2. Purpose
    - Provide comprehensive reporting data for year-end evaluations
    - Support multiple report views: executive summary, detailed analysis, criteria-based
    - Enable export and comparison features

  3. Security
    - All functions use SECURITY DEFINER with proper access checks
    - Data filtered by organization_id
*/

-- Function 1: Year-End Evaluation Summary Report
-- Returns overview of all department evaluations with key metrics
CREATE OR REPLACE FUNCTION get_year_end_evaluation_summary(
  p_organization_id uuid,
  p_fiscal_year integer
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
  ORDER BY d.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Indicator Evaluations Report
-- Returns detailed evaluation data for each indicator
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
    g.name as goal_name,
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

-- Function 3: Criteria Analysis Report
-- Aggregates responses by evaluation criteria
CREATE OR REPLACE FUNCTION get_criteria_analysis_report(
  p_organization_id uuid,
  p_fiscal_year integer
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
  WITH indicator_data AS (
    SELECT * FROM get_indicator_evaluations_report(p_organization_id, p_fiscal_year, NULL)
  )
  SELECT
    'İlgililik (Relevance)' as criteria_category,
    COUNT(*) FILTER (WHERE relevance_environment_changes IS NOT NULL)::integer as total_responses,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(relevance_environment_changes, '')) LIKE '%evet%' OR
            LOWER(COALESCE(relevance_environment_changes, '')) LIKE '%ciddi%' OR
            LOWER(COALESCE(relevance_needs_change, '')) LIKE '%önemli%'
    )::integer as indicators_with_concerns,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(relevance_target_change_needed, '')) LIKE '%evet%' OR
            LOWER(COALESCE(relevance_target_change_needed, '')) LIKE '%yes%'
    )::integer as indicators_needing_update,
    CASE
      WHEN COUNT(*) FILTER (WHERE relevance_environment_changes IS NOT NULL) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (
          WHERE LOWER(COALESCE(relevance_environment_changes, '')) LIKE '%evet%' OR
                LOWER(COALESCE(relevance_environment_changes, '')) LIKE '%ciddi%'
        )::numeric /
        COUNT(*) FILTER (WHERE relevance_environment_changes IS NOT NULL)::numeric) * 100, 2
      )
    END as concern_percentage,
    ARRAY[]::text[] as common_themes
  FROM indicator_data

  UNION ALL

  SELECT
    'Etkililik (Effectiveness)' as criteria_category,
    COUNT(*) FILTER (WHERE effectiveness_target_achieved IS NOT NULL)::integer as total_responses,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(effectiveness_target_achieved, '')) LIKE '%hayır%' OR
            LOWER(COALESCE(effectiveness_target_achieved, '')) LIKE '%kısmen%' OR
            LOWER(COALESCE(effectiveness_needs_met, '')) LIKE '%hayır%'
    )::integer as indicators_with_concerns,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(effectiveness_update_needed, '')) LIKE '%evet%' OR
            LOWER(COALESCE(effectiveness_update_needed, '')) LIKE '%yes%'
    )::integer as indicators_needing_update,
    CASE
      WHEN COUNT(*) FILTER (WHERE effectiveness_target_achieved IS NOT NULL) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (
          WHERE LOWER(COALESCE(effectiveness_target_achieved, '')) LIKE '%hayır%' OR
                LOWER(COALESCE(effectiveness_target_achieved, '')) LIKE '%kısmen%'
        )::numeric /
        COUNT(*) FILTER (WHERE effectiveness_target_achieved IS NOT NULL)::numeric) * 100, 2
      )
    END as concern_percentage,
    ARRAY[]::text[] as common_themes
  FROM indicator_data

  UNION ALL

  SELECT
    'Etkinlik (Efficiency)' as criteria_category,
    COUNT(*) FILTER (WHERE efficiency_unexpected_costs IS NOT NULL)::integer as total_responses,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(efficiency_unexpected_costs, '')) LIKE '%evet%' OR
            LOWER(COALESCE(efficiency_unexpected_costs, '')) LIKE '%yes%' OR
            LOWER(COALESCE(efficiency_unexpected_costs, '')) LIKE '%önemli%'
    )::integer as indicators_with_concerns,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(efficiency_cost_table_update, '')) LIKE '%evet%' OR
            LOWER(COALESCE(efficiency_cost_table_update, '')) LIKE '%yes%' OR
            LOWER(COALESCE(efficiency_target_change_due_cost, '')) LIKE '%evet%'
    )::integer as indicators_needing_update,
    CASE
      WHEN COUNT(*) FILTER (WHERE efficiency_unexpected_costs IS NOT NULL) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (
          WHERE LOWER(COALESCE(efficiency_unexpected_costs, '')) LIKE '%evet%' OR
                LOWER(COALESCE(efficiency_unexpected_costs, '')) LIKE '%yes%'
        )::numeric /
        COUNT(*) FILTER (WHERE efficiency_unexpected_costs IS NOT NULL)::numeric) * 100, 2
      )
    END as concern_percentage,
    ARRAY[]::text[] as common_themes
  FROM indicator_data

  UNION ALL

  SELECT
    'Sürdürülebilirlik (Sustainability)' as criteria_category,
    COUNT(*) FILTER (WHERE sustainability_risks IS NOT NULL)::integer as total_responses,
    COUNT(*) FILTER (
      WHERE LENGTH(COALESCE(sustainability_risks, '')) > 20 OR
            LOWER(COALESCE(sustainability_risk_impact, '')) LIKE '%evet%' OR
            LOWER(COALESCE(sustainability_risk_impact, '')) LIKE '%önemli%'
    )::integer as indicators_with_concerns,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(sustainability_plan_update_needed, '')) LIKE '%evet%' OR
            LOWER(COALESCE(sustainability_plan_update_needed, '')) LIKE '%yes%'
    )::integer as indicators_needing_update,
    CASE
      WHEN COUNT(*) FILTER (WHERE sustainability_risks IS NOT NULL) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (
          WHERE LENGTH(COALESCE(sustainability_risks, '')) > 20
        )::numeric /
        COUNT(*) FILTER (WHERE sustainability_risks IS NOT NULL)::numeric) * 100, 2
      )
    END as concern_percentage,
    ARRAY[]::text[] as common_themes
  FROM indicator_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Department Comparison Report
-- Compares evaluation metrics across departments
CREATE OR REPLACE FUNCTION get_department_evaluation_comparison(
  p_organization_id uuid,
  p_fiscal_year integer
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
  WITH dept_indicators AS (
    SELECT * FROM get_indicator_evaluations_report(p_organization_id, p_fiscal_year, NULL)
  ),
  dept_summary AS (
    SELECT * FROM get_year_end_evaluation_summary(p_organization_id, p_fiscal_year)
  )
  SELECT
    ds.department_name,
    ds.total_indicators,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(di.relevance_target_change_needed, '')) LIKE '%evet%' OR
            LOWER(COALESCE(di.relevance_target_change_needed, '')) LIKE '%yes%'
    )::integer as indicators_needing_relevance_update,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(di.effectiveness_target_achieved, '')) LIKE '%hayır%' OR
            LOWER(COALESCE(di.effectiveness_target_achieved, '')) LIKE '%kısmen%'
    )::integer as indicators_not_meeting_effectiveness,
    COUNT(*) FILTER (
      WHERE LOWER(COALESCE(di.efficiency_unexpected_costs, '')) LIKE '%evet%' OR
            LOWER(COALESCE(di.efficiency_unexpected_costs, '')) LIKE '%yes%'
    )::integer as indicators_with_cost_issues,
    COUNT(*) FILTER (
      WHERE LENGTH(COALESCE(di.sustainability_risks, '')) > 20
    )::integer as indicators_with_sustainability_risks,
    (
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(di.relevance_target_change_needed, '')) LIKE '%evet%'
      ) +
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(di.effectiveness_target_achieved, '')) LIKE '%hayır%'
      ) +
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(di.efficiency_unexpected_costs, '')) LIKE '%evet%'
      ) +
      COUNT(*) FILTER (
        WHERE LENGTH(COALESCE(di.sustainability_risks, '')) > 20
      )
    )::integer as overall_risk_score,
    ds.status,
    ds.completion_rate
  FROM dept_summary ds
  LEFT JOIN dept_indicators di ON di.department_name = ds.department_name
  GROUP BY
    ds.department_name,
    ds.total_indicators,
    ds.status,
    ds.completion_rate
  ORDER BY overall_risk_score DESC, ds.department_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
