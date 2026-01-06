/*
  # Kullanılmayan Modüllerin Kaldırılması

  Bu migration, frontend tarafında hiç kullanılmayan tablo ve modülleri temizler.
  
  1. Silinen Modüller
    - **Dış Denetim Modülü** (5 tablo)
      - external_audit_bodies
      - external_audit_corrective_actions
      - external_audit_correspondence
      - external_audit_documents
      - external_audit_responses
    
    - **İç Denetim Modülü** (6 tablo)
      - internal_audit_annual_plans
      - internal_audit_assignments
      - internal_audit_fieldwork
      - internal_audit_follow_ups
      - internal_audit_programs
      - internal_audit_universe
    
    - **Entegre Raporlama Sistemi** (5 tablo)
      - integrated_dashboards
      - integrated_dashboard_widgets
      - integrated_reports
      - integrated_report_sections
      - integrated_report_executions
    
    - **ISO/Kalite/Compliance Modülü** (4 tablo)
      - iso_standards
      - compliance_training
      - customer_satisfaction_surveys
      - cross_module_analytics
    
    - **Bütçe Sistemi Kullanılmayan Tabloları** (9 tablo)
      - budget_performance_activity_justifications
      - budget_performance_historical_data
      - budget_performance_program_information
      - budget_performance_program_mappings
      - budget_period_notifications
      - budget_period_transitions
      - budget_year_settings
      - multi_year_budget_entries
      - department_budget_limits
    
    - **İşbirliği Sistemi Kullanılmayan Tabloları** (2 tablo)
      - collaboration_plan_risks
      - collaboration_risk_controls
    
    - **Gösterge Sistemi Kullanılmayan Tabloları** (2 tablo)
      - indicator_comments
      - indicator_files
    
    - **Analiz Sistemi Kullanılmayan Tabloları** (3 tablo)
      - pestle_analysis_comments
      - swot_analysis_comments
      - pestle_swot_relations
    
    - **Raporlama Tabloları** (6 tablo)
      - report_activity_entries
      - report_attachments
      - report_budget_data
      - report_comments
      - report_performance_data
      - report_tables

  2. Güvenlik
    - CASCADE ile bağımlı nesneler de silinir
    - IF EXISTS ile hata önlenir
  
  Toplam: 42 tablo kaldırılıyor
*/

-- Dış Denetim Modülü
DROP TABLE IF EXISTS external_audit_responses CASCADE;
DROP TABLE IF EXISTS external_audit_documents CASCADE;
DROP TABLE IF EXISTS external_audit_correspondence CASCADE;
DROP TABLE IF EXISTS external_audit_corrective_actions CASCADE;
DROP TABLE IF EXISTS external_audit_bodies CASCADE;

-- İç Denetim Modülü
DROP TABLE IF EXISTS internal_audit_follow_ups CASCADE;
DROP TABLE IF EXISTS internal_audit_fieldwork CASCADE;
DROP TABLE IF EXISTS internal_audit_assignments CASCADE;
DROP TABLE IF EXISTS internal_audit_programs CASCADE;
DROP TABLE IF EXISTS internal_audit_annual_plans CASCADE;
DROP TABLE IF EXISTS internal_audit_universe CASCADE;

-- Entegre Raporlama Sistemi
DROP TABLE IF EXISTS integrated_report_executions CASCADE;
DROP TABLE IF EXISTS integrated_report_sections CASCADE;
DROP TABLE IF EXISTS integrated_reports CASCADE;
DROP TABLE IF EXISTS integrated_dashboard_widgets CASCADE;
DROP TABLE IF EXISTS integrated_dashboards CASCADE;

-- ISO/Kalite/Compliance Modülü
DROP TABLE IF EXISTS customer_satisfaction_surveys CASCADE;
DROP TABLE IF EXISTS compliance_training CASCADE;
DROP TABLE IF EXISTS cross_module_analytics CASCADE;
DROP TABLE IF EXISTS iso_standards CASCADE;

-- Bütçe Sistemi Kullanılmayan Tabloları
DROP TABLE IF EXISTS budget_performance_activity_justifications CASCADE;
DROP TABLE IF EXISTS budget_performance_historical_data CASCADE;
DROP TABLE IF EXISTS budget_performance_program_information CASCADE;
DROP TABLE IF EXISTS budget_performance_program_mappings CASCADE;
DROP TABLE IF EXISTS budget_period_notifications CASCADE;
DROP TABLE IF EXISTS budget_period_transitions CASCADE;
DROP TABLE IF EXISTS budget_year_settings CASCADE;
DROP TABLE IF EXISTS multi_year_budget_entries CASCADE;
DROP TABLE IF EXISTS department_budget_limits CASCADE;

-- İşbirliği Sistemi Kullanılmayan Tabloları
DROP TABLE IF EXISTS collaboration_risk_controls CASCADE;
DROP TABLE IF EXISTS collaboration_plan_risks CASCADE;

-- Gösterge Sistemi Kullanılmayan Tabloları
DROP TABLE IF EXISTS indicator_files CASCADE;
DROP TABLE IF EXISTS indicator_comments CASCADE;

-- Analiz Sistemi Kullanılmayan Tabloları
DROP TABLE IF EXISTS pestle_swot_relations CASCADE;
DROP TABLE IF EXISTS pestle_analysis_comments CASCADE;
DROP TABLE IF EXISTS swot_analysis_comments CASCADE;

-- Raporlama Tabloları
DROP TABLE IF EXISTS report_tables CASCADE;
DROP TABLE IF EXISTS report_performance_data CASCADE;
DROP TABLE IF EXISTS report_comments CASCADE;
DROP TABLE IF EXISTS report_budget_data CASCADE;
DROP TABLE IF EXISTS report_attachments CASCADE;
DROP TABLE IF EXISTS report_activity_entries CASCADE;