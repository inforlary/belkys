import { supabase } from '../lib/supabase';

export interface BudgetControlResult {
  isAvailable: boolean;
  allocated: number;
  revised: number;
  committed: number;
  realized: number;
  available: number;
  message?: string;
  severity?: 'info' | 'warning' | 'error';
}

export async function checkBudgetAvailability(
  organizationId: string,
  fiscalYearId: string,
  allocationId: string,
  requestedAmount: number
): Promise<BudgetControlResult> {
  try {
    const { data: summary, error } = await supabase
      .from('budget_control_summary')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('fiscal_year_id', fiscalYearId)
      .eq('allocation_id', allocationId)
      .maybeSingle();

    if (error) throw error;

    if (!summary) {
      return {
        isAvailable: false,
        allocated: 0,
        revised: 0,
        committed: 0,
        realized: 0,
        available: 0,
        message: 'Bu kod için bütçe tahsisi bulunamadı',
        severity: 'error'
      };
    }

    const available = summary.available_amount;
    const isAvailable = available >= requestedAmount;
    const remainingAfter = available - requestedAmount;

    let message = '';
    let severity: 'info' | 'warning' | 'error' = 'info';

    if (!isAvailable) {
      message = `Yetersiz bütçe! Kalan: ₺${available.toFixed(2)}, İstenen: ₺${requestedAmount.toFixed(2)}`;
      severity = 'error';
    } else if (remainingAfter < summary.revised_amount * 0.1) {
      message = `Bütçe %90'dan fazla kullanılmış. İşlemden sonra kalan: ₺${remainingAfter.toFixed(2)}`;
      severity = 'warning';
    } else {
      message = `Bütçe uygun. İşlemden sonra kalan: ₺${remainingAfter.toFixed(2)}`;
      severity = 'info';
    }

    return {
      isAvailable,
      allocated: summary.allocated_amount,
      revised: summary.revised_amount,
      committed: summary.committed_amount,
      realized: summary.realized_amount,
      available,
      message,
      severity
    };
  } catch (error) {
    console.error('Error checking budget availability:', error);
    return {
      isAvailable: false,
      allocated: 0,
      revised: 0,
      committed: 0,
      realized: 0,
      available: 0,
      message: 'Bütçe kontrolü yapılamadı',
      severity: 'error'
    };
  }
}

export async function updateBudgetControlSummary(
  organizationId: string,
  fiscalYearId: string,
  allocationId: string
): Promise<void> {
  try {
    const { data: allocation } = await supabase
      .from('budget_allocations')
      .select('allocated_amount, revised_amount')
      .eq('id', allocationId)
      .single();

    if (!allocation) return;

    const { data: commitments } = await supabase
      .from('budget_commitments')
      .select('amount')
      .eq('allocation_id', allocationId)
      .eq('status', 'active');

    const committedAmount = commitments?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

    const { data: expenses } = await supabase
      .from('expense_budget_entries')
      .select('expense_budget_proposals(amount)')
      .eq('organization_id', organizationId)
      .eq('status', 'posted');

    const realizedAmount = 0;

    await supabase
      .from('budget_control_summary')
      .upsert({
        organization_id: organizationId,
        fiscal_year_id: fiscalYearId,
        allocation_id: allocationId,
        allocated_amount: allocation.allocated_amount,
        revised_amount: allocation.revised_amount,
        committed_amount: committedAmount,
        realized_amount: realizedAmount,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'organization_id,fiscal_year_id,allocation_id'
      });
  } catch (error) {
    console.error('Error updating budget control summary:', error);
  }
}

export async function createInternalControlFinding(
  organizationId: string,
  findingType: 'budget_overrun' | 'delayed_approval' | 'incorrect_abs' | 'missing_document' | 'other',
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string,
  entityType?: string,
  entityId?: string,
  detectedBy?: string
): Promise<void> {
  try {
    await supabase.from('internal_control_findings').insert({
      organization_id: organizationId,
      finding_type: findingType,
      severity,
      entity_type: entityType,
      entity_id: entityId,
      description,
      detected_by: detectedBy,
      status: 'open'
    });
  } catch (error) {
    console.error('Error creating internal control finding:', error);
  }
}

export function calculateBudgetMetrics(summary: any) {
  const allocated = parseFloat(summary.allocated_amount || 0);
  const revised = parseFloat(summary.revised_amount || 0);
  const committed = parseFloat(summary.committed_amount || 0);
  const realized = parseFloat(summary.realized_amount || 0);
  const available = revised - committed - realized;
  const utilizationRate = revised > 0 ? ((committed + realized) / revised) * 100 : 0;
  const realizationRate = revised > 0 ? (realized / revised) * 100 : 0;

  return {
    allocated,
    revised,
    committed,
    realized,
    available,
    utilizationRate,
    realizationRate
  };
}
