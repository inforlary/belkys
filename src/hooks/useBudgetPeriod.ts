import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BudgetPeriod {
  id: string;
  organization_id: string;
  preparation_year: number;
  budget_year: number;
  period_status: string;
  preparation_start_date: string;
  preparation_end_date: string;
  approval_start_date: string;
  approval_deadline_date: string;
  execution_start_date: string;
  execution_end_date: string;
  closing_date: string;
  is_active: boolean;
  is_current: boolean;
  notes: string;
  created_at: string;
}

interface PeriodConstraints {
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  message: string;
  hint: string;
  period_status: string;
  budget_year: number;
  preparation_year: number;
  is_current: boolean;
}

export function useBudgetPeriod() {
  const { user, profile } = useAuth();
  const [currentPeriod, setCurrentPeriod] = useState<BudgetPeriod | null>(null);
  const [constraints, setConstraints] = useState<PeriodConstraints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentPeriod();
  }, [user, profile]);

  const loadCurrentPeriod = async () => {
    if (!user || !profile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: periodData, error: periodError } = await supabase
        .from('budget_periods')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_current', true)
        .maybeSingle();

      if (periodError) throw periodError;

      setCurrentPeriod(periodData);

      if (periodData) {
        const { data: constraintsData, error: constraintsError } = await supabase
          .rpc('get_period_constraints', {
            p_period_id: periodData.id,
          });

        if (constraintsError) throw constraintsError;
        setConstraints(constraintsData);
      }
    } catch (error) {
      console.error('Error loading budget period:', error);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = (): boolean => {
    return constraints?.can_create ?? false;
  };

  const canEdit = (): boolean => {
    return constraints?.can_edit ?? false;
  };

  const canApprove = (): boolean => {
    return constraints?.can_approve ?? false;
  };

  const getCurrentFiscalYear = (): number | null => {
    return currentPeriod?.budget_year ?? null;
  };

  const getPeriodStatus = (): string => {
    return currentPeriod?.period_status ?? 'unknown';
  };

  return {
    currentPeriod,
    constraints,
    loading,
    canCreate,
    canEdit,
    canApprove,
    getCurrentFiscalYear,
    getPeriodStatus,
    reload: loadCurrentPeriod,
  };
}
