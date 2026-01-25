import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { User, Building2, Target, CheckCircle, Clock, AlertCircle, TrendingUp, Award, BarChart3, Activity, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import type { Profile, Department } from '../types/database';
import * as XLSX from 'xlsx';
import { calculateIndicatorProgress, calculateGoalProgress, calculateObjectiveProgress, getProgressColor } from '../utils/progressCalculations';
import {
  getIndicatorStatus,
  getStatusConfig,
  getStatusLabel,
  IndicatorStatus
} from '../utils/indicatorStatus';

interface VPWithDepartments {
  id: string;
  full_name: string;
  email: string;
  departments: Department[];
}

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  active_indicators: number;
  data_entries: number;
  pending_approvals: number;
  approved_entries: number;
  rejected_entries: number;
  completion_rate: number;
}

interface VPOverallPerformance {
  total_departments: number;
  total_indicators: number;
  total_data_entries: number;
  total_approved: number;
  total_pending: number;
  total_rejected: number;
  overall_completion_rate: number;
  performance_grade: string;
  performance_color: string;
}

interface IndicatorQuarterlyData {
  indicator_id: string;
  indicator_code: string;
  indicator_name: string;
  unit: string;
  yearly_target: number;
  baseline_value: number;
  q1_target: number;
  q1_actual: number;
  q1_rate: number;
  q2_target: number;
  q2_actual: number;
  q2_rate: number;
  q3_target: number;
  q3_actual: number;
  q3_rate: number;
  q4_target: number;
  q4_actual: number;
  q4_rate: number;
  total_actual: number;
  success_rate: number;
  progress_percentage: number;
  status: IndicatorStatus;
}

interface GoalDetail {
  goal_id: string;
  goal_code: string;
  goal_name: string;
  indicators: IndicatorQuarterlyData[];
  success_rate: number;
  progress_percentage: number;
  status: IndicatorStatus;
}

interface ObjectiveDetail {
  objective_id: string;
  objective_code: string;
  objective_name: string;
  goals: GoalDetail[];
  success_rate: number;
  progress_percentage: number;
  status: IndicatorStatus;
}

interface StrategicPlanGroup {
  plan_id: string;
  plan_name: string;
  plan_years: string;
  objectives: ObjectiveDetail[];
  success_rate: number;
  progress_percentage: number;
  status: IndicatorStatus;
}

interface DepartmentStrategicData {
  department_id: string;
  department_name: string;
  plans: StrategicPlanGroup[];
  overall_success_rate: number;
}

interface VPStrategicPerformance {
  total_plans: number;
  total_objectives: number;
  total_goals: number;
  total_indicators: number;
  overall_success_rate: number;
  performance_grade: string;
  performance_color: string;
}

export default function VicePresidentPerformance() {
  const { profile } = useAuth();
  const [vicePresidents, setVicePresidents] = useState<VPWithDepartments[]>([]);
  const [selectedVP, setSelectedVP] = useState<string | null>(null);
  const [performance, setPerformance] = useState<DepartmentPerformance[]>([]);
  const [overallPerformance, setOverallPerformance] = useState<VPOverallPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [strategicPerformance, setStrategicPerformance] = useState<VPStrategicPerformance | null>(null);
  const [departmentStrategicData, setDepartmentStrategicData] = useState<DepartmentStrategicData[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadVicePresidents();
  }, []);

  useEffect(() => {
    if (selectedVP) {
      loadPerformance();
      loadStrategicPerformance();
    }
  }, [selectedVP, selectedYear]);

  async function loadVicePresidents() {
    setLoading(true);
    try {
      const { data: vps, error: vpsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'vice_president')
        .eq('organization_id', profile?.organization_id)
        .order('full_name');

      if (vpsError) throw vpsError;

      if (vps && vps.length > 0) {
        const vpsWithDepts: VPWithDepartments[] = [];

        for (const vp of vps) {
          const { data: vpDepts, error: vpDeptsError } = await supabase
            .from('vice_president_departments')
            .select('department_id')
            .eq('vice_president_id', vp.id);

          if (vpDeptsError) {
            console.error('Error loading departments for VP:', vp.id, vpDeptsError);
            vpsWithDepts.push({
              id: vp.id,
              full_name: vp.full_name,
              email: vp.email,
              departments: [],
            });
            continue;
          }

          const departmentIds = vpDepts?.map(d => d.department_id) || [];

          if (departmentIds.length === 0) {
            vpsWithDepts.push({
              id: vp.id,
              full_name: vp.full_name,
              email: vp.email,
              departments: [],
            });
            continue;
          }

          const { data: departments, error: deptsError } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', departmentIds)
            .order('name');

          if (deptsError) {
            console.error('Error loading department details:', deptsError);
          }

          console.log('VP', vp.full_name, 'has', departments?.length || 0, 'departments:', departments);

          vpsWithDepts.push({
            id: vp.id,
            full_name: vp.full_name,
            email: vp.email,
            departments: departments || [],
          });
        }

        setVicePresidents(vpsWithDepts);
        if (vpsWithDepts.length > 0) {
          setSelectedVP(vpsWithDepts[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading vice presidents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformance() {
    if (!selectedVP) return;

    try {
      const vp = vicePresidents.find(v => v.id === selectedVP);
      if (!vp || vp.departments.length === 0) {
        setPerformance([]);
        setOverallPerformance(null);
        return;
      }

      const departmentIds = vp.departments.map(d => d.id);
      const performanceData: DepartmentPerformance[] = [];

      let totalIndicators = 0;
      let totalDataEntries = 0;
      let totalApproved = 0;
      let totalPending = 0;
      let totalRejected = 0;

      for (const dept of vp.departments) {
        console.log('Loading performance for department:', dept.name, dept.id);

        const { data: goals, error: goalsError } = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile?.organization_id)
          .eq('department_id', dept.id);

        if (goalsError) {
          console.error('Error loading goals for dept:', dept.id, goalsError);
          throw goalsError;
        }

        console.log('Goals for', dept.name, ':', goals);

        const goalIds = goals?.map(g => g.id) || [];

        if (goalIds.length === 0) {
          performanceData.push({
            department_id: dept.id,
            department_name: dept.name,
            total_indicators: 0,
            active_indicators: 0,
            data_entries: 0,
            pending_approvals: 0,
            approved_entries: 0,
            rejected_entries: 0,
            completion_rate: 0,
          });
          continue;
        }

        const { data: indicators, error: indicatorsError } = await supabase
          .from('indicators')
          .select('id')
          .in('goal_id', goalIds);

        if (indicatorsError) {
          console.error('Error loading indicators for goals:', goalIds, indicatorsError);
          throw indicatorsError;
        }

        console.log('Indicators for', dept.name, ':', indicators);

        const indicatorIds = indicators?.map(i => i.id) || [];
        const deptTotalIndicators = indicatorIds.length;
        totalIndicators += deptTotalIndicators;

        if (indicatorIds.length === 0) {
          performanceData.push({
            department_id: dept.id,
            department_name: dept.name,
            total_indicators: 0,
            active_indicators: 0,
            data_entries: 0,
            pending_approvals: 0,
            approved_entries: 0,
            rejected_entries: 0,
            completion_rate: 0,
          });
          continue;
        }

        const { data: entries, error: entriesError } = await supabase
          .from('indicator_data_entries')
          .select('id, status, period_quarter, period_year')
          .in('indicator_id', indicatorIds)
          .eq('period_year', selectedYear);

        if (entriesError) {
          console.error('Error loading entries for indicators:', indicatorIds, entriesError);
          throw entriesError;
        }

        console.log('Entries for', dept.name, ':', entries);

        const totalEntries = entries?.length || 0;
        const pendingApprovals = entries?.filter(e => e.status === 'pending' || e.status === 'submitted_to_director' || e.status === 'submitted_to_admin').length || 0;
        const approvedEntries = entries?.filter(e => e.status === 'approved' || e.status === 'admin_approved').length || 0;
        const rejectedEntries = entries?.filter(e => e.status === 'rejected').length || 0;

        totalDataEntries += totalEntries;
        totalApproved += approvedEntries;
        totalPending += pendingApprovals;
        totalRejected += rejectedEntries;

        const expectedEntries = deptTotalIndicators * 4;
        const completionRate = expectedEntries > 0 ? (approvedEntries / expectedEntries) * 100 : 0;

        performanceData.push({
          department_id: dept.id,
          department_name: dept.name,
          total_indicators: deptTotalIndicators,
          active_indicators: deptTotalIndicators,
          data_entries: totalEntries,
          pending_approvals: pendingApprovals,
          approved_entries: approvedEntries,
          rejected_entries: rejectedEntries,
          completion_rate: completionRate,
        });
      }

      const expectedTotalEntries = totalIndicators * 4;
      const overallCompletionRate = expectedTotalEntries > 0 ? (totalApproved / expectedTotalEntries) * 100 : 0;

      let grade = '';
      let color = '';
      if (overallCompletionRate >= 90) {
        grade = 'Mükemmel';
        color = 'emerald';
      } else if (overallCompletionRate >= 80) {
        grade = 'Çok İyi';
        color = 'green';
      } else if (overallCompletionRate >= 70) {
        grade = 'İyi';
        color = 'blue';
      } else if (overallCompletionRate >= 60) {
        grade = 'Orta';
        color = 'yellow';
      } else if (overallCompletionRate >= 50) {
        grade = 'Zayıf';
        color = 'orange';
      } else {
        grade = 'Yetersiz';
        color = 'red';
      }

      setOverallPerformance({
        total_departments: vp.departments.length,
        total_indicators: totalIndicators,
        total_data_entries: totalDataEntries,
        total_approved: totalApproved,
        total_pending: totalPending,
        total_rejected: totalRejected,
        overall_completion_rate: overallCompletionRate,
        performance_grade: grade,
        performance_color: color,
      });

      setPerformance(performanceData.sort((a, b) => b.completion_rate - a.completion_rate));
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  }

  async function loadStrategicPerformance() {
    if (!selectedVP) return;

    try {
      const vp = vicePresidents.find(v => v.id === selectedVP);
      if (!vp || vp.departments.length === 0) {
        setStrategicPerformance(null);
        setDepartmentStrategicData([]);
        return;
      }

      const departmentsData: DepartmentStrategicData[] = [];

      for (const dept of vp.departments) {
        const { data: goals, error: goalsError } = await supabase
          .from('goals')
          .select(`
            id,
            code,
            title,
            objective:objectives!inner(
              id,
              code,
              title,
              strategic_plan:strategic_plans!inner(
                id,
                name,
                start_year,
                end_year
              )
            )
          `)
          .eq('department_id', dept.id)
          .eq('organization_id', profile?.organization_id);

        if (goalsError) {
          console.error('Error loading goals for dept:', dept.name, goalsError);
          departmentsData.push({
            department_id: dept.id,
            department_name: dept.name,
            plans: [],
            overall_success_rate: 0,
          });
          continue;
        }

        if (!goals || goals.length === 0) {
          departmentsData.push({
            department_id: dept.id,
            department_name: dept.name,
            plans: [],
            overall_success_rate: 0,
          });
          continue;
        }

        const planGroups = new Map<string, StrategicPlanGroup>();

        for (const goal of goals) {
          if (!goal.objective || !goal.objective.strategic_plan) continue;

          const plan = goal.objective.strategic_plan;
          const objective = goal.objective;
          const planKey = plan.id;

          if (!planGroups.has(planKey)) {
            planGroups.set(planKey, {
              plan_id: plan.id,
              plan_name: plan.name,
              plan_years: `${plan.start_year}-${plan.end_year}`,
              objectives: [],
              success_rate: 0,
            });
          }

          const planGroup = planGroups.get(planKey)!;
          let objectiveDetail = planGroup.objectives.find(o => o.objective_id === objective.id);

          if (!objectiveDetail) {
            objectiveDetail = {
              objective_id: objective.id,
              objective_code: objective.code,
              objective_name: objective.title,
              goals: [],
              success_rate: 0,
            };
            planGroup.objectives.push(objectiveDetail);
          }

          const { data: indicators, error: indicatorsError } = await supabase
            .from('indicators')
            .select('id, code, name, unit, target_value, calculation_method, baseline_value, goal_impact_percentage')
            .eq('goal_id', goal.id);

          if (indicatorsError || !indicators || indicators.length === 0) {
            objectiveDetail.goals.push({
              goal_id: goal.id,
              goal_code: goal.code,
              goal_name: goal.title,
              indicators: [],
              success_rate: 0,
              progress_percentage: 0,
              status: 'very_weak' as IndicatorStatus,
            });
            continue;
          }

          const { data: targetsData } = await supabase
            .from('indicator_targets')
            .select('indicator_id, year, target_value')
            .in('indicator_id', indicators.map(i => i.id))
            .in('year', [selectedYear, selectedYear - 1]);

          const targetsByIndicator: Record<string, number> = {};
          const baselineByIndicator: Record<string, number> = {};

          targetsData?.forEach(target => {
            if (target.year === selectedYear) {
              targetsByIndicator[target.indicator_id] = target.target_value;
            } else if (target.year === selectedYear - 1) {
              baselineByIndicator[target.indicator_id] = target.target_value;
            }
          });

          const { data: allEntries } = await supabase
            .from('indicator_data_entries')
            .select('indicator_id, period_quarter, value, status')
            .in('indicator_id', indicators.map(i => i.id))
            .eq('period_year', selectedYear)
            .eq('status', 'approved');

          const indicatorsData: IndicatorQuarterlyData[] = [];

          for (const indicator of indicators) {
            const { data: targets } = await supabase
              .from('indicator_targets')
              .select('quarter_1_value, quarter_2_value, quarter_3_value, quarter_4_value')
              .eq('indicator_id', indicator.id)
              .eq('year', selectedYear)
              .maybeSingle();

            const entries = allEntries?.filter(e => e.indicator_id === indicator.id) || [];

            let q1Target = targets?.quarter_1_value || 0;
            let q2Target = targets?.quarter_2_value || 0;
            let q3Target = targets?.quarter_3_value || 0;
            let q4Target = targets?.quarter_4_value || 0;

            if (q1Target === 0 && q2Target === 0 && q3Target === 0 && q4Target === 0 && indicator.target_value) {
              const yearlyTarget = Number(indicator.target_value) || 0;
              if (indicator.calculation_method === 'cumulative') {
                q1Target = yearlyTarget * 0.25;
                q2Target = yearlyTarget * 0.50;
                q3Target = yearlyTarget * 0.75;
                q4Target = yearlyTarget;
              } else {
                q1Target = yearlyTarget / 4;
                q2Target = yearlyTarget / 4;
                q3Target = yearlyTarget / 4;
                q4Target = yearlyTarget / 4;
              }
            }

            const actualsMap = new Map<number, number>();
            if (entries && entries.length > 0) {
              entries.forEach(e => {
                if (e.value !== null && e.value !== undefined && e.period_quarter) {
                  actualsMap.set(e.period_quarter, e.value);
                }
              });
            }

            const q1Actual = actualsMap.get(1) || 0;
            const q1Rate = q1Target > 0 ? (q1Actual / q1Target) * 100 : 0;

            const q2Actual = actualsMap.get(2) || 0;
            const q2Rate = q2Target > 0 ? (q2Actual / q2Target) * 100 : 0;

            const q3Actual = actualsMap.get(3) || 0;
            const q3Rate = q3Target > 0 ? (q3Actual / q3Target) * 100 : 0;

            const q4Actual = actualsMap.get(4) || 0;
            const q4Rate = q4Target > 0 ? (q4Actual / q4Target) * 100 : 0;

            let yearlyTarget = targetsByIndicator[indicator.id] || indicator.target_value || 0;
            let baselineValue = baselineByIndicator[indicator.id] !== undefined
              ? baselineByIndicator[indicator.id]
              : (indicator.baseline_value || 0);

            let totalActual: number;
            let successRate: number;

            if (indicator.calculation_method === 'cumulative' || indicator.calculation_method === 'cumulative_increasing') {
              totalActual = q4Actual;
              successRate = yearlyTarget > 0 ? (totalActual / yearlyTarget) * 100 : (totalActual > 0 ? 100 : 0);
            } else {
              totalActual = q1Actual + q2Actual + q3Actual + q4Actual;
              successRate = yearlyTarget > 0 ? (totalActual / yearlyTarget) * 100 : (totalActual > 0 ? 100 : 0);
            }

            const dataEntriesForIndicator = entries.map(e => ({
              indicator_id: e.indicator_id,
              value: e.value,
              status: e.status
            }));

            const progress = calculateIndicatorProgress(
              {
                id: indicator.id,
                goal_id: goal.id,
                yearly_target: yearlyTarget,
                target_value: yearlyTarget,
                baseline_value: baselineValue,
                calculation_method: indicator.calculation_method || 'cumulative_increasing',
                goal_impact_percentage: indicator.goal_impact_percentage
              },
              dataEntriesForIndicator
            );

            const status = getIndicatorStatus(progress);

            indicatorsData.push({
              indicator_id: indicator.id,
              indicator_code: indicator.code,
              indicator_name: indicator.name,
              unit: indicator.unit || '',
              yearly_target: yearlyTarget,
              baseline_value: baselineValue,
              q1_target: q1Target,
              q1_actual: q1Actual,
              q1_rate: q1Rate,
              q2_target: q2Target,
              q2_actual: q2Actual,
              q2_rate: q2Rate,
              q3_target: q3Target,
              q3_actual: q3Actual,
              q3_rate: q3Rate,
              q4_target: q4Target,
              q4_actual: q4Actual,
              q4_rate: q4Rate,
              total_actual: totalActual,
              success_rate: successRate,
              progress_percentage: progress,
              status: status,
            });
          }

          const goalSuccessRate = indicatorsData.length > 0
            ? indicatorsData.reduce((sum, ind) => sum + ind.success_rate, 0) / indicatorsData.length
            : 0;

          const indicatorsForGoalProgress = indicatorsData.map(ind => ({
            id: ind.indicator_id,
            goal_id: goal.id,
            goal_impact_percentage: indicators.find(i => i.id === ind.indicator_id)?.goal_impact_percentage,
            yearly_target: ind.yearly_target,
            target_value: ind.yearly_target,
            baseline_value: ind.baseline_value,
            calculation_method: indicators.find(i => i.id === ind.indicator_id)?.calculation_method
          }));

          const goalProgress = calculateGoalProgress(
            goal.id,
            indicatorsForGoalProgress,
            allEntries?.map(e => ({ indicator_id: e.indicator_id, value: e.value, status: e.status })) || []
          );

          const goalStatus = getIndicatorStatus(goalProgress);

          objectiveDetail.goals.push({
            goal_id: goal.id,
            goal_code: goal.code,
            goal_name: goal.title,
            indicators: indicatorsData,
            success_rate: goalSuccessRate,
            progress_percentage: goalProgress,
            status: goalStatus,
          });
        }

        const plans: StrategicPlanGroup[] = Array.from(planGroups.values());
        plans.forEach(plan => {
          plan.objectives.forEach(obj => {
            obj.success_rate = obj.goals.length > 0
              ? obj.goals.reduce((sum, g) => sum + g.success_rate, 0) / obj.goals.length
              : 0;

            const allGoals = obj.goals.map(g => ({ id: g.goal_id, objective_id: obj.objective_id }));
            const allIndicatorsForObj = obj.goals.flatMap(g =>
              g.indicators.map(ind => ({
                id: ind.indicator_id,
                goal_id: g.goal_id,
                goal_impact_percentage: indicators.find(i => i.id === ind.indicator_id)?.goal_impact_percentage,
                yearly_target: ind.yearly_target,
                target_value: ind.yearly_target,
                baseline_value: ind.baseline_value,
                calculation_method: indicators.find(i => i.id === ind.indicator_id)?.calculation_method
              }))
            );
            const allEntriesForObj = allEntries?.map(e => ({ indicator_id: e.indicator_id, value: e.value, status: e.status })) || [];

            const objectiveProgress = calculateObjectiveProgress(
              obj.objective_id,
              allGoals,
              allIndicatorsForObj,
              allEntriesForObj
            );

            obj.progress_percentage = objectiveProgress;
            obj.status = getIndicatorStatus(objectiveProgress);
          });

          plan.success_rate = plan.objectives.length > 0
            ? plan.objectives.reduce((sum, o) => sum + o.success_rate, 0) / plan.objectives.length
            : 0;

          plan.progress_percentage = plan.objectives.length > 0
            ? plan.objectives.reduce((sum, o) => sum + o.progress_percentage, 0) / plan.objectives.length
            : 0;

          plan.status = getIndicatorStatus(plan.progress_percentage);
        });

        const deptSuccessRate = plans.length > 0
          ? plans.reduce((sum, p) => sum + p.success_rate, 0) / plans.length
          : 0;

        departmentsData.push({
          department_id: dept.id,
          department_name: dept.name,
          plans,
          overall_success_rate: deptSuccessRate,
        });
      }

      let totalPlans = 0;
      let totalObjectives = 0;
      let totalGoals = 0;
      let totalIndicators = 0;
      const departmentSuccessRates: number[] = [];

      departmentsData.forEach(deptData => {
        departmentSuccessRates.push(deptData.overall_success_rate);
        deptData.plans.forEach(plan => {
          totalPlans++;
          plan.objectives.forEach(obj => {
            totalObjectives++;
            obj.goals.forEach(goal => {
              totalGoals++;
              totalIndicators += goal.indicators.length;
            });
          });
        });
      });

      const overallSuccessRate = departmentSuccessRates.length > 0
        ? departmentSuccessRates.reduce((sum, rate) => sum + rate, 0) / departmentSuccessRates.length
        : 0;

      let grade = '';
      let color = '';
      if (overallSuccessRate >= 90) {
        grade = 'Mükemmel';
        color = 'emerald';
      } else if (overallSuccessRate >= 80) {
        grade = 'Çok İyi';
        color = 'green';
      } else if (overallSuccessRate >= 70) {
        grade = 'İyi';
        color = 'blue';
      } else if (overallSuccessRate >= 60) {
        grade = 'Orta';
        color = 'yellow';
      } else if (overallSuccessRate >= 50) {
        grade = 'Zayıf';
        color = 'orange';
      } else {
        grade = 'Yetersiz';
        color = 'red';
      }

      setStrategicPerformance({
        total_plans: totalPlans,
        total_objectives: totalObjectives,
        total_goals: totalGoals,
        total_indicators: totalIndicators,
        overall_success_rate: overallSuccessRate,
        performance_grade: grade,
        performance_color: color,
      });

      setDepartmentStrategicData(departmentsData);
    } catch (error) {
      console.error('Error loading strategic performance:', error);
    }
  }

  async function exportToExcel() {
    if (!selectedVP || !overallPerformance) return;

    setExportLoading(true);
    try {
      const vp = vicePresidents.find(v => v.id === selectedVP);
      if (!vp) return;

      const workbook = XLSX.utils.book_new();

      const summaryData = [
        ['Başkan Yardımcısı Performans Raporu'],
        [''],
        ['Başkan Yardımcısı:', vp.full_name],
        ['E-posta:', vp.email],
        ['Dönem:', selectedYear],
        ['Rapor Tarihi:', new Date().toLocaleDateString('tr-TR')],
        [''],
        ['VERİ GİRİŞİ PERFORMANSI'],
        ['Toplam Müdürlük:', overallPerformance.total_departments],
        ['Toplam Gösterge:', overallPerformance.total_indicators],
        ['Toplam Veri Girişi:', overallPerformance.total_data_entries],
        ['Onaylı:', overallPerformance.total_approved],
        ['Bekleyen:', overallPerformance.total_pending],
        ['Reddedilen:', overallPerformance.total_rejected],
        ['Tamamlanma Oranı:', `%${overallPerformance.overall_completion_rate.toFixed(1)}`],
        ['Performans Notu:', overallPerformance.performance_grade],
        [''],
      ];

      if (strategicPerformance) {
        summaryData.push(
          ['STRATEJİK PLAN PERFORMANSI'],
          ['Toplam Plan:', strategicPerformance.total_plans],
          ['Toplam Amaç:', strategicPerformance.total_objectives],
          ['Toplam Hedef:', strategicPerformance.total_goals],
          ['Toplam Gösterge:', strategicPerformance.total_indicators],
          ['Ortalama Başarı Oranı:', `%${strategicPerformance.overall_success_rate.toFixed(1)}`],
          ['Performans Notu:', strategicPerformance.performance_grade],
          ['']
        );
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Özet');

      const deptPerformanceData = [
        ['Müdürlük Adı', 'Toplam Gösterge', 'Toplam Veri', 'Onaylı', 'Bekleyen', 'Red', 'Tamamlanma Oranı (%)'],
      ];
      performance.forEach(dept => {
        deptPerformanceData.push([
          dept.department_name,
          dept.total_indicators,
          dept.data_entries,
          dept.approved_entries,
          dept.pending_approvals,
          dept.rejected_entries,
          dept.completion_rate.toFixed(1),
        ]);
      });
      const deptSheet = XLSX.utils.aoa_to_sheet(deptPerformanceData);
      deptSheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(workbook, deptSheet, 'Veri Girişi Performansı');

      for (const deptData of departmentStrategicData) {
        if (deptData.plans.length === 0) continue;

        const strategicData: any[][] = [
          ['STRATEJIK PLAN PERFORMANS DETAYI'],
          ['Müdürlük:', deptData.department_name],
          ['Genel Başarı Oranı:', `%${deptData.overall_success_rate.toFixed(1)}`],
          [''],
        ];

        for (const plan of deptData.plans) {
          strategicData.push(
            [`Plan: ${plan.plan_name} (${plan.plan_years}) - %${plan.progress_percentage.toFixed(1)} İlerleme`],
            [''],
            ['Amaç Kodu', 'Amaç Adı', 'Amaç İlerleme', 'Amaç Durum', 'Hedef Kodu', 'Hedef Adı', 'Hedef İlerleme', 'Hedef Durum', 'Gösterge Kodu', 'Gösterge Adı', 'Birim', 'Yıllık Hedef', 'Başlangıç', 'Q1 Hedef', 'Q1 Gerçekleşen', 'Q2 Hedef', 'Q2 Gerçekleşen', 'Q3 Hedef', 'Q3 Gerçekleşen', 'Q4 Hedef', 'Q4 Gerçekleşen', 'Toplam Gerçekleşen', 'İlerleme (%)', 'Durum']
          );

          for (const objective of plan.objectives) {
            for (const goal of objective.goals) {
              for (const indicator of goal.indicators) {
                const objStatusConfig = getStatusConfig(objective.status);
                const goalStatusConfig = getStatusConfig(goal.status);
                const indStatusConfig = getStatusConfig(indicator.status);

                strategicData.push([
                  objective.objective_code,
                  objective.objective_name,
                  `%${objective.progress_percentage}`,
                  objStatusConfig.label,
                  goal.goal_code,
                  goal.goal_name,
                  `%${goal.progress_percentage}`,
                  goalStatusConfig.label,
                  indicator.indicator_code,
                  indicator.indicator_name,
                  indicator.unit,
                  indicator.yearly_target.toFixed(1),
                  indicator.baseline_value.toFixed(1),
                  indicator.q1_target.toFixed(1),
                  indicator.q1_actual.toFixed(1),
                  indicator.q2_target.toFixed(1),
                  indicator.q2_actual.toFixed(1),
                  indicator.q3_target.toFixed(1),
                  indicator.q3_actual.toFixed(1),
                  indicator.q4_target.toFixed(1),
                  indicator.q4_actual.toFixed(1),
                  indicator.total_actual.toFixed(1),
                  indicator.progress_percentage,
                  indStatusConfig.label,
                ]);
              }
            }
          }
          strategicData.push(['']);
        }

        const strategicSheet = XLSX.utils.aoa_to_sheet(strategicData);
        strategicSheet['!cols'] = [
          { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 15 },
          { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 15 },
          { wch: 12 }, { wch: 35 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
          { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
          { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
          { wch: 15 }, { wch: 12 }, { wch: 15 }
        ];

        const sheetName = deptData.department_name.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, strategicSheet, sheetName);
      }

      const fileName = `BaskanYardimcisi_${vp.full_name.replace(/\s+/g, '_')}_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      alert('Excel dosyası başarıyla indirildi!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Excel dosyası oluşturulurken bir hata oluştu.');
    } finally {
      setExportLoading(false);
    }
  }

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-50';
    if (rate >= 60) return 'text-blue-600 bg-blue-50';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getGradeColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-500',
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
    };
    return colors[color] || 'bg-gray-500';
  };

  const getGradeBgColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-50 border-emerald-200',
      green: 'bg-green-50 border-green-200',
      blue: 'bg-blue-50 border-blue-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      orange: 'bg-orange-50 border-orange-200',
      red: 'bg-red-50 border-red-200',
    };
    return colors[color] || 'bg-gray-50 border-gray-200';
  };

  const getGradeTextColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'text-emerald-700',
      green: 'text-green-700',
      blue: 'text-blue-700',
      yellow: 'text-yellow-700',
      orange: 'text-orange-700',
      red: 'text-red-700',
    };
    return colors[color] || 'text-gray-700';
  };

  const selectedVPData = vicePresidents.find(v => v.id === selectedVP);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (vicePresidents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Başkan Yardımcıları Performans Değerlendirmesi</h1>
          <p className="mt-2 text-slate-600">Başkan yardımcılarının genel performansını ve sorumlu oldukları müdürlüklerin detaylı analizini görüntüleyin</p>
        </div>
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Henüz başkan yardımcısı tanımlanmamış</p>
              <p className="text-sm text-slate-400">Başkan yardımcısı eklemek için Kullanıcılar sayfasından yeni kullanıcı oluşturun ve rolünü "Başkan Yardımcısı" olarak belirleyin.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Başkan Yardımcıları Performans Değerlendirmesi</h1>
        <p className="mt-2 text-slate-600">Başkan yardımcılarının genel performansını ve sorumlu oldukları müdürlüklerin detaylı analizini görüntüleyin</p>
      </div>

      <div className="flex gap-4 items-end bg-white rounded-lg p-4 border border-slate-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-2">Yıl</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[2024, 2025, 2026, 2027, 2028].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        {selectedVP && overallPerformance && (
          <button
            onClick={exportToExcel}
            disabled={exportLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {exportLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Hazırlanıyor...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Excel İndir</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {vicePresidents.map((vp) => (
          <button
            key={vp.id}
            onClick={() => setSelectedVP(vp.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selectedVP === vp.id
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{vp.full_name}</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{vp.email}</p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-orange-600">
                  <Building2 className="w-3 h-3" />
                  <span>{vp.departments.length} Müdürlük</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedVP && selectedVPData && (
        <div className="space-y-6">
          {overallPerformance && (
            <div className={`border-2 rounded-2xl overflow-hidden ${getGradeBgColor(overallPerformance.performance_color)}`}>
              <div className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">{selectedVPData.full_name}</h2>
                        <p className="text-slate-600">{selectedVPData.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl ${getGradeColor(overallPerformance.performance_color)} text-white shadow-lg`}>
                      <Award className="w-6 h-6" />
                      <div>
                        <div className="text-2xl font-bold">{overallPerformance.performance_grade}</div>
                        <div className="text-xs opacity-90">Genel Performans</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="text-xs font-medium">Müdürlük</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{overallPerformance.total_departments}</div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-medium">Gösterge</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{overallPerformance.total_indicators}</div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs font-medium">Toplam Veri</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{overallPerformance.total_data_entries}</div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Onaylı</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">{overallPerformance.total_approved}</div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-700 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium">Bekleyen</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-900">{overallPerformance.total_pending}</div>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200">
                    <div className="flex items-center gap-2 text-red-700 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Red</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900">{overallPerformance.total_rejected}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-5 h-5 ${getGradeTextColor(overallPerformance.performance_color)}`} />
                      <span className={`font-bold ${getGradeTextColor(overallPerformance.performance_color)}`}>
                        Genel Tamamlanma Oranı
                      </span>
                    </div>
                    <span className={`text-2xl font-bold ${getGradeTextColor(overallPerformance.performance_color)}`}>
                      %{overallPerformance.overall_completion_rate.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-white rounded-full h-4 shadow-inner border border-slate-200">
                    <div
                      className={`h-4 rounded-full transition-all ${getGradeColor(overallPerformance.performance_color)}`}
                      style={{ width: `${Math.min(overallPerformance.overall_completion_rate, 100)}%` }}
                    />
                  </div>
                </div>

                {strategicPerformance && (
                  <div className="mt-6 pt-6 border-t-2 border-white">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className={`w-5 h-5 ${getGradeTextColor(strategicPerformance.performance_color)}`} />
                        <h3 className={`text-lg font-bold ${getGradeTextColor(strategicPerformance.performance_color)}`}>
                          Stratejik Plan İlerleme Performansı
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <FileText className="w-3 h-3" />
                            <span className="text-xs font-medium">Plan</span>
                          </div>
                          <div className="text-xl font-bold text-slate-900">{strategicPerformance.total_plans}</div>
                        </div>

                        <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Target className="w-3 h-3" />
                            <span className="text-xs font-medium">Amaç</span>
                          </div>
                          <div className="text-xl font-bold text-slate-900">{strategicPerformance.total_objectives}</div>
                        </div>

                        <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Award className="w-3 h-3" />
                            <span className="text-xs font-medium">Hedef</span>
                          </div>
                          <div className="text-xl font-bold text-slate-900">{strategicPerformance.total_goals}</div>
                        </div>

                        <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Activity className="w-3 h-3" />
                            <span className="text-xs font-medium">Gösterge</span>
                          </div>
                          <div className="text-xl font-bold text-slate-900">{strategicPerformance.total_indicators}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${getGradeTextColor(strategicPerformance.performance_color)}`}>
                          Ortalama Başarı Oranı
                        </span>
                        <span className={`text-lg font-bold ${getGradeTextColor(strategicPerformance.performance_color)}`}>
                          %{strategicPerformance.overall_success_rate.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-white rounded-full h-3 shadow-inner border border-slate-200">
                        <div
                          className={`h-3 rounded-full transition-all ${getGradeColor(strategicPerformance.performance_color)}`}
                          style={{ width: `${Math.min(strategicPerformance.overall_success_rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">Müdürlük Bazlı Performans Detayları</h2>
              </div>
              <p className="text-sm text-slate-500 mt-1">Sorumlu müdürlüklerin performans sıralaması (en yüksekten en düşüğe)</p>
            </CardHeader>
            <CardBody>
              {selectedVPData.departments.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Bu başkan yardımcısına henüz müdürlük atanmamış</p>
                </div>
              ) : performance.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Henüz performans verisi yok</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {performance.map((dept, index) => (
                    <div key={dept.department_id} className="border-2 border-slate-200 rounded-xl p-6 bg-white hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold">
                            #{index + 1}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
                              <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-lg">{dept.department_name}</h3>
                              <p className="text-sm text-slate-500">{dept.total_indicators} Gösterge</p>
                            </div>
                          </div>
                        </div>
                        <div className={`px-5 py-3 rounded-xl font-bold text-lg shadow-md ${getCompletionColor(dept.completion_rate)}`}>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            <span>%{dept.completion_rate.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Target className="w-4 h-4" />
                            <span className="text-xs font-medium">Toplam Veri</span>
                          </div>
                          <div className="text-xl font-bold text-blue-900">{dept.data_entries}</div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <div className="flex items-center gap-2 text-green-600 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Onaylı</span>
                          </div>
                          <div className="text-xl font-bold text-green-900">{dept.approved_entries}</div>
                        </div>

                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <div className="flex items-center gap-2 text-yellow-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-medium">Bekleyen</span>
                          </div>
                          <div className="text-xl font-bold text-yellow-900">{dept.pending_approvals}</div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-center gap-2 text-red-600 mb-1">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Red</span>
                          </div>
                          <div className="text-xl font-bold text-red-900">{dept.rejected_entries}</div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
                          <span>İlerleme Durumu</span>
                          <span>{dept.approved_entries} / {dept.total_indicators * 4}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 shadow-inner">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              dept.completion_rate >= 80 ? 'bg-green-600' :
                              dept.completion_rate >= 60 ? 'bg-blue-600' :
                              dept.completion_rate >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(dept.completion_rate, 100)}%` }}
                          />
                        </div>
                      </div>

                      {(() => {
                        const deptStrategicData = departmentStrategicData.find(d => d.department_id === dept.department_id);
                        if (!deptStrategicData || deptStrategicData.plans.length === 0) return null;

                        const isDeptExpanded = expandedDepartments.has(dept.department_id);

                        return (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedDepartments);
                                if (isDeptExpanded) {
                                  newExpanded.delete(dept.department_id);
                                } else {
                                  newExpanded.add(dept.department_id);
                                }
                                setExpandedDepartments(newExpanded);
                              }}
                              className="w-full flex items-center justify-between text-left hover:bg-slate-50 rounded-lg p-2 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="font-semibold text-slate-900">Stratejik Plan Detayları</span>
                                <span className="text-xs text-slate-500">
                                  ({deptStrategicData.plans.length} Plan, %{deptStrategicData.overall_success_rate.toFixed(1)} Başarı)
                                </span>
                              </div>
                              {isDeptExpanded ? (
                                <ChevronUp className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </button>

                            {isDeptExpanded && (
                              <div className="mt-3 space-y-3">
                                {deptStrategicData.plans.map(plan => {
                                  const isPlanExpanded = expandedPlans.has(plan.plan_id);

                                  return (
                                    <div key={plan.plan_id} className="border border-slate-300 rounded-lg overflow-hidden">
                                      <button
                                        onClick={() => {
                                          const newExpanded = new Set(expandedPlans);
                                          if (isPlanExpanded) {
                                            newExpanded.delete(plan.plan_id);
                                          } else {
                                            newExpanded.add(plan.plan_id);
                                          }
                                          setExpandedPlans(newExpanded);
                                        }}
                                        className="w-full flex items-center justify-between bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-slate-700" />
                                          <div className="text-left">
                                            <div className="font-semibold text-slate-900">{plan.plan_name}</div>
                                            <div className="text-xs text-slate-500">{plan.plan_years}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          {(() => {
                                            const planStatusConfig = getStatusConfig(plan.status);
                                            return (
                                              <>
                                                <div className={`px-2 py-1 rounded text-sm font-semibold ${planStatusConfig.color} ${planStatusConfig.bgColor}`}>
                                                  %{plan.progress_percentage.toFixed(1)}
                                                </div>
                                                <div className={`px-2 py-1 rounded-full text-xs font-semibold ${planStatusConfig.color} ${planStatusConfig.bgColor}`}>
                                                  {planStatusConfig.label}
                                                </div>
                                              </>
                                            );
                                          })()}
                                          {isPlanExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                          )}
                                        </div>
                                      </button>

                                      {isPlanExpanded && (
                                        <div className="p-3 space-y-2 bg-white">
                                          {plan.objectives.map(objective => {
                                            const isObjExpanded = expandedObjectives.has(objective.objective_id);

                                            return (
                                              <div key={objective.objective_id} className="border border-orange-200 rounded-lg overflow-hidden">
                                                <button
                                                  onClick={() => {
                                                    const newExpanded = new Set(expandedObjectives);
                                                    if (isObjExpanded) {
                                                      newExpanded.delete(objective.objective_id);
                                                    } else {
                                                      newExpanded.add(objective.objective_id);
                                                    }
                                                    setExpandedObjectives(newExpanded);
                                                  }}
                                                  className="w-full flex items-center justify-between bg-orange-50 p-2 hover:bg-orange-100 transition-colors"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Target className="w-3 h-3 text-orange-700" />
                                                    <div className="text-left">
                                                      <span className="text-xs font-semibold text-orange-900">{objective.objective_code}</span>
                                                      <span className="text-xs text-orange-700 ml-2">{objective.objective_name}</span>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    {(() => {
                                                      const objStatusConfig = getStatusConfig(objective.status);
                                                      return (
                                                        <>
                                                          <div className={`px-2 py-1 rounded text-xs font-semibold ${objStatusConfig.color} ${objStatusConfig.bgColor}`}>
                                                            %{objective.progress_percentage}
                                                          </div>
                                                          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${objStatusConfig.color} ${objStatusConfig.bgColor}`}>
                                                            {objStatusConfig.label}
                                                          </div>
                                                        </>
                                                      );
                                                    })()}
                                                    {isObjExpanded ? (
                                                      <ChevronUp className="w-3 h-3 text-orange-400" />
                                                    ) : (
                                                      <ChevronDown className="w-3 h-3 text-orange-400" />
                                                    )}
                                                  </div>
                                                </button>

                                                {isObjExpanded && (
                                                  <div className="p-2 space-y-2 bg-white">
                                                    {objective.goals.map(goal => {
                                                      const isGoalExpanded = expandedGoals.has(goal.goal_id);

                                                      return (
                                                        <div key={goal.goal_id} className="border border-blue-200 rounded-lg overflow-hidden">
                                                          <button
                                                            onClick={() => {
                                                              const newExpanded = new Set(expandedGoals);
                                                              if (isGoalExpanded) {
                                                                newExpanded.delete(goal.goal_id);
                                                              } else {
                                                                newExpanded.add(goal.goal_id);
                                                              }
                                                              setExpandedGoals(newExpanded);
                                                            }}
                                                            className="w-full flex items-center justify-between bg-blue-50 p-2 hover:bg-blue-100 transition-colors"
                                                          >
                                                            <div className="flex items-center gap-2">
                                                              <Award className="w-3 h-3 text-blue-700" />
                                                              <div className="text-left">
                                                                <span className="text-xs font-semibold text-blue-900">{goal.goal_code}</span>
                                                                <span className="text-xs text-blue-700 ml-2">{goal.goal_name}</span>
                                                              </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              {(() => {
                                                                const goalStatusConfig = getStatusConfig(goal.status);
                                                                return (
                                                                  <>
                                                                    <div className={`px-2 py-1 rounded text-xs font-semibold ${goalStatusConfig.color} ${goalStatusConfig.bgColor}`}>
                                                                      %{goal.progress_percentage}
                                                                    </div>
                                                                    <div className={`px-2 py-1 rounded-full text-xs font-semibold ${goalStatusConfig.color} ${goalStatusConfig.bgColor}`}>
                                                                      {goalStatusConfig.label}
                                                                    </div>
                                                                  </>
                                                                );
                                                              })()}
                                                              {isGoalExpanded ? (
                                                                <ChevronUp className="w-3 h-3 text-blue-400" />
                                                              ) : (
                                                                <ChevronDown className="w-3 h-3 text-blue-400" />
                                                              )}
                                                            </div>
                                                          </button>

                                                          {isGoalExpanded && goal.indicators.length > 0 && (
                                                            <div className="p-2 bg-white">
                                                              <div className="overflow-x-auto">
                                                                <table className="w-full text-xs">
                                                                  <thead className="bg-slate-50 border-b border-slate-200">
                                                                    <tr>
                                                                      <th className="p-2 text-left font-semibold text-slate-700">Gösterge</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Birim</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Hedef</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Başlangıç</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Q1</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Q2</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Q3</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Q4</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">İlerleme</th>
                                                                      <th className="p-2 text-center font-semibold text-slate-700">Durum</th>
                                                                    </tr>
                                                                  </thead>
                                                                  <tbody>
                                                                    {goal.indicators.map(indicator => {
                                                                      const statusConfig = getStatusConfig(indicator.status);
                                                                      return (
                                                                      <tr key={indicator.indicator_id} className="border-b border-slate-100 hover:bg-slate-50">
                                                                        <td className="p-2">
                                                                          <div className="font-semibold text-slate-900">{indicator.indicator_code}</div>
                                                                          <div className="text-slate-600">{indicator.indicator_name}</div>
                                                                        </td>
                                                                        <td className="p-2 text-center text-slate-600">{indicator.unit}</td>
                                                                        <td className="p-2 text-center">
                                                                          <div className="font-semibold text-slate-900">
                                                                            {indicator.yearly_target.toFixed(1)}
                                                                          </div>
                                                                        </td>
                                                                        <td className="p-2 text-center">
                                                                          <div className="text-slate-600">
                                                                            {indicator.baseline_value.toFixed(1)}
                                                                          </div>
                                                                        </td>
                                                                        <td className="p-2">
                                                                          {indicator.q1_actual > 0 || indicator.q1_target > 0 ? (
                                                                            <div className="text-center">
                                                                              <div className="text-slate-600">
                                                                                {indicator.q1_actual.toFixed(1)}
                                                                                {indicator.q1_target > 0 && ` / ${indicator.q1_target.toFixed(1)}`}
                                                                              </div>
                                                                              {indicator.q1_target > 0 && (
                                                                                <div className={`text-xs font-semibold ${indicator.q1_rate >= 80 ? 'text-green-600' : indicator.q1_rate >= 60 ? 'text-blue-600' : indicator.q1_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                  %{indicator.q1_rate.toFixed(0)}
                                                                                </div>
                                                                              )}
                                                                            </div>
                                                                          ) : (
                                                                            <div className="text-center text-slate-400">-</div>
                                                                          )}
                                                                        </td>
                                                                        <td className="p-2">
                                                                          {indicator.q2_actual > 0 || indicator.q2_target > 0 ? (
                                                                            <div className="text-center">
                                                                              <div className="text-slate-600">
                                                                                {indicator.q2_actual.toFixed(1)}
                                                                                {indicator.q2_target > 0 && ` / ${indicator.q2_target.toFixed(1)}`}
                                                                              </div>
                                                                              {indicator.q2_target > 0 && (
                                                                                <div className={`text-xs font-semibold ${indicator.q2_rate >= 80 ? 'text-green-600' : indicator.q2_rate >= 60 ? 'text-blue-600' : indicator.q2_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                  %{indicator.q2_rate.toFixed(0)}
                                                                                </div>
                                                                              )}
                                                                            </div>
                                                                          ) : (
                                                                            <div className="text-center text-slate-400">-</div>
                                                                          )}
                                                                        </td>
                                                                        <td className="p-2">
                                                                          {indicator.q3_actual > 0 || indicator.q3_target > 0 ? (
                                                                            <div className="text-center">
                                                                              <div className="text-slate-600">
                                                                                {indicator.q3_actual.toFixed(1)}
                                                                                {indicator.q3_target > 0 && ` / ${indicator.q3_target.toFixed(1)}`}
                                                                              </div>
                                                                              {indicator.q3_target > 0 && (
                                                                                <div className={`text-xs font-semibold ${indicator.q3_rate >= 80 ? 'text-green-600' : indicator.q3_rate >= 60 ? 'text-blue-600' : indicator.q3_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                  %{indicator.q3_rate.toFixed(0)}
                                                                                </div>
                                                                              )}
                                                                            </div>
                                                                          ) : (
                                                                            <div className="text-center text-slate-400">-</div>
                                                                          )}
                                                                        </td>
                                                                        <td className="p-2">
                                                                          {indicator.q4_actual > 0 || indicator.q4_target > 0 ? (
                                                                            <div className="text-center">
                                                                              <div className="text-slate-600">
                                                                                {indicator.q4_actual.toFixed(1)}
                                                                                {indicator.q4_target > 0 && ` / ${indicator.q4_target.toFixed(1)}`}
                                                                              </div>
                                                                              {indicator.q4_target > 0 && (
                                                                                <div className={`text-xs font-semibold ${indicator.q4_rate >= 80 ? 'text-green-600' : indicator.q4_rate >= 60 ? 'text-blue-600' : indicator.q4_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                  %{indicator.q4_rate.toFixed(0)}
                                                                                </div>
                                                                              )}
                                                                            </div>
                                                                          ) : (
                                                                            <div className="text-center text-slate-400">-</div>
                                                                          )}
                                                                        </td>
                                                                        <td className="p-2">
                                                                          <div className="text-center">
                                                                            <div className={`px-2 py-1 rounded text-xs font-bold ${statusConfig.color} ${statusConfig.bgColor}`}>
                                                                              %{indicator.progress_percentage}
                                                                            </div>
                                                                            <div className="mt-1 w-full bg-slate-200 rounded-full h-1.5">
                                                                              <div
                                                                                className={`h-1.5 rounded-full transition-all ${statusConfig.progressBarColor}`}
                                                                                style={{ width: `${Math.min(indicator.progress_percentage, 100)}%` }}
                                                                              />
                                                                            </div>
                                                                          </div>
                                                                        </td>
                                                                        <td className="p-2">
                                                                          <div className="flex items-center justify-center">
                                                                            <div className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusConfig.color} ${statusConfig.bgColor}`}>
                                                                              {statusConfig.label}
                                                                            </div>
                                                                          </div>
                                                                        </td>
                                                                      </tr>
                                                                    );
                                                                    })}
                                                                  </tbody>
                                                                </table>
                                                              </div>
                                                            </div>
                                                          )}

                                                          {isGoalExpanded && goal.indicators.length === 0 && (
                                                            <div className="p-3 text-center text-slate-400 text-xs">
                                                              Bu hedef için gösterge tanımlanmamış
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
