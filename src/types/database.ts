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
  role: 'admin' | 'manager' | 'user' | 'vice_president';
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
