/*
  # Create Risk Reporting Views and Functions

  1. New Views
    - `v_risk_summary`: Comprehensive risk summary with all related data
    - `v_risk_category_stats`: Aggregated statistics by risk category
    - `v_risk_owner_stats`: Risk statistics by owner
    - `v_control_effectiveness_stats`: Control effectiveness by risk
    - `v_risk_trend`: Risk score trends over time

  2. New Functions
    - `get_risk_matrix_data`: Returns data for risk matrix visualization
    - `get_risk_statistics`: Returns comprehensive statistics for dashboards
    - `get_risk_trend_data`: Returns trend data for charts
    - `calculate_risk_kpis`: Calculates key performance indicators

  3. Purpose
    - Fast report generation
    - Pre-aggregated data for dashboards
    - Consistent calculations across reports
    - Performance optimization
*/

-- Create comprehensive risk summary view
CREATE OR REPLACE VIEW v_risk_summary AS
SELECT 
  r.id,
  r.organization_id,
  r.ic_plan_id,
  r.risk_code,
  r.risk_title,
  r.risk_description,
  r.risk_category,
  r.inherent_likelihood,
  r.inherent_impact,
  r.inherent_score,
  r.residual_likelihood,
  r.residual_impact,
  r.residual_score,
  r.status,
  r.risk_owner_id,
  r.process_id,
  r.last_assessment_date,
  r.assessment_count,
  r.created_at,
  r.updated_at,
  
  -- Risk owner info
  p.full_name as risk_owner_name,
  p.email as risk_owner_email,
  d.name as department_name,
  
  -- Process info
  proc.name as process_name,
  proc.process_category,
  
  -- Calculated fields
  (r.inherent_score - r.residual_score) as risk_reduction,
  ROUND((r.inherent_score - r.residual_score)::numeric / NULLIF(r.inherent_score, 0) * 100, 2) as risk_reduction_pct,
  
  -- Risk levels
  CASE 
    WHEN r.inherent_score >= 20 THEN 'critical'
    WHEN r.inherent_score >= 15 THEN 'high'
    WHEN r.inherent_score >= 10 THEN 'medium'
    WHEN r.inherent_score >= 5 THEN 'low'
    ELSE 'very_low'
  END as inherent_level,
  
  CASE 
    WHEN r.residual_score >= 20 THEN 'critical'
    WHEN r.residual_score >= 15 THEN 'high'
    WHEN r.residual_score >= 10 THEN 'medium'
    WHEN r.residual_score >= 5 THEN 'low'
    ELSE 'very_low'
  END as residual_level,
  
  -- Control counts
  (SELECT COUNT(*) FROM ic_risk_control_links WHERE risk_id = r.id) as control_count,
  (SELECT COUNT(*) FROM ic_risk_control_links rcl 
   JOIN ic_controls c ON c.id = rcl.control_id 
   WHERE rcl.risk_id = r.id AND c.operating_effectiveness = 'effective') as effective_control_count,
  
  -- Finding counts
  (SELECT COUNT(*) FROM ic_findings WHERE risk_id = r.id) as finding_count,
  (SELECT COUNT(*) FROM ic_findings WHERE risk_id = r.id AND status != 'closed') as open_finding_count,
  
  -- Assessment info
  (SELECT assessment_date FROM ic_risk_assessments WHERE risk_id = r.id ORDER BY assessment_date DESC LIMIT 1) as latest_assessment_date,
  (SELECT assessment_type FROM ic_risk_assessments WHERE risk_id = r.id ORDER BY assessment_date DESC LIMIT 1) as latest_assessment_type,
  
  -- Appetite violation
  EXISTS(SELECT 1 FROM risk_appetite_violations WHERE risk_id = r.id AND status = 'active') as has_appetite_violation

FROM ic_risks r
LEFT JOIN profiles p ON p.id = r.risk_owner_id
LEFT JOIN departments d ON d.id = p.department_id
LEFT JOIN ic_processes proc ON proc.id = r.process_id;

-- Create risk category statistics view
CREATE OR REPLACE VIEW v_risk_category_stats AS
SELECT 
  organization_id,
  ic_plan_id,
  risk_category,
  COUNT(*) as total_risks,
  
  -- By inherent level
  COUNT(*) FILTER (WHERE inherent_score >= 20) as inherent_critical,
  COUNT(*) FILTER (WHERE inherent_score >= 15 AND inherent_score < 20) as inherent_high,
  COUNT(*) FILTER (WHERE inherent_score >= 10 AND inherent_score < 15) as inherent_medium,
  COUNT(*) FILTER (WHERE inherent_score < 10) as inherent_low,
  
  -- By residual level
  COUNT(*) FILTER (WHERE residual_score >= 20) as residual_critical,
  COUNT(*) FILTER (WHERE residual_score >= 15 AND residual_score < 20) as residual_high,
  COUNT(*) FILTER (WHERE residual_score >= 10 AND residual_score < 15) as residual_medium,
  COUNT(*) FILTER (WHERE residual_score < 10) as residual_low,
  
  -- Averages
  ROUND(AVG(inherent_score), 2) as avg_inherent_score,
  ROUND(AVG(residual_score), 2) as avg_residual_score,
  ROUND(AVG(inherent_score - residual_score), 2) as avg_risk_reduction,
  
  -- Status counts
  COUNT(*) FILTER (WHERE status = 'identified') as status_identified,
  COUNT(*) FILTER (WHERE status = 'assessed') as status_assessed,
  COUNT(*) FILTER (WHERE status = 'mitigating') as status_mitigating,
  COUNT(*) FILTER (WHERE status = 'monitored') as status_monitored,
  COUNT(*) FILTER (WHERE status = 'accepted') as status_accepted,
  COUNT(*) FILTER (WHERE status = 'closed') as status_closed

FROM ic_risks
GROUP BY organization_id, ic_plan_id, risk_category;

-- Create risk owner statistics view
CREATE OR REPLACE VIEW v_risk_owner_stats AS
SELECT 
  r.organization_id,
  r.ic_plan_id,
  r.risk_owner_id,
  p.full_name as risk_owner_name,
  d.name as department_name,
  
  COUNT(*) as total_risks,
  
  -- By level
  COUNT(*) FILTER (WHERE r.residual_score >= 15) as high_risks,
  COUNT(*) FILTER (WHERE r.residual_score >= 10 AND r.residual_score < 15) as medium_risks,
  COUNT(*) FILTER (WHERE r.residual_score < 10) as low_risks,
  
  -- Averages
  ROUND(AVG(r.residual_score), 2) as avg_residual_score,
  ROUND(AVG(r.inherent_score - r.residual_score), 2) as avg_risk_reduction,
  
  -- Assessment activity
  ROUND(AVG(r.assessment_count), 2) as avg_assessments,
  MAX(r.last_assessment_date) as latest_assessment,
  
  -- Issues
  SUM((SELECT COUNT(*) FROM ic_findings WHERE risk_id = r.id AND status != 'closed')) as open_findings,
  COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM risk_appetite_violations WHERE risk_id = r.id AND status = 'active')) as appetite_violations

FROM ic_risks r
LEFT JOIN profiles p ON p.id = r.risk_owner_id
LEFT JOIN departments d ON d.id = p.department_id
WHERE r.risk_owner_id IS NOT NULL
GROUP BY r.organization_id, r.ic_plan_id, r.risk_owner_id, p.full_name, d.name;

-- Create control effectiveness statistics view
CREATE OR REPLACE VIEW v_control_effectiveness_stats AS
SELECT 
  r.organization_id,
  r.ic_plan_id,
  r.id as risk_id,
  r.risk_code,
  r.risk_title,
  r.risk_category,
  
  COUNT(rcl.id) as total_controls,
  
  -- By control type
  COUNT(*) FILTER (WHERE rcl.control_type = 'preventive') as preventive_controls,
  COUNT(*) FILTER (WHERE rcl.control_type = 'detective') as detective_controls,
  COUNT(*) FILTER (WHERE rcl.control_type = 'corrective') as corrective_controls,
  
  -- By effectiveness
  COUNT(*) FILTER (WHERE c.operating_effectiveness = 'effective') as effective_controls,
  COUNT(*) FILTER (WHERE c.operating_effectiveness = 'partially_effective') as partially_effective_controls,
  COUNT(*) FILTER (WHERE c.operating_effectiveness = 'not_effective') as not_effective_controls,
  
  -- Averages
  ROUND(AVG(rcl.coverage_percentage), 2) as avg_coverage,
  
  -- Risk scores
  r.inherent_score,
  r.residual_score,
  (r.inherent_score - r.residual_score) as risk_reduction

FROM ic_risks r
LEFT JOIN ic_risk_control_links rcl ON rcl.risk_id = r.id
LEFT JOIN ic_controls c ON c.id = rcl.control_id
GROUP BY r.organization_id, r.ic_plan_id, r.id, r.risk_code, r.risk_title, r.risk_category, r.inherent_score, r.residual_score;

-- Function to get risk matrix data
CREATE OR REPLACE FUNCTION get_risk_matrix_data(
  p_organization_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_risk_type text DEFAULT 'residual'
)
RETURNS TABLE (
  likelihood integer,
  impact integer,
  risk_count integer,
  risk_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN p_risk_type = 'inherent' THEN r.inherent_likelihood ELSE r.residual_likelihood END as likelihood,
    CASE WHEN p_risk_type = 'inherent' THEN r.inherent_impact ELSE r.residual_impact END as impact,
    COUNT(*)::integer as risk_count,
    array_agg(r.id) as risk_ids
  FROM ic_risks r
  WHERE r.organization_id = p_organization_id
    AND (p_plan_id IS NULL OR r.ic_plan_id = p_plan_id)
  GROUP BY likelihood, impact
  ORDER BY likelihood DESC, impact DESC;
END;
$$;

-- Function to calculate comprehensive risk statistics
CREATE OR REPLACE FUNCTION get_risk_statistics(
  p_organization_id uuid,
  p_plan_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_risks', COUNT(*),
    'by_category', json_object_agg(
      risk_category,
      json_build_object(
        'count', category_count,
        'avg_inherent', avg_inherent,
        'avg_residual', avg_residual
      )
    ),
    'by_status', json_object_agg(
      status,
      status_count
    ),
    'by_level', json_build_object(
      'critical', COUNT(*) FILTER (WHERE residual_score >= 20),
      'high', COUNT(*) FILTER (WHERE residual_score >= 15 AND residual_score < 20),
      'medium', COUNT(*) FILTER (WHERE residual_score >= 10 AND residual_score < 15),
      'low', COUNT(*) FILTER (WHERE residual_score < 10)
    ),
    'averages', json_build_object(
      'inherent_score', ROUND(AVG(inherent_score), 2),
      'residual_score', ROUND(AVG(residual_score), 2),
      'risk_reduction', ROUND(AVG(inherent_score - residual_score), 2),
      'risk_reduction_pct', ROUND(AVG((inherent_score - residual_score)::numeric / NULLIF(inherent_score, 0) * 100), 2)
    ),
    'appetite_violations', (
      SELECT COUNT(*) FROM risk_appetite_violations rav
      WHERE rav.organization_id = p_organization_id 
        AND rav.status = 'active'
        AND (p_plan_id IS NULL OR rav.ic_plan_id = p_plan_id)
    ),
    'controls', json_build_object(
      'total', (SELECT COUNT(*) FROM ic_risk_control_links rcl JOIN ic_risks r ON r.id = rcl.risk_id WHERE r.organization_id = p_organization_id AND (p_plan_id IS NULL OR r.ic_plan_id = p_plan_id)),
      'effective', (SELECT COUNT(*) FROM ic_risk_control_links rcl JOIN ic_risks r ON r.id = rcl.risk_id JOIN ic_controls c ON c.id = rcl.control_id WHERE r.organization_id = p_organization_id AND (p_plan_id IS NULL OR r.ic_plan_id = p_plan_id) AND c.operating_effectiveness = 'effective')
    ),
    'findings', json_build_object(
      'total', (SELECT COUNT(*) FROM ic_findings f JOIN ic_risks r ON r.id = f.risk_id WHERE r.organization_id = p_organization_id AND (p_plan_id IS NULL OR r.ic_plan_id = p_plan_id)),
      'open', (SELECT COUNT(*) FROM ic_findings f JOIN ic_risks r ON r.id = f.risk_id WHERE r.organization_id = p_organization_id AND (p_plan_id IS NULL OR r.ic_plan_id = p_plan_id) AND f.status != 'closed')
    )
  )
  INTO v_result
  FROM (
    SELECT 
      risk_category,
      COUNT(*) as category_count,
      ROUND(AVG(inherent_score), 2) as avg_inherent,
      ROUND(AVG(residual_score), 2) as avg_residual,
      status,
      COUNT(*) as status_count,
      inherent_score,
      residual_score
    FROM ic_risks
    WHERE organization_id = p_organization_id
      AND (p_plan_id IS NULL OR ic_plan_id = p_plan_id)
    GROUP BY risk_category, status, inherent_score, residual_score
  ) stats;
  
  RETURN v_result;
END;
$$;

-- Function to get risk trend data
CREATE OR REPLACE FUNCTION get_risk_trend_data(
  p_organization_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_risk_id uuid DEFAULT NULL,
  p_months integer DEFAULT 12
)
RETURNS TABLE (
  assessment_month date,
  avg_inherent_score numeric,
  avg_residual_score numeric,
  total_assessments bigint,
  critical_risks bigint,
  high_risks bigint,
  medium_risks bigint,
  low_risks bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', ra.assessment_date)::date as assessment_month,
    ROUND(AVG(ra.inherent_score), 2) as avg_inherent_score,
    ROUND(AVG(ra.residual_score), 2) as avg_residual_score,
    COUNT(*) as total_assessments,
    COUNT(*) FILTER (WHERE ra.residual_score >= 20) as critical_risks,
    COUNT(*) FILTER (WHERE ra.residual_score >= 15 AND ra.residual_score < 20) as high_risks,
    COUNT(*) FILTER (WHERE ra.residual_score >= 10 AND ra.residual_score < 15) as medium_risks,
    COUNT(*) FILTER (WHERE ra.residual_score < 10) as low_risks
  FROM ic_risk_assessments ra
  JOIN ic_risks r ON r.id = ra.risk_id
  WHERE ra.organization_id = p_organization_id
    AND (p_plan_id IS NULL OR r.ic_plan_id = p_plan_id)
    AND (p_risk_id IS NULL OR ra.risk_id = p_risk_id)
    AND ra.assessment_date >= CURRENT_DATE - (p_months || ' months')::interval
  GROUP BY assessment_month
  ORDER BY assessment_month DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_risk_matrix_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_risk_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_risk_trend_data TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_risk_assessments_org_date ON ic_risk_assessments(organization_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_risks_org_plan ON ic_risks(organization_id, ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_risks_category_status ON ic_risks(risk_category, status);
CREATE INDEX IF NOT EXISTS idx_risks_scores ON ic_risks(inherent_score, residual_score);
