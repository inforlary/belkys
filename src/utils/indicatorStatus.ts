export type IndicatorStatus =
  | 'exceeding_target'  // %115+
  | 'excellent'         // %85-114
  | 'good'             // %70-84
  | 'moderate'         // %55-69
  | 'weak'             // %45-54
  | 'very_weak';       // %0-44

export interface IndicatorStatusConfig {
  status: IndicatorStatus;
  label: string;
  minPercentage: number;
  maxPercentage: number;
  color: string;
  bgColor: string;
  borderColor: string;
  progressBarColor: string;
}

export const INDICATOR_STATUS_CONFIGS: IndicatorStatusConfig[] = [
  {
    status: 'exceeding_target',
    label: 'Hedef Üstü',
    minPercentage: 115,
    maxPercentage: Infinity,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    progressBarColor: 'bg-purple-500'
  },
  {
    status: 'excellent',
    label: 'Çok İyi',
    minPercentage: 85,
    maxPercentage: 114,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    progressBarColor: 'bg-green-600'
  },
  {
    status: 'good',
    label: 'İyi',
    minPercentage: 70,
    maxPercentage: 84,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    progressBarColor: 'bg-green-500'
  },
  {
    status: 'moderate',
    label: 'Orta',
    minPercentage: 55,
    maxPercentage: 69,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    progressBarColor: 'bg-yellow-500'
  },
  {
    status: 'weak',
    label: 'Zayıf',
    minPercentage: 45,
    maxPercentage: 54,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    progressBarColor: 'bg-red-500'
  },
  {
    status: 'very_weak',
    label: 'Çok Zayıf',
    minPercentage: 0,
    maxPercentage: 44,
    color: 'text-amber-800',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    progressBarColor: 'bg-amber-600'
  }
];

export function getIndicatorStatus(progressPercentage: number): IndicatorStatus {
  if (progressPercentage >= 115) return 'exceeding_target';
  if (progressPercentage >= 85) return 'excellent';
  if (progressPercentage >= 70) return 'good';
  if (progressPercentage >= 55) return 'moderate';
  if (progressPercentage >= 45) return 'weak';
  return 'very_weak';
}

export function getStatusConfig(status: IndicatorStatus): IndicatorStatusConfig {
  return INDICATOR_STATUS_CONFIGS.find(config => config.status === status) || INDICATOR_STATUS_CONFIGS[5];
}

export function getStatusConfigByPercentage(progressPercentage: number): IndicatorStatusConfig {
  const status = getIndicatorStatus(progressPercentage);
  return getStatusConfig(status);
}

export function getStatusLabel(status: IndicatorStatus): string {
  return getStatusConfig(status).label;
}

export function getStatusColor(status: IndicatorStatus): string {
  return getStatusConfig(status).color;
}

export function getStatusBgColor(status: IndicatorStatus): string {
  return getStatusConfig(status).bgColor;
}

export function getStatusBorderColor(status: IndicatorStatus): string {
  return getStatusConfig(status).borderColor;
}

export function getStatusProgressBarColor(status: IndicatorStatus): string {
  return getStatusConfig(status).progressBarColor;
}

export interface IndicatorStats {
  total: number;
  exceedingTarget: number;
  excellent: number;
  good: number;
  moderate: number;
  weak: number;
  veryWeak: number;
}

export function createEmptyStats(): IndicatorStats {
  return {
    total: 0,
    exceedingTarget: 0,
    excellent: 0,
    good: 0,
    moderate: 0,
    weak: 0,
    veryWeak: 0
  };
}

export function incrementStatusInStats(stats: IndicatorStats, status: IndicatorStatus): void {
  stats.total++;
  switch (status) {
    case 'exceeding_target':
      stats.exceedingTarget++;
      break;
    case 'excellent':
      stats.excellent++;
      break;
    case 'good':
      stats.good++;
      break;
    case 'moderate':
      stats.moderate++;
      break;
    case 'weak':
      stats.weak++;
      break;
    case 'very_weak':
      stats.veryWeak++;
      break;
  }
}
