import { SupabaseClient } from '@supabase/supabase-js';

export type CalculationMethod = 'standard' | 'cumulative' | 'percentage' | 'cumulative_decreasing';

interface CalculationParams {
  method: CalculationMethod;
  baselineValue: number;
  targetValue: number;
  periodValues: number[];
  currentValue: number;
}

export function calculateIndicatorValue(params: CalculationParams): number {
  const { method, baselineValue, targetValue, periodValues, currentValue } = params;

  switch (method) {
    case 'standard':
      return currentValue;

    case 'cumulative': {
      const sum = periodValues.reduce((acc, val) => acc + val, 0);
      return baselineValue + sum;
    }

    case 'percentage': {
      if (targetValue === 0) return 0;
      return (currentValue / targetValue) * 100;
    }

    case 'cumulative_decreasing': {
      const sum = periodValues.reduce((acc, val) => acc + val, 0);
      return baselineValue - sum;
    }

    default:
      return currentValue;
  }
}

export function calculatePerformancePercentage(params: CalculationParams): number {
  const { method, baselineValue, targetValue, periodValues } = params;

  if (targetValue === 0) return 0;

  switch (method) {
    case 'standard':
      return 0;

    case 'cumulative': {
      const sum = periodValues.reduce((acc, val) => acc + val, 0);
      const achieved = baselineValue + sum;
      return (achieved / targetValue) * 100;
    }

    case 'percentage': {
      const sum = periodValues.reduce((acc, val) => acc + val, 0);
      return (sum / targetValue) * 100;
    }

    case 'cumulative_decreasing': {
      const sum = periodValues.reduce((acc, val) => acc + val, 0);
      const achieved = baselineValue - sum;
      return (achieved / targetValue) * 100;
    }

    default:
      return 0;
  }
}

export async function getIndicatorPeriodValues(
  supabase: SupabaseClient,
  indicatorId: string,
  year: number,
  organizationId: string
): Promise<number[]> {
  const { data, error } = await supabase
    .from('indicator_data_entries')
    .select('value, period_quarter')
    .eq('indicator_id', indicatorId)
    .eq('period_year', year)
    .eq('organization_id', organizationId)
    .in('status', ['approved', 'submitted'])
    .order('period_quarter', { ascending: true });

  if (error) {
    console.error('Error fetching period values:', error);
    return [];
  }

  return data?.map(d => d.value || 0) || [];
}
