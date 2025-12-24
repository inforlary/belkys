export interface CodeGenerationContext {
  organizationId: string;
  strategicPlanId?: string;
  objectiveId?: string;
  goalId?: string;
}

export async function generateObjectiveCode(
  supabase: any,
  context: CodeGenerationContext
): Promise<string> {
  const { data: existingObjectives } = await supabase
    .from('objectives')
    .select('code')
    .eq('strategic_plan_id', context.strategicPlanId)
    .order('code', { ascending: false })
    .limit(1);

  if (!existingObjectives || existingObjectives.length === 0) {
    return 'A1';
  }

  const lastCode = existingObjectives[0].code;
  const match = lastCode.match(/^A(\d+)$/);

  if (match) {
    const nextNumber = parseInt(match[1]) + 1;
    return `A${nextNumber}`;
  }

  return 'A1';
}

export async function generateGoalCode(
  supabase: any,
  context: CodeGenerationContext
): Promise<string> {
  const { data: objective } = await supabase
    .from('objectives')
    .select('code')
    .eq('id', context.objectiveId)
    .single();

  if (!objective) {
    return 'H1.1';
  }

  const { data: existingGoals } = await supabase
    .from('goals')
    .select('code')
    .eq('objective_id', context.objectiveId)
    .order('code', { ascending: false })
    .limit(1);

  const objectiveNumber = objective.code.replace('A', '');

  if (!existingGoals || existingGoals.length === 0) {
    return `H${objectiveNumber}.1`;
  }

  const lastCode = existingGoals[0].code;
  const match = lastCode.match(/^H(\d+)\.(\d+)$/);

  if (match) {
    const nextNumber = parseInt(match[2]) + 1;
    return `H${objectiveNumber}.${nextNumber}`;
  }

  return `H${objectiveNumber}.1`;
}

export async function generateIndicatorCode(
  supabase: any,
  context: CodeGenerationContext
): Promise<string> {
  const { data: goal } = await supabase
    .from('goals')
    .select('code')
    .eq('id', context.goalId)
    .single();

  if (!goal) {
    return 'PG1.1.1';
  }

  const { data: existingIndicators } = await supabase
    .from('indicators')
    .select('code')
    .eq('goal_id', context.goalId)
    .order('code', { ascending: false })
    .limit(1);

  const goalNumbers = goal.code.replace('H', '');

  if (!existingIndicators || existingIndicators.length === 0) {
    return `PG${goalNumbers}.1`;
  }

  const lastCode = existingIndicators[0].code;
  const match = lastCode.match(/^PG(\d+)\.(\d+)\.(\d+)$/);

  if (match) {
    const nextNumber = parseInt(match[3]) + 1;
    return `PG${goalNumbers}.${nextNumber}`;
  }

  return `PG${goalNumbers}.1`;
}

export async function generateActivityCode(
  supabase: any,
  context: CodeGenerationContext
): Promise<string> {
  const { data: goal } = await supabase
    .from('goals')
    .select('code')
    .eq('id', context.goalId)
    .single();

  if (!goal) {
    return 'F1.1.1';
  }

  const { data: existingActivities } = await supabase
    .from('activities')
    .select('code')
    .eq('goal_id', context.goalId)
    .order('code', { ascending: false })
    .limit(1);

  const goalNumbers = goal.code.replace('H', '');

  if (!existingActivities || existingActivities.length === 0) {
    return `F${goalNumbers}.1`;
  }

  const lastCode = existingActivities[0].code;
  const match = lastCode.match(/^F(\d+)\.(\d+)\.(\d+)$/);

  if (match) {
    const nextNumber = parseInt(match[3]) + 1;
    const basePart = lastCode.substring(0, lastCode.lastIndexOf('.'));
    return `${basePart}.${nextNumber}`;
  }

  return `F${goalNumbers}.1`;
}

export function generateYearTargets(
  startYear: number,
  endYear: number,
  baselineValue: number,
  targetValue: number
): Array<{ year: number; target_value: number }> {
  const targets: Array<{ year: number; target_value: number }> = [];
  const totalYears = endYear - startYear;
  const increment = (targetValue - baselineValue) / totalYears;

  for (let year = startYear; year <= endYear; year++) {
    const yearsFromStart = year - startYear;
    const calculatedTarget = baselineValue + (increment * yearsFromStart);

    targets.push({
      year,
      target_value: Math.round(calculatedTarget * 100) / 100
    });
  }

  return targets;
}
