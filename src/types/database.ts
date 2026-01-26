export interface Department {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'director' | 'user' | 'vice_president' | 'president';
  is_super_admin?: boolean;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  subdomain?: string;
  logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active?: boolean;
  max_users?: number;
  created_at: string;
  updated_at: string;
}

export interface SuperAdminActivityLog {
  id: string;
  super_admin_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface IndicatorTarget {
  id: string;
  indicator_id: string;
  year: number;
  target_value: number | null;
  actual_value: number | null;
  quarter_1_value: number | null;
  quarter_2_value: number | null;
  quarter_3_value: number | null;
  quarter_4_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflow {
  id: string;
  entity_type: 'strategic_plan' | 'objective' | 'goal' | 'indicator' | 'activity';
  entity_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  reviewed_by: string | null;
  comments: string | null;
  requested_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignment {
  id: string;
  activity_id: string;
  assigned_to: string;
  assigned_by: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export type MeasurementFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export interface Collaboration {
  id: string;
  organization_id: string;
  responsible_department_id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CollaborationPartner {
  id: string;
  collaboration_id: string;
  department_id: string;
  role: string | null;
  created_at: string;
}

export interface CollaborationRisk {
  id: string;
  collaboration_id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation_plan: string | null;
  status: 'identified' | 'monitoring' | 'mitigated' | 'realized';
  created_at: string;
  updated_at: string;
}

export interface CollaborationProject {
  id: string;
  collaboration_id: string;
  title: string;
  description: string | null;
  type: 'activity' | 'project';
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CollaborationFinding {
  id: string;
  collaboration_id: string;
  type: 'finding' | 'need';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'identified' | 'under_review' | 'addressed' | 'closed';
  action_taken: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstitutionalCode {
  id: string;
  organization_id: string;
  level: number;
  code: string;
  name: string;
  parent_id: string | null;
  full_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEconomicCode {
  id: string;
  organization_id: string;
  level: number;
  code: string;
  name: string;
  parent_id: string | null;
  full_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RevenueEconomicCode {
  id: string;
  organization_id: string;
  level: number;
  code: string;
  name: string;
  parent_id: string | null;
  full_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancingType {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubProgram {
  id: string;
  program_id: string;
  code: string;
  name: string;
  description: string | null;
  full_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetAuthorization {
  id: string;
  organization_id: string;
  budget_type: 'revenue' | 'expense';
  authorized_department_id: string;
  description: string | null;
  is_active: boolean;
  authorized_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseBudgetEntry {
  id: string;
  organization_id: string;
  program_id: string;
  sub_program_id: string;
  activity_id: string;
  institutional_code_id: string;
  expense_economic_code_id: string;
  financing_type_id: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseBudgetProposal {
  id: string;
  entry_id: string;
  year: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface RevenueBudgetEntry {
  id: string;
  organization_id: string;
  department_id: string;
  revenue_economic_code_id: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RevenueBudgetProposal {
  id: string;
  entry_id: string;
  year: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export type RiskEventType =
  | 'CREATED' | 'UPDATED' | 'DELETED'
  | 'SUBMITTED_FOR_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'STATUS_CHANGED' | 'SCORE_CHANGED' | 'OWNER_CHANGED'
  | 'CONTROL_ADDED' | 'CONTROL_UPDATED' | 'CONTROL_REMOVED'
  | 'TREATMENT_ADDED' | 'TREATMENT_UPDATED' | 'TREATMENT_COMPLETED'
  | 'INDICATOR_ADDED' | 'INDICATOR_THRESHOLD_BREACH'
  | 'REVIEW_COMPLETED' | 'COMMENT_ADDED'
  | 'APPETITE_BREACH' | 'ESCALATED' | 'CLOSED' | 'REOPENED';

export type RiskEventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type RiskApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'CANCELLED';

export type RiskCommentType = 'GENERAL' | 'ASSESSMENT' | 'CONTROL' | 'TREATMENT' | 'APPROVAL' | 'REVIEW' | 'ESCALATION';

export interface RiskVersion {
  id: string;
  risk_id: string;
  version_number: number;
  risk_data: Record<string, any>;
  change_summary: string | null;
  changed_fields: string[] | null;
  changed_by_id: string | null;
  changed_at: string;
  change_reason: string | null;
  previous_version_id: string | null;
  created_at: string;
  changed_by?: {
    full_name: string;
  };
}

export interface RiskEvent {
  id: string;
  risk_id: string;
  event_type: RiskEventType;
  event_title: string;
  event_description: string | null;
  event_data: Record<string, any> | null;
  old_value: string | null;
  new_value: string | null;
  triggered_by_id: string | null;
  triggered_at: string;
  is_system_generated: boolean;
  severity: RiskEventSeverity;
  created_at: string;
  triggered_by?: {
    full_name: string;
  };
}

export interface RiskApprovalChain {
  id: string;
  risk_id: string;
  approval_step: number;
  step_name: string;
  approver_id: string | null;
  approver_role: string | null;
  approver_department_id: string | null;
  status: RiskApprovalStatus;
  decision_date: string | null;
  decision_comments: string | null;
  delegated_from_id: string | null;
  delegation_reason: string | null;
  is_required: boolean;
  can_be_parallel: boolean;
  requires_all_if_parallel: boolean;
  due_date: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  approver?: {
    full_name: string;
    email: string;
  };
  department?: {
    name: string;
  };
  delegated_from?: {
    full_name: string;
  };
}

export interface RiskComment {
  id: string;
  risk_id: string;
  comment_text: string;
  comment_type: RiskCommentType;
  parent_comment_id: string | null;
  thread_level: number;
  author_id: string;
  mentioned_user_ids: string[] | null;
  tags: string[] | null;
  attachment_urls: string[] | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  is_pinned: boolean;
  is_important: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string;
    email: string;
  };
  replies?: RiskComment[];
}

export type NotificationType =
  | 'RISK_CREATED' | 'RISK_UPDATED' | 'RISK_HIGH_SCORE'
  | 'REVIEW_DUE' | 'REVIEW_OVERDUE' | 'APPROVAL_REQUIRED'
  | 'APPROVAL_APPROVED' | 'APPROVAL_REJECTED'
  | 'TREATMENT_DUE' | 'TREATMENT_OVERDUE' | 'TREATMENT_COMPLETED'
  | 'CONTROL_FAILURE' | 'INDICATOR_BREACH'
  | 'ESCALATION' | 'SLA_WARNING' | 'SLA_BREACH'
  | 'COMMENT_MENTION' | 'COMMENT_REPLY'
  | 'RECOMMENDATION' | 'SYSTEM_ALERT';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';

export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED' | 'ACTIONED';

export interface RiskNotification {
  id: string;
  user_id: string;
  organization_id: string;
  risk_id: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  requires_action: boolean;
  action_url: string | null;
  action_label: string | null;
  status: NotificationStatus;
  read_at: string | null;
  actioned_at: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  metadata: Record<string, any> | null;
  batch_id: string | null;
  related_notification_id: string | null;
  created_at: string;
  updated_at: string;
  risk?: {
    name: string;
    code: string;
  };
}

export type EscalationTriggerCondition =
  | 'HIGH_RISK_SCORE' | 'REVIEW_OVERDUE' | 'TREATMENT_OVERDUE'
  | 'NO_PROGRESS' | 'REPEATED_FAILURE' | 'SLA_BREACH'
  | 'INDICATOR_THRESHOLD' | 'CONTROL_FAILURE' | 'CUSTOM';

export type EscalationType =
  | 'NOTIFY_MANAGER' | 'NOTIFY_ADMIN' | 'NOTIFY_DIRECTOR'
  | 'CHANGE_OWNER' | 'INCREASE_PRIORITY' | 'REQUIRE_APPROVAL'
  | 'CREATE_TASK' | 'SEND_EMAIL' | 'CUSTOM';

export interface RiskEscalationRule {
  id: string;
  organization_id: string;
  rule_name: string;
  description: string | null;
  trigger_condition: EscalationTriggerCondition;
  threshold_value: number | null;
  threshold_unit: string | null;
  threshold_days: number | null;
  applies_to_risk_levels: string[] | null;
  applies_to_categories: string[] | null;
  applies_to_departments: string[] | null;
  escalation_type: EscalationType;
  escalate_to_role: string | null;
  escalate_to_users: string[] | null;
  escalate_to_department_id: string | null;
  delay_days: number;
  repeat_enabled: boolean;
  repeat_interval_days: number | null;
  max_repetitions: number | null;
  is_active: boolean;
  times_triggered: number;
  last_triggered_at: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SLAType = 'FIRST_RESPONSE' | 'ASSESSMENT' | 'TREATMENT_PLAN' | 'REVIEW' | 'APPROVAL' | 'RESOLUTION' | 'CLOSURE';

export type SLAStatus = 'IN_PROGRESS' | 'WARNING' | 'BREACHED' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';

export interface RiskSLATracking {
  id: string;
  risk_id: string;
  sla_type: SLAType;
  target_hours: number;
  warning_threshold_hours: number | null;
  started_at: string;
  target_date: string;
  warning_date: string | null;
  completed_at: string | null;
  status: SLAStatus;
  paused_at: string | null;
  pause_reason: string | null;
  total_paused_hours: number;
  actual_hours: number | null;
  is_within_sla: boolean | null;
  breach_hours: number | null;
  warning_notification_sent: boolean;
  breach_notification_sent: boolean;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
  risk?: {
    name: string;
    code: string;
  };
}

export type RecommendationType =
  | 'TREATMENT_SUGGESTION' | 'CONTROL_SUGGESTION' | 'REVIEW_FREQUENCY'
  | 'RISK_RESPONSE_CHANGE' | 'CATEGORY_CHANGE' | 'OWNER_CHANGE'
  | 'SIMILAR_RISKS' | 'BEST_PRACTICE' | 'REGULATORY_COMPLIANCE'
  | 'RESOURCE_ALLOCATION' | 'PRIORITY_CHANGE' | 'AUTOMATION';

export type RecommendationStatus = 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED' | 'IMPLEMENTED' | 'DISMISSED';

export type ImplementationEffort = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface RiskRecommendation {
  id: string;
  risk_id: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  rationale: string | null;
  suggested_action: string | null;
  expected_benefit: string | null;
  implementation_effort: ImplementationEffort | null;
  priority: NotificationPriority;
  confidence_score: number | null;
  related_risks: string[] | null;
  related_controls: string[] | null;
  related_treatments: string[] | null;
  status: RecommendationStatus;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  implemented_at: string | null;
  metadata: Record<string, any> | null;
  is_system_generated: boolean;
  generated_at: string;
  expires_at: string | null;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
  risk?: {
    name: string;
    code: string;
  };
  reviewed_by?: {
    full_name: string;
  };
}

export type EmailFrequency = 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'NEVER';

export interface RiskNotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  email_frequency: EmailFrequency;
  email_digest_time: string;
  notify_risk_created: boolean;
  notify_risk_updated: boolean;
  notify_high_risk: boolean;
  notify_review_due: boolean;
  notify_approval_required: boolean;
  notify_treatment_due: boolean;
  notify_escalation: boolean;
  notify_sla_warning: boolean;
  notify_mentions: boolean;
  notify_recommendations: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  weekend_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}
