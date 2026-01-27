import { SupabaseClient } from '@supabase/supabase-js';

export type CalculationMethod =
  | 'standard'
  | 'cumulative'
  | 'cumulative_increasing'
  | 'cumulative_decreasing'
  | 'percentage'
  | 'percentage_increasing'
  | 'percentage_decreasing'
  | 'maintenance'
  | 'maintenance_increasing'
  | 'maintenance_decreasing'
  | 'increasing'
  | 'decreasing';

interface CalculationParams {
  method: CalculationMethod;
  baselineValue: number;
  targetValue: number;
  periodValues: number[];
  currentValue: number;
  measurementFrequencyCount?: number;
}

export function calculateIndicatorValue(params: CalculationParams): number {
  const { method, baselineValue, periodValues } = params;
  const sum = periodValues.reduce((acc, val) => acc + val, 0);
  const periodCount = periodValues.length;
  const average = periodCount > 0 ? sum / periodCount : 0;

  switch (method) {
    case 'cumulative':
    case 'cumulative_increasing':
    case 'increasing':
      return baselineValue + sum;

    case 'cumulative_decreasing':
    case 'decreasing':
      return baselineValue - sum;

    case 'percentage':
    case 'percentage_increasing':
    case 'percentage_decreasing':
      return average;

    case 'maintenance':
    case 'maintenance_increasing':
    case 'maintenance_decreasing':
      return average;

    case 'standard':
    default:
      return baselineValue + sum;
  }
}

export function calculatePerformancePercentage(params: CalculationParams): number {
  const { method, baselineValue, targetValue, periodValues } = params;
  if (targetValue === 0) return 0;

  const sum = periodValues.reduce((acc, val) => acc + val, 0);
  const periodCount = periodValues.length;
  const average = periodCount > 0 ? sum / periodCount : 0;

  switch (method) {
    case 'cumulative':
    case 'cumulative_increasing':
    case 'increasing': {
      const currentValue = baselineValue + sum;
      const denominator = targetValue - baselineValue;

      if (denominator === 0) {
        if (sum > 0) {
          return 100;
        } else if (sum < 0) {
          return 0;
        }
        return 100;
      }

      return ((currentValue - baselineValue) / denominator) * 100;
    }

    case 'cumulative_decreasing':
    case 'decreasing': {
      const currentValue = baselineValue - sum;
      const denominator = targetValue - baselineValue;

      if (denominator === 0) {
        if (sum < 0) {
          return 100;
        } else if (sum > 0) {
          return 0;
        }
        return 100;
      }

      return ((currentValue - baselineValue) / denominator) * 100;
    }

    case 'percentage_increasing': {
      return (average / targetValue) * 100;
    }

    case 'percentage_decreasing': {
      if (average === 0) return 0;
      return (targetValue / average) * 100;
    }

    case 'maintenance_increasing': {
      return (average / targetValue) * 100;
    }

    case 'maintenance_decreasing': {
      if (average === 0) return 0;
      return (targetValue / average) * 100;
    }

    case 'percentage':
    case 'maintenance':
    case 'standard':
    default: {
      return (average / targetValue) * 100;
    }
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
    .eq('status', 'approved')
    .order('period_quarter', { ascending: true });

  if (error) {
    console.error('Error fetching period values:', error);
    return [];
  }

  return data?.map(d => d.value || 0) || [];
}

interface IndicatorEntry {
  indicator_id: string;
  value: number;
  status: string;
}

export function calculateCurrentValueFromEntries(
  indicatorId: string,
  baselineValue: number,
  calculationMethod: string,
  entries: IndicatorEntry[]
): number | null {
  const indicatorEntries = entries.filter(
    e => e.indicator_id === indicatorId && e.status === 'approved'
  );

  if (indicatorEntries.length === 0) return null;

  const sumOfEntries = indicatorEntries.reduce((sum, entry) => sum + entry.value, 0);
  const periodCount = indicatorEntries.length;
  const average = sumOfEntries / periodCount;
  const method = (calculationMethod || 'cumulative') as CalculationMethod;

  switch (method) {
    case 'cumulative':
    case 'cumulative_increasing':
    case 'increasing':
      return baselineValue + sumOfEntries;

    case 'cumulative_decreasing':
    case 'decreasing':
      return baselineValue - sumOfEntries;

    case 'percentage':
    case 'percentage_increasing':
    case 'percentage_decreasing':
      return average;

    case 'maintenance':
    case 'maintenance_increasing':
    case 'maintenance_decreasing':
      return average;

    default:
      return baselineValue + sumOfEntries;
  }
}