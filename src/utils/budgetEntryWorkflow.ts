import { supabase } from '../lib/supabase';

export type BudgetEntryStatus = 'draft' | 'pending_approval' | 'approved' | 'posted' | 'rejected';

export interface WorkflowAction {
  label: string;
  action: string;
  variant: 'primary' | 'success' | 'danger' | 'warning';
  requiresComment?: boolean;
}

export function canEdit(entry: any, userRole: string, userId: string): boolean {
  if (userRole === 'admin' || userRole === 'super_admin') return true;

  if (entry.status === 'posted') return false;

  if (entry.status === 'draft' || entry.status === 'rejected') {
    return entry.created_by === userId;
  }

  if (entry.status === 'pending_approval' || entry.status === 'approved') {
    return userRole === 'spending_authority';
  }

  return false;
}

export function canDelete(entry: any, userRole: string, userId: string): boolean {
  if (userRole === 'admin' || userRole === 'super_admin') return true;

  return entry.status === 'draft' && entry.created_by === userId;
}

export function getAvailableActions(entry: any, userRole: string, userId: string): WorkflowAction[] {
  const actions: WorkflowAction[] = [];

  if (!entry) return actions;

  const status = entry.status || 'draft';
  const isCreator = entry.created_by === userId;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSpendingAuthority = userRole === 'spending_authority';
  const isAccountant = userRole === 'realization_officer' || userRole === 'accountant';

  switch (status) {
    case 'draft':
      if (isCreator || isAdmin) {
        actions.push({
          label: 'Onaya Gönder',
          action: 'submit_for_approval',
          variant: 'primary'
        });
      }
      break;

    case 'pending_approval':
      if (isSpendingAuthority || isAdmin) {
        actions.push({
          label: 'Onayla',
          action: 'approve',
          variant: 'success',
          requiresComment: true
        });
        actions.push({
          label: 'Reddet',
          action: 'reject',
          variant: 'danger',
          requiresComment: true
        });
      }
      break;

    case 'approved':
      if (isAccountant || isAdmin) {
        actions.push({
          label: 'Muhasebeleştir',
          action: 'post',
          variant: 'success',
          requiresComment: true
        });
      }
      break;

    case 'rejected':
      if (isCreator || isAdmin) {
        actions.push({
          label: 'Tekrar Onaya Gönder',
          action: 'submit_for_approval',
          variant: 'primary'
        });
      }
      break;

    case 'posted':
      break;
  }

  return actions;
}

export async function executeWorkflowAction(
  entryType: 'expense' | 'revenue',
  entryId: string,
  action: string,
  userId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const tableName = entryType === 'expense' ? 'expense_budget_entries' : 'revenue_budget_entries';

    const updateData: any = {
      last_modified_by: userId
    };

    switch (action) {
      case 'submit_for_approval':
        updateData.status = 'pending_approval';
        break;

      case 'approve':
        updateData.status = 'approved';
        updateData.approved_by = userId;
        updateData.approved_at = new Date().toISOString();
        break;

      case 'reject':
        updateData.status = 'rejected';
        updateData.rejection_reason = comment;
        break;

      case 'post':
        updateData.status = 'posted';
        updateData.posted_by = userId;
        updateData.posted_at = new Date().toISOString();
        break;

      default:
        return { success: false, error: 'Geçersiz işlem' };
    }

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', entryId);

    if (error) throw error;

    if (comment) {
      const { data: entry } = await supabase
        .from(tableName)
        .select('organization_id')
        .eq('id', entryId)
        .single();

      if (entry) {
        await supabase.from('budget_entry_comments').insert({
          organization_id: entry.organization_id,
          entry_type: entryType,
          entry_id: entryId,
          user_id: userId,
          comment
        });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Workflow action error:', error);
    return { success: false, error: error.message };
  }
}

export function getStatusBadgeClass(status: BudgetEntryStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'pending_approval':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'posted':
      return 'bg-blue-100 text-blue-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: BudgetEntryStatus): string {
  switch (status) {
    case 'draft':
      return 'Taslak';
    case 'pending_approval':
      return 'Onay Bekliyor';
    case 'approved':
      return 'Onaylandı';
    case 'posted':
      return 'Muhasebeleşti';
    case 'rejected':
      return 'Reddedildi';
    default:
      return status;
  }
}
