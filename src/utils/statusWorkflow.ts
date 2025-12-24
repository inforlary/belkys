import { supabase } from '../lib/supabase';

export type VoucherStatus = 'draft' | 'pending_approval' | 'approved' | 'posted' | 'correction' | 'cancelled';

export interface StatusTransition {
  from: VoucherStatus;
  to: VoucherStatus;
  allowedRoles: string[];
  requiresComment?: boolean;
}

export const statusTransitions: StatusTransition[] = [
  {
    from: 'draft',
    to: 'pending_approval',
    allowedRoles: ['preparer', 'admin', 'super_admin'],
    requiresComment: false
  },
  {
    from: 'pending_approval',
    to: 'approved',
    allowedRoles: ['spending_authority', 'admin', 'super_admin'],
    requiresComment: false
  },
  {
    from: 'pending_approval',
    to: 'draft',
    allowedRoles: ['preparer', 'spending_authority', 'admin', 'super_admin'],
    requiresComment: true
  },
  {
    from: 'approved',
    to: 'posted',
    allowedRoles: ['realization_officer', 'accountant', 'admin', 'super_admin'],
    requiresComment: false
  },
  {
    from: 'posted',
    to: 'correction',
    allowedRoles: ['accountant', 'admin', 'super_admin'],
    requiresComment: true
  },
  {
    from: 'draft',
    to: 'cancelled',
    allowedRoles: ['preparer', 'admin', 'super_admin'],
    requiresComment: true
  },
  {
    from: 'pending_approval',
    to: 'cancelled',
    allowedRoles: ['spending_authority', 'admin', 'super_admin'],
    requiresComment: true
  }
];

export function canTransitionStatus(
  fromStatus: VoucherStatus,
  toStatus: VoucherStatus,
  userRole: string
): { canTransition: boolean; reason?: string } {
  const transition = statusTransitions.find(
    t => t.from === fromStatus && t.to === toStatus
  );

  if (!transition) {
    return {
      canTransition: false,
      reason: `${fromStatus} durumundan ${toStatus} durumuna geçiş tanımlanmamış`
    };
  }

  if (!transition.allowedRoles.includes(userRole)) {
    return {
      canTransition: false,
      reason: `Bu işlem için ${transition.allowedRoles.join(' veya ')} rolü gereklidir`
    };
  }

  return { canTransition: true };
}

export async function changeStatus(
  entityType: string,
  entityId: string,
  newStatus: VoucherStatus,
  userId: string,
  organizationId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: entity, error: fetchError } = await supabase
      .from(entityType)
      .select('status')
      .eq('id', entityId)
      .single();

    if (fetchError) throw fetchError;

    const oldStatus = entity.status as VoucherStatus;

    await supabase.from('status_history').insert({
      organization_id: organizationId,
      entity_type: entityType,
      entity_id: entityId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: userId,
      comment
    });

    const updateData: any = { status: newStatus };

    if (newStatus === 'approved') {
      updateData.approved_by = userId;
      updateData.approved_at = new Date().toISOString();
    } else if (newStatus === 'posted') {
      updateData.posted_by = userId;
      updateData.posted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from(entityType)
      .update(updateData)
      .eq('id', entityId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error: any) {
    console.error('Error changing status:', error);
    return {
      success: false,
      error: error.message || 'Durum değiştirme işlemi başarısız'
    };
  }
}

export function getStatusLabel(status: VoucherStatus): string {
  const labels: Record<VoucherStatus, string> = {
    draft: 'Taslak',
    pending_approval: 'Onay Bekliyor',
    approved: 'Onaylandı',
    posted: 'Muhasebeleşti',
    correction: 'Düzeltme',
    cancelled: 'İptal Edildi'
  };
  return labels[status] || status;
}

export function getStatusColor(status: VoucherStatus): string {
  const colors: Record<VoucherStatus, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    posted: 'bg-blue-100 text-blue-800',
    correction: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getNextStatusOptions(
  currentStatus: VoucherStatus,
  userRole: string
): VoucherStatus[] {
  return statusTransitions
    .filter(t => t.from === currentStatus && t.allowedRoles.includes(userRole))
    .map(t => t.to);
}
