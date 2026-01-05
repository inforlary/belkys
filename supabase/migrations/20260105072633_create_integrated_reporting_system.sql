/*
  # Integrated Reporting System (Entegre Raporlama Sistemi)

  ## Overview
  Comprehensive reporting system that integrates all modules:
  - Strategic Planning & Performance
  - Risk Management
  - Internal Control
  - Quality Management
  - Internal & External Audit
  - Budget & Finance
  - Compliance & Legal
  - Continuous Improvement

  ## New Tables
  1. integrated_reports - Master report definitions
  2. integrated_report_sections - Report sections linking to different modules
  3. integrated_report_executions - Report execution history
  4. integrated_dashboards - Custom dashboard definitions
  5. integrated_dashboard_widgets - Dashboard widgets configuration
  6. system_health_metrics - Overall system health monitoring
  7. cross_module_analytics - Cross-module analytical views

  ## Features
  - Automated report generation
  - Scheduled reporting
  - Multi-module data aggregation
  - Executive summaries
  - Drill-down capability

  ## Security
  RLS enabled with role-based access
*/

CREATE TABLE IF NOT EXISTS integrated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  report_name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('strategic', 'operational', 'compliance', 'financial', 'executive', 'board', 'regulatory', 'custom')),
  description text,
  report_frequency text NOT NULL CHECK (report_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'on_demand')),
  target_audience text NOT NULL CHECK (target_audience IN ('board', 'executive', 'management', 'department', 'external', 'regulatory')),
  modules_included jsonb DEFAULT '[]'::jsonb,
  template_config jsonb DEFAULT '{}'::jsonb,
  auto_generate boolean DEFAULT false,
  next_generation_date date,
  last_generated_at timestamptz,
  distribution_list jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, report_code)
);

CREATE TABLE IF NOT EXISTS integrated_report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integrated_report_id uuid NOT NULL REFERENCES integrated_reports(id) ON DELETE CASCADE,
  section_order integer NOT NULL,
  section_title text NOT NULL,
  section_type text NOT NULL CHECK (section_type IN ('text', 'table', 'chart', 'kpi', 'list', 'summary', 'comparison', 'trend')),
  data_source_module text NOT NULL CHECK (data_source_module IN ('strategic_planning', 'risk_management', 'internal_control', 'quality', 'internal_audit', 'external_audit', 'budget', 'compliance', 'improvement')),
  data_source_query text,
  data_source_view text,
  aggregation_method text CHECK (aggregation_method IN ('sum', 'average', 'count', 'min', 'max', 'percentage', 'custom')),
  visualization_config jsonb DEFAULT '{}'::jsonb,
  filters jsonb DEFAULT '{}'::jsonb,
  is_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integrated_report_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integrated_report_id uuid NOT NULL REFERENCES integrated_reports(id) ON DELETE CASCADE,
  execution_code text NOT NULL,
  execution_date date NOT NULL,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'distributed')),
  execution_duration_seconds integer,
  report_data jsonb DEFAULT '{}'::jsonb,
  file_path text,
  file_size_kb numeric,
  error_message text,
  generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  distributed_at timestamptz,
  recipients jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, execution_code)
);

CREATE TABLE IF NOT EXISTS integrated_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dashboard_code text NOT NULL,
  dashboard_name text NOT NULL,
  dashboard_type text NOT NULL CHECK (dashboard_type IN ('executive', 'strategic', 'operational', 'risk', 'compliance', 'quality', 'audit', 'financial', 'departmental')),
  description text,
  target_role text CHECK (target_role IN ('admin', 'director', 'vice_president', 'auditor', 'quality_manager', 'user')),
  refresh_frequency_minutes integer DEFAULT 60,
  layout_config jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  is_public boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, dashboard_code)
);

CREATE TABLE IF NOT EXISTS integrated_dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES integrated_dashboards(id) ON DELETE CASCADE,
  widget_code text NOT NULL,
  widget_title text NOT NULL,
  widget_type text NOT NULL CHECK (widget_type IN ('kpi_card', 'line_chart', 'bar_chart', 'pie_chart', 'table', 'list', 'heatmap', 'gauge', 'trend', 'alert')),
  data_source_module text NOT NULL CHECK (data_source_module IN ('strategic_planning', 'risk_management', 'internal_control', 'quality', 'internal_audit', 'external_audit', 'budget', 'compliance', 'improvement', 'custom')),
  data_source_type text NOT NULL CHECK (data_source_type IN ('view', 'query', 'function', 'aggregation')),
  data_source text NOT NULL,
  parameters jsonb DEFAULT '{}'::jsonb,
  visualization_config jsonb DEFAULT '{}'::jsonb,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 4,
  height integer NOT NULL DEFAULT 3,
  refresh_interval_seconds integer DEFAULT 300,
  alert_threshold numeric,
  alert_condition text CHECK (alert_condition IN ('above', 'below', 'equal', 'not_equal')),
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  measurement_date date NOT NULL,
  measurement_time timestamptz NOT NULL DEFAULT now(),
  
  strategic_planning_score numeric CHECK (strategic_planning_score >= 0 AND strategic_planning_score <= 100),
  goals_on_track_percentage numeric,
  indicators_reported_percentage numeric,
  
  risk_management_score numeric CHECK (risk_management_score >= 0 AND risk_management_score <= 100),
  risks_within_appetite_percentage numeric,
  high_risks_with_controls_percentage numeric,
  
  internal_control_score numeric CHECK (internal_control_score >= 0 AND internal_control_score <= 100),
  controls_effective_percentage numeric,
  kiks_compliance_percentage numeric,
  
  quality_management_score numeric CHECK (quality_management_score >= 0 AND quality_management_score <= 100),
  quality_objectives_achieved_percentage numeric,
  customer_satisfaction_score numeric,
  
  audit_compliance_score numeric CHECK (audit_compliance_score >= 0 AND audit_compliance_score <= 100),
  audit_findings_closed_percentage numeric,
  recommendations_implemented_percentage numeric,
  
  legal_compliance_score numeric CHECK (legal_compliance_score >= 0 AND legal_compliance_score <= 100),
  compliance_requirements_met_percentage numeric,
  violations_count integer DEFAULT 0,
  
  budget_performance_score numeric CHECK (budget_performance_score >= 0 AND budget_performance_score <= 100),
  budget_utilization_percentage numeric,
  budget_variance_percentage numeric,
  
  overall_system_health_score numeric CHECK (overall_system_health_score >= 0 AND overall_system_health_score <= 100),
  
  data_quality_score numeric CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  user_engagement_score numeric CHECK (user_engagement_score >= 0 AND user_engagement_score <= 100),
  
  notes text,
  calculated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cross_module_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  analysis_code text NOT NULL,
  analysis_title text NOT NULL,
  analysis_type text NOT NULL CHECK (analysis_type IN ('correlation', 'trend', 'gap', 'efficiency', 'effectiveness', 'impact', 'custom')),
  modules_analyzed jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  analysis_description text,
  methodology text,
  data_sources jsonb DEFAULT '[]'::jsonb,
  analysis_period_start date NOT NULL,
  analysis_period_end date NOT NULL,
  
  key_findings text,
  insights text,
  correlations_identified text,
  anomalies_detected text,
  trends_observed text,
  
  recommendations text,
  action_items jsonb DEFAULT '[]'::jsonb,
  
  visualizations jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  
  analyzed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'published')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, analysis_code)
);

-- Create indexes

CREATE INDEX IF NOT EXISTS idx_integrated_reports_org ON integrated_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrated_reports_active ON integrated_reports(is_active, next_generation_date);
CREATE INDEX IF NOT EXISTS idx_report_sections_report ON integrated_report_sections(integrated_report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_org ON integrated_report_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_report ON integrated_report_executions(integrated_report_id);
CREATE INDEX IF NOT EXISTS idx_integrated_dashboards_org ON integrated_dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON integrated_dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_system_health_org_date ON system_health_metrics(organization_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_cross_module_analytics_org ON cross_module_analytics(organization_id, budget_period_id);

-- Enable RLS

ALTER TABLE integrated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrated_report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrated_report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrated_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrated_dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_module_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies

CREATE POLICY "org_select_integrated_reports" ON integrated_reports FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_integrated_reports" ON integrated_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = integrated_reports.organization_id AND role IN ('admin', 'director', 'vice_president')));

CREATE POLICY "org_select_report_sections" ON integrated_report_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM integrated_reports ir JOIN profiles pr ON pr.organization_id = ir.organization_id WHERE ir.id = integrated_report_sections.integrated_report_id AND pr.id = auth.uid()));

CREATE POLICY "admin_all_report_sections" ON integrated_report_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM integrated_reports ir JOIN profiles pr ON pr.organization_id = ir.organization_id WHERE ir.id = integrated_report_sections.integrated_report_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'director')));

CREATE POLICY "org_select_report_executions" ON integrated_report_executions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_report_executions" ON integrated_report_executions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = integrated_report_executions.organization_id AND role IN ('admin', 'director')));

CREATE POLICY "org_select_dashboards" ON integrated_dashboards FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_dashboards" ON integrated_dashboards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = integrated_dashboards.organization_id AND role IN ('admin', 'director')));

CREATE POLICY "org_select_dashboard_widgets" ON integrated_dashboard_widgets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM integrated_dashboards d JOIN profiles pr ON pr.organization_id = d.organization_id WHERE d.id = integrated_dashboard_widgets.dashboard_id AND pr.id = auth.uid()));

CREATE POLICY "admin_all_dashboard_widgets" ON integrated_dashboard_widgets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM integrated_dashboards d JOIN profiles pr ON pr.organization_id = d.organization_id WHERE d.id = integrated_dashboard_widgets.dashboard_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'director')));

CREATE POLICY "org_select_system_health" ON system_health_metrics FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_system_health" ON system_health_metrics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = system_health_metrics.organization_id AND role IN ('admin', 'director')));

CREATE POLICY "org_select_cross_analytics" ON cross_module_analytics FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_cross_analytics" ON cross_module_analytics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = cross_module_analytics.organization_id AND role IN ('admin', 'director', 'vice_president')));

-- Auto-code generation

CREATE OR REPLACE FUNCTION generate_integrated_report_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM integrated_reports WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.report_code := org_code || '-IR-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_integrated_report_code BEFORE INSERT ON integrated_reports FOR EACH ROW WHEN (NEW.report_code IS NULL OR NEW.report_code = '') EXECUTE FUNCTION generate_integrated_report_code();

CREATE OR REPLACE FUNCTION generate_report_execution_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text; report_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM integrated_report_executions WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  SELECT ir.report_code INTO report_code FROM integrated_reports ir WHERE ir.id = NEW.integrated_report_id;
  NEW.execution_code := report_code || '-EXE-' || TO_CHAR(NEW.created_at, 'YYYYMMDD') || '-' || LPAD(next_num::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_report_execution_code BEFORE INSERT ON integrated_report_executions FOR EACH ROW WHEN (NEW.execution_code IS NULL OR NEW.execution_code = '') EXECUTE FUNCTION generate_report_execution_code();

CREATE OR REPLACE FUNCTION generate_dashboard_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM integrated_dashboards WHERE organization_id = NEW.organization_id;
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.dashboard_code := org_code || '-DB-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_dashboard_code BEFORE INSERT ON integrated_dashboards FOR EACH ROW WHEN (NEW.dashboard_code IS NULL OR NEW.dashboard_code = '') EXECUTE FUNCTION generate_dashboard_code();

CREATE OR REPLACE FUNCTION generate_analytics_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM cross_module_analytics WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.analysis_code := org_code || '-AN-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_analytics_code BEFORE INSERT ON cross_module_analytics FOR EACH ROW WHEN (NEW.analysis_code IS NULL OR NEW.analysis_code = '') EXECUTE FUNCTION generate_analytics_code();