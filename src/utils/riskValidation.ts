export interface RiskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RiskScoreValidation {
  inherent_likelihood: number;
  inherent_impact: number;
  residual_likelihood: number;
  residual_impact: number;
  target_likelihood?: number | null;
  target_impact?: number | null;
}

export interface RiskDateValidation {
  identified_date?: string | null;
  last_review_date?: string | null;
  next_review_date?: string | null;
  target_date?: string | null;
}

export function validateRiskScore(data: RiskScoreValidation): RiskValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, target_likelihood, target_impact } = data;

  if (inherent_likelihood < 1 || inherent_likelihood > 5) {
    errors.push('İçsel olasılık 1 ile 5 arasında olmalıdır');
  }

  if (inherent_impact < 1 || inherent_impact > 5) {
    errors.push('İçsel etki 1 ile 5 arasında olmalıdır');
  }

  if (residual_likelihood < 1 || residual_likelihood > 5) {
    errors.push('Artık olasılık 1 ile 5 arasında olmalıdır');
  }

  if (residual_impact < 1 || residual_impact > 5) {
    errors.push('Artık etki 1 ile 5 arasında olmalıdır');
  }

  const inherent_score = inherent_likelihood * inherent_impact;
  const residual_score = residual_likelihood * residual_impact;

  if (residual_score > inherent_score) {
    errors.push('Artık risk skoru içsel risk skorundan büyük olamaz');
  }

  if (residual_score === inherent_score) {
    warnings.push('Artık risk skoru içsel risk skoru ile aynı - risk azaltma tedbirleri etkisiz görünüyor');
  }

  if (target_likelihood !== null && target_likelihood !== undefined) {
    if (target_likelihood < 1 || target_likelihood > 5) {
      errors.push('Hedef olasılık 1 ile 5 arasında olmalıdır');
    }

    if (target_likelihood > residual_likelihood) {
      warnings.push('Hedef olasılık mevcut artık olasılıktan yüksek - gerçekçi hedef mi?');
    }
  }

  if (target_impact !== null && target_impact !== undefined) {
    if (target_impact < 1 || target_impact > 5) {
      errors.push('Hedef etki 1 ile 5 arasında olmalıdır');
    }

    if (target_impact > residual_impact) {
      warnings.push('Hedef etki mevcut artık etkiden yüksek - gerçekçi hedef mi?');
    }
  }

  if (target_likelihood && target_impact) {
    const target_score = target_likelihood * target_impact;
    if (target_score > residual_score) {
      errors.push('Hedef risk skoru mevcut artık risk skorundan büyük olamaz');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateRiskDates(data: RiskDateValidation): RiskValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { identified_date, last_review_date, next_review_date, target_date } = data;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (identified_date) {
    const identifiedDate = new Date(identified_date);
    identifiedDate.setHours(0, 0, 0, 0);

    if (identifiedDate > today) {
      errors.push('Risk tespit tarihi gelecekte olamaz');
    }
  }

  if (last_review_date) {
    const lastReviewDate = new Date(last_review_date);
    lastReviewDate.setHours(0, 0, 0, 0);

    if (lastReviewDate > today) {
      errors.push('Son gözden geçirme tarihi gelecekte olamaz');
    }

    if (identified_date) {
      const identifiedDate = new Date(identified_date);
      identifiedDate.setHours(0, 0, 0, 0);

      if (lastReviewDate < identifiedDate) {
        errors.push('Son gözden geçirme tarihi risk tespit tarihinden önce olamaz');
      }
    }
  }

  if (next_review_date) {
    const nextReviewDate = new Date(next_review_date);
    nextReviewDate.setHours(0, 0, 0, 0);

    if (nextReviewDate <= today) {
      warnings.push('Bir sonraki gözden geçirme tarihi geçmiş - risk güncellemesi gerekiyor');
    }

    if (last_review_date) {
      const lastReviewDate = new Date(last_review_date);
      lastReviewDate.setHours(0, 0, 0, 0);

      if (nextReviewDate <= lastReviewDate) {
        errors.push('Bir sonraki gözden geçirme tarihi son gözden geçirme tarihinden sonra olmalıdır');
      }
    }
  }

  if (target_date) {
    const targetDate = new Date(target_date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate <= today) {
      warnings.push('Hedef risk seviyesi tarihi geçmiş - hedefler revize edilmeli');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function calculateRiskScore(likelihood: number, impact: number): number {
  if (likelihood < 1 || likelihood > 5 || impact < 1 || impact > 5) {
    throw new Error('Olasılık ve etki değerleri 1 ile 5 arasında olmalıdır');
  }
  return likelihood * impact;
}

export function getRiskLevel(score: number): {
  level: string;
  color: string;
  emoji: string;
  description: string;
} {
  if (score >= 16) {
    return {
      level: 'VERY_HIGH',
      color: 'red',
      emoji: '🔴',
      description: 'Çok Yüksek Risk - Acil eylem gerekli'
    };
  }
  if (score >= 12) {
    return {
      level: 'HIGH',
      color: 'orange',
      emoji: '🟠',
      description: 'Yüksek Risk - Öncelikli eylem gerekli'
    };
  }
  if (score >= 8) {
    return {
      level: 'MEDIUM',
      color: 'yellow',
      emoji: '🟡',
      description: 'Orta Risk - Planlı eylem gerekli'
    };
  }
  if (score >= 4) {
    return {
      level: 'LOW_MEDIUM',
      color: 'lime',
      emoji: '🟢',
      description: 'Düşük-Orta Risk - İzleme gerekli'
    };
  }
  return {
    level: 'LOW',
    color: 'green',
    emoji: '🟢',
    description: 'Düşük Risk - Normal izleme'
  };
}

export function calculateRiskReduction(inherent_score: number, residual_score: number): {
  reduction_points: number;
  reduction_percentage: number;
  effectiveness: string;
} {
  const reduction_points = inherent_score - residual_score;
  const reduction_percentage = inherent_score > 0
    ? Math.round((reduction_points / inherent_score) * 100)
    : 0;

  let effectiveness = 'NONE';
  if (reduction_percentage >= 75) effectiveness = 'EXCELLENT';
  else if (reduction_percentage >= 50) effectiveness = 'GOOD';
  else if (reduction_percentage >= 25) effectiveness = 'MODERATE';
  else if (reduction_percentage > 0) effectiveness = 'LOW';

  return {
    reduction_points,
    reduction_percentage,
    effectiveness
  };
}

export function isRiskOverdue(next_review_date: string | null): boolean {
  if (!next_review_date) return false;

  const reviewDate = new Date(next_review_date);
  reviewDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return reviewDate < today;
}

export function getReviewStatus(
  last_review_date: string | null,
  next_review_date: string | null
): {
  status: 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'NOT_SCHEDULED';
  daysUntilReview: number | null;
  message: string;
} {
  if (!next_review_date) {
    return {
      status: 'NOT_SCHEDULED',
      daysUntilReview: null,
      message: 'Gözden geçirme tarihi planlanmamış'
    };
  }

  const reviewDate = new Date(next_review_date);
  reviewDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = reviewDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'OVERDUE',
      daysUntilReview: diffDays,
      message: `${Math.abs(diffDays)} gün gecikmiş`
    };
  }

  if (diffDays <= 7) {
    return {
      status: 'DUE_SOON',
      daysUntilReview: diffDays,
      message: `${diffDays} gün içinde gözden geçirilmeli`
    };
  }

  return {
    status: 'CURRENT',
    daysUntilReview: diffDays,
    message: `${diffDays} gün sonra gözden geçirilecek`
  };
}

export function validateRiskBeforeApproval(risk: any): RiskValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!risk.name || risk.name.trim() === '') {
    errors.push('Risk adı zorunludur');
  }

  if (!risk.description || risk.description.trim() === '') {
    warnings.push('Risk açıklaması eklenmesi önerilir');
  }

  if (!risk.owner_department_id) {
    errors.push('Risk sahibi departman seçilmelidir');
  }

  if (!risk.inherent_likelihood || !risk.inherent_impact) {
    errors.push('İçsel risk değerlendirmesi yapılmalıdır');
  }

  if (!risk.residual_likelihood || !risk.residual_impact) {
    errors.push('Artık risk değerlendirmesi yapılmalıdır');
  }

  if (!risk.risk_response) {
    errors.push('Risk yanıt stratejisi seçilmelidir');
  }

  const scoreValidation = validateRiskScore({
    inherent_likelihood: risk.inherent_likelihood || 0,
    inherent_impact: risk.inherent_impact || 0,
    residual_likelihood: risk.residual_likelihood || 0,
    residual_impact: risk.residual_impact || 0
  });

  errors.push(...scoreValidation.errors);
  warnings.push(...scoreValidation.warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function suggestReviewFrequency(score: number): {
  frequency: string;
  period_months: number;
  rationale: string;
} {
  if (score >= 16) {
    return {
      frequency: 'MONTHLY',
      period_months: 1,
      rationale: 'Çok yüksek risk - aylık gözden geçirme önerilir'
    };
  }
  if (score >= 12) {
    return {
      frequency: 'QUARTERLY',
      period_months: 3,
      rationale: 'Yüksek risk - 3 ayda bir gözden geçirme önerilir'
    };
  }
  if (score >= 8) {
    return {
      frequency: 'SEMI_ANNUAL',
      period_months: 6,
      rationale: 'Orta risk - 6 ayda bir gözden geçirme önerilir'
    };
  }
  return {
    frequency: 'ANNUAL',
    period_months: 12,
    rationale: 'Düşük risk - yıllık gözden geçirme yeterli'
  };
}
