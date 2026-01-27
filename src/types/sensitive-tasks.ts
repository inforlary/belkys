export type RotationPeriod = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export type TaskStatus = 'normal' | 'rotation_due' | 'rotation_overdue' | 'awaiting_assignment';

export type ActionType = 'initial_assignment' | 'rotation' | 'postponement';

export type PostponementReason = 'no_qualified_personnel' | 'personnel_on_leave' | 'critical_period' | 'other';

export interface SensitiveTask {
  id: string;
  organization_id: string;
  workflow_id?: string;
  workflow_step_id?: string;
  task_name: string;
  process_name: string;
  department_id?: string;
  assigned_primary_id?: string;
  assigned_backup_id?: string;
  rotation_period: RotationPeriod;
  last_rotation_date?: string;
  next_rotation_date?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  department?: {
    id: string;
    name: string;
  };
  assigned_primary?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  assigned_backup?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  workflow?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface TaskRotationHistory {
  id: string;
  sensitive_task_id: string;
  action_type: ActionType;
  action_date: string;
  previous_primary_id?: string;
  new_primary_id?: string;
  previous_backup_id?: string;
  new_backup_id?: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
  previous_primary?: {
    id: string;
    full_name: string;
  };
  new_primary?: {
    id: string;
    full_name: string;
  };
  previous_backup?: {
    id: string;
    full_name: string;
  };
  new_backup?: {
    id: string;
    full_name: string;
  };
  performer?: {
    id: string;
    full_name: string;
  };
}

export interface TaskPostponement {
  id: string;
  sensitive_task_id: string;
  postponement_reason: PostponementReason;
  postponement_duration: number;
  original_due_date: string;
  new_due_date: string;
  approved_by?: string;
  notes?: string;
  created_at: string;
  approver?: {
    id: string;
    full_name: string;
  };
}

export interface TaskAlert {
  type: 'overdue' | 'due_soon' | 'no_backup' | 'no_assignment';
  severity: 'high' | 'medium' | 'low';
  message: string;
  task: SensitiveTask;
}

export interface DashboardStats {
  total_tasks: number;
  awaiting_assignment: number;
  rotation_due: number;
  rotation_overdue: number;
}

export const ROTATION_PERIOD_LABELS: Record<RotationPeriod, string> = {
  monthly: 'Aylık',
  quarterly: '3 Aylık',
  semi_annual: '6 Aylık',
  annual: 'Yıllık'
};

export const ROTATION_PERIOD_DAYS: Record<RotationPeriod, number> = {
  monthly: 30,
  quarterly: 90,
  semi_annual: 180,
  annual: 365
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  normal: 'Normal',
  rotation_due: 'Rotasyon Yakın',
  rotation_overdue: 'Rotasyon Geçti',
  awaiting_assignment: 'Atama Bekliyor'
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  normal: 'bg-green-100 text-green-800',
  rotation_due: 'bg-yellow-100 text-yellow-800',
  rotation_overdue: 'bg-red-100 text-red-800',
  awaiting_assignment: 'bg-gray-100 text-gray-800'
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  initial_assignment: 'İlk Atama',
  rotation: 'Rotasyon',
  postponement: 'Erteleme'
};

export const POSTPONEMENT_REASON_LABELS: Record<PostponementReason, string> = {
  no_qualified_personnel: 'Yetkin personel bulunmuyor',
  personnel_on_leave: 'Personel izinde/raporlu',
  critical_period: 'Kritik dönem (bütçe, seçim vb.)',
  other: 'Diğer'
};
