import { supabase } from '../lib/supabase';

export interface PeriodLockResult {
  isLocked: boolean;
  message?: string;
  lockInfo?: {
    lockedBy: string;
    lockedAt: string;
    lockedReason?: string;
  };
}

export async function checkPeriodLock(
  organizationId: string,
  year: number,
  month: number
): Promise<PeriodLockResult> {
  try {
    const { data: lock, error } = await supabase
      .from('period_locks')
      .select('*, locked_by_profile:profiles!period_locks_locked_by_fkey(full_name)')
      .eq('organization_id', organizationId)
      .eq('period_type', 'month')
      .eq('period_year', year)
      .eq('period_number', month)
      .eq('is_locked', true)
      .maybeSingle();

    if (error) throw error;

    if (lock) {
      return {
        isLocked: true,
        message: `${year}/${month} dönemi kilitlidir. Düzenleme yapabilmek için düzeltme fişi oluşturmanız gerekmektedir.`,
        lockInfo: {
          lockedBy: lock.locked_by_profile?.full_name || 'Sistem',
          lockedAt: new Date(lock.locked_at).toLocaleDateString('tr-TR'),
          lockedReason: lock.locked_reason
        }
      };
    }

    return { isLocked: false };
  } catch (error) {
    console.error('Error checking period lock:', error);
    return {
      isLocked: false,
      message: 'Dönem kilidi kontrolü yapılamadı'
    };
  }
}

export async function getCurrentFiscalYear(organizationId: string) {
  try {
    const { data, error } = await supabase
      .from('fiscal_years')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_current', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting current fiscal year:', error);
    return null;
  }
}

export async function canEditEntry(
  organizationId: string,
  year: number,
  month: number,
  isCorrection: boolean = false
): Promise<{ canEdit: boolean; reason?: string }> {
  if (isCorrection) {
    return { canEdit: true };
  }

  const lockResult = await checkPeriodLock(organizationId, year, month);

  if (lockResult.isLocked) {
    return {
      canEdit: false,
      reason: lockResult.message
    };
  }

  return { canEdit: true };
}
