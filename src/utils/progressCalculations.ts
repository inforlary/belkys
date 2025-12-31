interface Indicator {
  id: string;
  goal_id: string;
  goal_impact_percentage?: number | null;
  yearly_target?: number | null;
  target_value?: number | null;
  current_value?: number;
  baseline_value?: number | null;
  calculation_method?: string;
  measurement_frequency?: string;
}

interface DataEntry {
  indicator_id: string;
  value: number;
  status: string;
}

interface Goal {
  id: string;
  objective_id: string;
}

export function calculateIndicatorProgress(
  indicator: Indicator,
  dataEntries: DataEntry[]
): number {
  const targetValue = indicator.yearly_target || indicator.target_value;
  const baselineValue = indicator.baseline_value || 0;

  if (targetValue === null || targetValue === undefined || targetValue === 0) return 0;

  const indicatorEntries = dataEntries.filter(
    e => e.indicator_id === indicator.id &&
    (e.status === 'approved' || e.status === 'submitted')
  );

  if (indicatorEntries.length === 0) return 0;

  const sumOfEntries = indicatorEntries.reduce((sum, entry) => sum + entry.value, 0);
  const calculationMethod = indicator.calculation_method || 'cumulative_increasing';

  const measurementFrequencyMap: { [key: string]: number } = {
    monthly: 12,
    quarterly: 4,
    semi_annual: 2,
    annual: 1
  };

  const measurementFrequencyCount = measurementFrequencyMap[indicator.measurement_frequency || 'annual'] || 1;

  let progress = 0;

  switch (calculationMethod) {
    case 'cumulative':
    case 'cumulative_increasing':
    case 'increasing': {
      const C = baselineValue + sumOfEntries;
      const denominator = targetValue - baselineValue;
      if (denominator === 0) return 0;
      progress = ((C - baselineValue) / denominator) * 100;
      break;
    }

    case 'cumulative_decreasing':
    case 'decreasing': {
      const C = baselineValue - sumOfEntries;
      const denominator = targetValue - baselineValue;
      if (denominator === 0) return 0;
      progress = ((C - baselineValue) / denominator) * 100;
      break;
    }

    case 'percentage_increasing': {
      const average = sumOfEntries / measurementFrequencyCount;
      progress = (average / targetValue) * 100;
      break;
    }

    case 'percentage_decreasing': {
      const average = sumOfEntries / measurementFrequencyCount;
      const denominator = targetValue - baselineValue;
      if (denominator === 0) return 0;
      progress = ((average - baselineValue) / denominator) * 100;
      break;
    }

    case 'maintenance_increasing': {
      progress = (sumOfEntries / targetValue) * 100;
      break;
    }

    case 'maintenance_decreasing': {
      if (sumOfEntries === 0) return 0;
      progress = (targetValue / sumOfEntries) * 100;
      break;
    }

    case 'percentage':
    case 'maintenance': {
      progress = (sumOfEntries / targetValue) * 100;
      break;
    }

    default: {
      const C = baselineValue + sumOfEntries;
      const denominator = targetValue - baselineValue;
      if (denominator === 0) return 0;
      progress = ((C - baselineValue) / denominator) * 100;
      break;
    }
  }

  return Math.max(0, Math.round(progress));
}

export function calculateGoalProgress(
  goalId: string,
  indicators: Indicator[],
  dataEntries: DataEntry[]
): number {
  const goalIndicators = indicators.filter(ind => ind.goal_id === goalId);

  if (goalIndicators.length === 0) return 0;

  const indicatorsWithImpact = goalIndicators.filter(
    ind => ind.goal_impact_percentage && ind.goal_impact_percentage > 0
  );

  if (indicatorsWithImpact.length === 0) {
    const totalProgress = goalIndicators.reduce((sum, indicator) => {
      return sum + calculateIndicatorProgress(indicator, dataEntries);
    }, 0);
    return Math.round(totalProgress / goalIndicators.length);
  }

  const weightedProgress = indicatorsWithImpact.reduce((sum, indicator) => {
    const indicatorProgress = calculateIndicatorProgress(indicator, dataEntries);
    const cappedProgress = Math.min(100, indicatorProgress);
    const impactPercentage = indicator.goal_impact_percentage || 0;
    const contribution = (cappedProgress * impactPercentage) / 100;
    return sum + contribution;
  }, 0);

  return Math.round(weightedProgress);
}

export function calculateObjectiveProgress(
  objectiveId: string,
  goals: Goal[],
  indicators: Indicator[],
  dataEntries: DataEntry[]
): number {
  const objectiveGoals = goals.filter(g => g.objective_id === objectiveId);

  if (objectiveGoals.length === 0) return 0;

  const totalProgress = objectiveGoals.reduce((sum, goal) => {
    return sum + calculateGoalProgress(goal.id, indicators, dataEntries);
  }, 0);

  return Math.round(totalProgress / objectiveGoals.length);
}

export function getProgressColor(progress: number): string {
  if (progress >= 115) return 'bg-purple-500';
  if (progress >= 85) return 'bg-green-500';
  if (progress >= 70) return 'bg-green-400';
  if (progress >= 55) return 'bg-yellow-500';
  if (progress >= 45) return 'bg-red-500';
  return 'bg-amber-700';
}

export function getProgressTextColor(progress: number): string {
  if (progress >= 115) return 'text-purple-600';
  if (progress >= 85) return 'text-green-600';
  if (progress >= 70) return 'text-green-500';
  if (progress >= 55) return 'text-yellow-600';
  if (progress >= 45) return 'text-red-600';
  return 'text-amber-700';
}

export function validateGoalImpactPercentages(
  goalId: string,
  indicators: Indicator[],
  currentIndicatorId?: string,
  newImpactPercentage?: number
): { isValid: boolean; currentTotal: number; message: string; shouldBlock: boolean } {
  const goalIndicators = indicators.filter(ind =>
    ind.goal_id === goalId && ind.id !== currentIndicatorId
  );

  const otherIndicatorsWithImpact = goalIndicators.filter(
    ind => ind.goal_impact_percentage && ind.goal_impact_percentage > 0
  );

  let total = goalIndicators.reduce(
    (sum, ind) => sum + (ind.goal_impact_percentage || 0),
    0
  );

  if (newImpactPercentage !== undefined && newImpactPercentage > 0) {
    total += newImpactPercentage;
  }

  const willHaveMultipleIndicators =
    otherIndicatorsWithImpact.length > 0 ||
    (newImpactPercentage !== undefined && newImpactPercentage > 0 && goalIndicators.length > 0);

  const isValid = total === 100;
  const shouldBlock = total > 100;

  let message = '';
  if (!willHaveMultipleIndicators) {
    message = 'İlk gösterge';
  } else if (total === 100) {
    message = 'Hedefe etkisi toplamı %100 ✓';
  } else if (total > 100) {
    message = `Hedefe etkisi toplamı %${total} - %100'ü geçemez!`;
  } else {
    message = `Hedefe etkisi toplamı %${total} (Kalan: %${100 - total})`;
  }

  return { isValid, currentTotal: total, message, shouldBlock };
}
