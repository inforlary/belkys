import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import {
  User,
  Building2,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  FileSpreadsheet
} from 'lucide-react';
import type { Profile, Department } from '../types/database';
import * as XLSX from 'xlsx';
import {
  calculateIndicatorProgress,
  calculateGoalProgress
} from '../utils/progressCalculations';
import { calculateCurrentValueFromEntries } from '../utils/indicatorCalculations';
import { exportToPDF } from '../utils/exportHelpers';
import { getStatusConfigByPercentage } from '../utils/indicatorStatus';

interface VPWithDepartments {
  id: string;
  full_name: string;
  email: string;
  departments: Department[];
}

interface IndicatorDetail {
  id: string;
  code: string;
  name: string;
  unit: string;
  target_value: number | null;
  baseline_value: number | null;
  calculation_method: string;
  measurement_frequency: string;
  goal_id: string;
  goal_code: string;
  goal_title: string;
  objective_code: string;
  objective_title: string;
  yearly_target: number | null;
  yearly_baseline: number;
  progress: number;
  current_value: number;
}

interface GoalDetail {
  id: string;
  code: string;
  title: string;
  objective_code: string;
  objective_title: string;
  progress: number;
  indicators: IndicatorDetail[];
}

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  total_goals: number;
  performance_percentage: number;
  goals: GoalDetail[];
}

interface VPPerformance {
  vp_id: string;
  vp_name: string;
  vp_email: string;
  total_departments: number;
  total_indicators: number;
  overall_performance: number;
  departments: DepartmentPerformance[];
}

export default function VPPerformanceAnalysis2() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [vpPerformances, setVPPerformances] = useState<VPPerformance[]>([]);
  const [expandedVPs, setExpandedVPs] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [selectedYear, profile?.organization_id]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [plansRes, vpsRes, assignmentsRes, goalsRes, indicatorsRes, entriesRes, targetsRes] = await Promise.all([
        supabase
          .from('strategic_plans')
          .select('id, start_year, end_year')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('organization_id', profile.organization_id)
          .eq('role', 'vice_president')
          .order('full_name'),
        supabase
          .from('vice_president_departments')
          .select(`
            vice_president_id,
            department_id,
            departments!inner(
              id,
              name,
              code
            )
          `),
        supabase
          .from('goals')
          .select(`
            id,
            code,
            title,
            department_id,
            objective_id,
            objectives!inner(
              id,
              code,
              title,
              strategic_plan_id
            )
          `)
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicators')
          .select('id, code, name, unit, goal_id, target_value, baseline_value, calculation_method, measurement_frequency, goal_impact_percentage'),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status, period_year')
          .eq('period_year', selectedYear)
          .eq('status', 'approved'),
        supabase
          .from('indicator_targets')
          .select('indicator_id, year, target_value')
          .eq('year', selectedYear)
      ]);

      if (plansRes.error) throw plansRes.error;
      if (vpsRes.error) throw vpsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (indicatorsRes.error) throw indicatorsRes.error;

      const plans = plansRes.data || [];
      const vps = vpsRes.data || [];
      const assignments = assignmentsRes.data || [];
      const allGoals = goalsRes.data || [];
      const allIndicators = indicatorsRes.data || [];
      const allEntries = entriesRes.data || [];
      const allTargets = targetsRes.data || [];

      const relevantPlans = plans.filter(plan =>
        selectedYear >= plan.start_year && selectedYear <= plan.end_year
      );

      if (relevantPlans.length === 0) {
        setVPPerformances([]);
        return;
      }

      const relevantPlanIds = new Set(relevantPlans.map(p => p.id));

      const filteredGoals = allGoals.filter(g =>
        g.objectives && relevantPlanIds.has((g.objectives as any).strategic_plan_id)
      );

      const goalIds = new Set(filteredGoals.map(g => g.id));
      const filteredIndicators = allIndicators.filter(i => goalIds.has(i.goal_id));

      const targetsByIndicator: Record<string, number> = {};
      allTargets.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      const indicatorsWithYearlyTargets = filteredIndicators.map(ind => ({
        ...ind,
        yearly_target: targetsByIndicator[ind.id] || ind.target_value
      }));

      const indicatorsByGoal: Record<string, any[]> = {};
      indicatorsWithYearlyTargets.forEach(ind => {
        if (!indicatorsByGoal[ind.goal_id]) {
          indicatorsByGoal[ind.goal_id] = [];
        }
        indicatorsByGoal[ind.goal_id].push(ind);
      });

      const goalsByDepartment: Record<string, any[]> = {};
      filteredGoals.forEach(goal => {
        if (goal.department_id) {
          if (!goalsByDepartment[goal.department_id]) {
            goalsByDepartment[goal.department_id] = [];
          }
          goalsByDepartment[goal.department_id].push(goal);
        }
      });

      const assignmentsByVP: Record<string, any[]> = {};
      assignments.forEach(assignment => {
        if (!assignmentsByVP[assignment.vice_president_id]) {
          assignmentsByVP[assignment.vice_president_id] = [];
        }
        assignmentsByVP[assignment.vice_president_id].push(assignment);
      });

      const vpPerformanceData: VPPerformance[] = [];

      for (const vp of vps) {
        const vpAssignments = assignmentsByVP[vp.id] || [];
        const departments = vpAssignments
          .map(a => a.departments)
          .filter(Boolean);

        const departmentPerformances: DepartmentPerformance[] = [];
        let totalIndicatorsForVP = 0;
        let totalPerformanceSum = 0;
        let departmentsWithIndicators = 0;

        for (const dept of departments) {
          const deptGoals = goalsByDepartment[dept.id] || [];

          if (deptGoals.length === 0) {
            departmentPerformances.push({
              department_id: dept.id,
              department_name: dept.name,
              total_indicators: 0,
              total_goals: 0,
              performance_percentage: 0,
              goals: []
            });
            continue;
          }

          const enrichedGoals: GoalDetail[] = [];
          let totalGoalProgress = 0;
          let totalIndicatorsForDept = 0;

          for (const goal of deptGoals) {
            const goalIndicators = indicatorsByGoal[goal.id] || [];
            totalIndicatorsForDept += goalIndicators.length;

            const goalProgress = goalIndicators.length > 0
              ? calculateGoalProgress(goal.id, goalIndicators, allEntries)
              : 0;

            totalGoalProgress += goalProgress;

            const enrichedIndicators: IndicatorDetail[] = goalIndicators.map(ind => {
              const progress = calculateIndicatorProgress(ind, allEntries);
              const baselineValue = ind.baseline_value ?? 0;
              const currentValue = calculateCurrentValueFromEntries(
                ind.id,
                baselineValue,
                ind.calculation_method || 'cumulative',
                allEntries.map(e => ({
                  indicator_id: e.indicator_id,
                  value: e.value,
                  status: e.status
                }))
              ) ?? baselineValue;

              return {
                id: ind.id,
                code: ind.code,
                name: ind.name,
                unit: ind.unit,
                target_value: ind.target_value,
                baseline_value: ind.baseline_value,
                calculation_method: ind.calculation_method,
                measurement_frequency: ind.measurement_frequency,
                goal_id: ind.goal_id,
                goal_code: goal.code,
                goal_title: goal.title,
                objective_code: (goal.objectives as any)?.code || '',
                objective_title: (goal.objectives as any)?.title || '',
                yearly_target: ind.yearly_target,
                yearly_baseline: baselineValue,
                progress,
                current_value: currentValue
              };
            }).sort((a, b) =>
              a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
            );

            enrichedGoals.push({
              id: goal.id,
              code: goal.code,
              title: goal.title,
              objective_code: (goal.objectives as any)?.code || '',
              objective_title: (goal.objectives as any)?.title || '',
              progress: goalProgress,
              indicators: enrichedIndicators
            });
          }

          const performancePercentage = deptGoals.length > 0
            ? Math.round(totalGoalProgress / deptGoals.length)
            : 0;

          departmentPerformances.push({
            department_id: dept.id,
            department_name: dept.name,
            total_indicators: totalIndicatorsForDept,
            total_goals: deptGoals.length,
            performance_percentage: performancePercentage,
            goals: enrichedGoals.sort((a, b) =>
              a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
            )
          });

          if (totalIndicatorsForDept > 0) {
            totalIndicatorsForVP += totalIndicatorsForDept;
            totalPerformanceSum += performancePercentage;
            departmentsWithIndicators++;
          }
        }

        const overallPerformance = departmentsWithIndicators > 0
          ? Math.round(totalPerformanceSum / departmentsWithIndicators)
          : 0;

        vpPerformanceData.push({
          vp_id: vp.id,
          vp_name: vp.full_name,
          vp_email: vp.email,
          total_departments: departments.length,
          total_indicators: totalIndicatorsForVP,
          overall_performance: overallPerformance,
          departments: departmentPerformances.sort((a, b) =>
            a.department_name.localeCompare(b.department_name, 'tr')
          )
        });
      }

      setVPPerformances(vpPerformanceData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleVP = (vpId: string) => {
    const newExpanded = new Set(expandedVPs);
    if (newExpanded.has(vpId)) {
      newExpanded.delete(vpId);
    } else {
      newExpanded.add(vpId);
    }
    setExpandedVPs(newExpanded);
  };

  const toggleDepartment = (deptId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepartments(newExpanded);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    vpPerformances.forEach(vp => {
      const sheetData: any[] = [];

      sheetData.push([`${vp.vp_name} - ${vp.total_departments} Müdürlük - ${vp.total_indicators} Gösterge - %${vp.overall_performance} Performans`]);
      sheetData.push([]);
      sheetData.push([`Başkan Yardımcısı: ${vp.vp_name}`]);
      sheetData.push([`Genel Performans: %${vp.overall_performance}`]);
      sheetData.push([`Toplam Müdürlük: ${vp.total_departments}`]);
      sheetData.push([`Toplam Gösterge: ${vp.total_indicators}`]);
      sheetData.push([]);

      vp.departments.forEach(dept => {
        sheetData.push([`Müdürlük: ${dept.department_name}`, `Performans: %${dept.performance_percentage}`, `Toplam Hedef: ${dept.total_goals}`]);
        sheetData.push([]);

        dept.goals.forEach(goal => {
          sheetData.push([`Hedef: ${goal.code} - ${goal.title}`, `Hedef İlerleme: %${goal.progress}`]);
          sheetData.push(['Amaç Kodu', 'Hedef Kodu', 'Gösterge Kodu', 'Gösterge Adı', 'Başlangıç', 'Hedef', 'Gerçekleşme', 'İlerleme %']);

          goal.indicators.forEach(ind => {
            sheetData.push([
              ind.objective_code,
              ind.goal_code,
              ind.code,
              ind.name,
              ind.yearly_baseline || 0,
              ind.yearly_target || '-',
              ind.current_value,
              ind.progress
            ]);
          });

          sheetData.push([]);
        });

        sheetData.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const sanitizedName = vp.vp_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedName);
    });

    XLSX.writeFile(workbook, `VP_Performans_Analizi_${selectedYear}.xlsx`);
  };

  const getColorFromTailwind = (tailwindClass: string): string => {
    const colorMap: Record<string, string> = {
      'text-purple-600': '#9333ea',
      'bg-purple-50': '#faf5ff',
      'text-green-700': '#15803d',
      'bg-green-100': '#dcfce7',
      'text-green-600': '#16a34a',
      'bg-green-50': '#f0fdf4',
      'text-yellow-600': '#ca8a04',
      'bg-yellow-50': '#fefce8',
      'text-red-600': '#dc2626',
      'bg-red-50': '#fef2f2',
      'text-amber-800': '#92400e',
      'bg-amber-100': '#fef3c7'
    };
    return colorMap[tailwindClass] || '#000000';
  };

  const handleExportPDF = () => {
    if (vpPerformances.length === 0) return;

    let content = `
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 18px 24px; border-radius: 6px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700;">Başkan Yardımcıları Performans Analizi</h1>
        <p style="margin: 0; font-size: 12px; opacity: 0.9;">Müdürlük ve Gösterge Bazlı Detaylı Performans Raporu - ${selectedYear}</p>
      </div>
    `;

    vpPerformances.forEach((vp, vpIndex) => {
      const vpStatusConfig = getStatusConfigByPercentage(vp.overall_performance);
      const vpColor = getColorFromTailwind(vpStatusConfig.color);

      if (vpIndex > 0) {
        content += '<div style="page-break-before: always;"></div>';
      }

      content += `
        <div style="background: ${vpColor}; color: white; padding: 14px 20px; border-radius: 6px; margin: 16px 0 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 700;">${vp.vp_name}</h2>
            <span style="font-size: 18px; font-weight: 700;">%${vp.overall_performance}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
          <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; margin-bottom: 4px;">E-posta</div>
            <div style="font-size: 10px; font-weight: 600; color: #1e293b;">${vp.vp_email}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; margin-bottom: 4px;">Toplam Müdürlük</div>
            <div style="font-size: 18px; font-weight: 700; color: #2563eb;">${vp.total_departments}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; margin-bottom: 4px;">Toplam Gösterge</div>
            <div style="font-size: 18px; font-weight: 700; color: #2563eb;">${vp.total_indicators}</div>
          </div>
        </div>
      `;

      vp.departments.forEach((dept) => {
        const deptStatusConfig = getStatusConfigByPercentage(dept.performance_percentage);
        const deptBgColor = getColorFromTailwind(deptStatusConfig.bgColor);
        const deptColor = getColorFromTailwind(deptStatusConfig.color);

        content += `
          <div style="background: ${deptBgColor}; border-left: 4px solid ${deptColor}; padding: 10px 14px; margin: 12px 0; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: 13px; font-weight: 600; color: #1e293b;">${dept.department_name}</h3>
              <div style="text-align: right;">
                <span style="font-size: 16px; font-weight: 700; color: ${deptColor};">%${dept.performance_percentage}</span>
                <span style="font-size: 9px; color: #64748b; margin-left: 6px;">${deptStatusConfig.label}</span>
              </div>
            </div>
            <div style="margin-top: 4px; font-size: 9px; color: #64748b;">
              ${dept.total_goals} hedef • ${dept.total_indicators} gösterge
            </div>
          </div>
        `;

        dept.goals.forEach((goal) => {
          const goalStatusConfig = getStatusConfigByPercentage(goal.progress);
          const goalColor = getColorFromTailwind(goalStatusConfig.color);

          content += `
            <div style="margin: 10px 0 10px 20px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: white;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div style="flex: 1;">
                  <span style="font-size: 10px; font-weight: 600; color: #1e40af;">${goal.code}</span>
                  <span style="font-size: 10px; color: #475569; margin-left: 6px;">${goal.title}</span>
                </div>
                <div style="text-align: right; margin-left: 10px;">
                  <span style="font-size: 12px; font-weight: 700; color: ${goalColor};">%${goal.progress}</span>
                </div>
              </div>
              <div style="font-size: 8px; color: #64748b; margin-bottom: 6px;">
                Amaç: ${goal.objective_code} - ${goal.objective_title}
              </div>
          `;

          if (goal.indicators.length > 0) {
            content += `
              <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 7.5pt;">
                <thead>
                  <tr>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">Kod</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">Gösterge</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">Başlangıç</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">Hedef</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">Gerçekleşme</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">İlerleme</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #2563eb; color: white; font-weight: bold; font-size: 8pt;">Durum</th>
                  </tr>
                </thead>
                <tbody>
            `;

            goal.indicators.forEach((ind, idx) => {
              const statusConfig = getStatusConfigByPercentage(ind.progress);
              const progressColor = getColorFromTailwind(statusConfig.color);
              const gradeBgColor = getColorFromTailwind(statusConfig.bgColor);
              const bgColor = idx % 2 === 1 ? '#f8fafc' : '#ffffff';

              content += `
                <tr style="background-color: ${bgColor};">
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${ind.code}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${ind.name}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${ind.yearly_baseline?.toLocaleString('tr-TR') || '0'}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${ind.yearly_target ? ind.yearly_target.toLocaleString('tr-TR') : '-'}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${ind.current_value.toLocaleString('tr-TR')}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 700; color: ${progressColor};">${ind.progress}%</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">
                    <span style="padding: 2px 8px; border-radius: 4px; font-weight: 600; background-color: ${gradeBgColor}; color: ${progressColor};">${statusConfig.label}</span>
                  </td>
                </tr>
              `;
            });

            content += `
                </tbody>
              </table>
            `;
          } else {
            content += '<p style="font-size: 9px; color: #64748b; text-align: center; margin: 8px 0;">Bu hedef için gösterge tanımlanmamış</p>';
          }

          content += '</div>';
        });

        if (dept.goals.length === 0) {
          content += '<p style="font-size: 9px; color: #64748b; text-align: center; margin: 12px 20px;">Bu müdürlük için hedef tanımlanmamış</p>';
        }
      });
    });

    content += `
      <div style="margin-top: 20px; padding: 12px 16px; background: #f1f5f9; border-radius: 4px; border-left: 3px solid #2563eb;">
        <p style="margin: 0; color: #475569; font-size: 9px;">
          <strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <p style="margin: 4px 0 0 0; color: #475569; font-size: 9px;">
          <strong>Rapor Dönemi:</strong> ${selectedYear} Yılı
        </p>
        <p style="margin: 4px 0 0 0; color: #475569; font-size: 9px;">
          <strong>Toplam Başkan Yardımcısı:</strong> ${vpPerformances.length}
        </p>
      </div>
    `;

    exportToPDF(
      `Başkan Yardımcıları Performans Analizi - ${selectedYear}`,
      content,
      `VP_Performans_Analizi_${selectedYear}_${new Date().toISOString().split('T')[0]}`
    );
  };

  if (!profile) return null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Başkan Yardımcıları Performans Analizi</h1>
          <p className="text-gray-600 mt-2">Müdürlük ve gösterge bazlı detaylı performans raporu</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={handleExportPDF}
            disabled={vpPerformances.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToExcel}
            disabled={vpPerformances.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Veriler yükleniyor...</p>
          </div>
        </div>
      ) : vpPerformances.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Başkan Yardımcısı bulunamadı</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {vpPerformances.map(vp => {
            const isVPExpanded = expandedVPs.has(vp.vp_id);
            const vpStatusConfig = getStatusConfigByPercentage(vp.overall_performance);

            return (
              <Card key={vp.vp_id}>
                <CardBody>
                  <div
                    onClick={() => toggleVP(vp.vp_id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{vp.vp_name}</h2>
                          <p className="text-sm text-gray-600">{vp.vp_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Müdürlük</p>
                          <p className="text-2xl font-bold text-gray-900">{vp.total_departments}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Gösterge</p>
                          <p className="text-2xl font-bold text-gray-900">{vp.total_indicators}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Genel Performans</p>
                          <p className={`text-3xl font-bold ${vpStatusConfig.color}`}>
                            %{vp.overall_performance}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full ${vpStatusConfig.bgColor} ${vpStatusConfig.color}`}>
                            {vpStatusConfig.label}
                          </span>
                        </div>
                        {isVPExpanded ? (
                          <ChevronUp className="w-6 h-6 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${vpStatusConfig.progressBarColor}`}
                          style={{ width: `${Math.min(100, vp.overall_performance)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {isVPExpanded && (
                    <div className="mt-6 space-y-3">
                      {vp.departments.map(dept => {
                        const isDeptExpanded = expandedDepartments.has(dept.department_id);
                        const deptStatusConfig = getStatusConfigByPercentage(dept.performance_percentage);

                        return (
                          <div key={dept.department_id} className="border rounded-lg p-4 bg-gray-50">
                            <div
                              onClick={() => toggleDepartment(dept.department_id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Building2 className="w-5 h-5 text-gray-600" />
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{dept.department_name}</h3>
                                    <p className="text-sm text-gray-600">
                                      {dept.total_goals} hedef • {dept.total_indicators} gösterge
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className={`text-2xl font-bold ${deptStatusConfig.color}`}>
                                      %{dept.performance_percentage}
                                    </p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${deptStatusConfig.bgColor} ${deptStatusConfig.color}`}>
                                      {deptStatusConfig.label}
                                    </span>
                                  </div>
                                  {isDeptExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className="w-full bg-gray-300 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${deptStatusConfig.progressBarColor}`}
                                    style={{ width: `${Math.min(100, dept.performance_percentage)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>

                            {isDeptExpanded && (
                              <div className="mt-4 space-y-3">
                                {dept.goals.map(goal => {
                                  const goalStatusConfig = getStatusConfigByPercentage(goal.progress);

                                  return (
                                    <div key={goal.id} className="bg-white rounded-lg p-4 border-2 border-blue-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <Target className="w-5 h-5 text-blue-600" />
                                          <div>
                                            <h4 className="font-semibold text-gray-900">
                                              {goal.code} - {goal.title}
                                            </h4>
                                            <p className="text-xs text-gray-600">
                                              Amaç: {goal.objective_code} - {goal.objective_title}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className={`text-xl font-bold ${goalStatusConfig.color}`}>
                                            %{goal.progress}
                                          </p>
                                          <span className={`text-xs px-2 py-1 rounded-full ${goalStatusConfig.bgColor} ${goalStatusConfig.color}`}>
                                            {goalStatusConfig.label}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mb-2">
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${goalStatusConfig.progressBarColor}`}
                                            style={{ width: `${Math.min(100, goal.progress)}%` }}
                                          ></div>
                                        </div>
                                      </div>

                                      {goal.indicators.length > 0 && (
                                        <div className="overflow-x-auto mt-3">
                                          <table className="min-w-full">
                                            <thead>
                                              <tr className="bg-gray-100">
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Kodu</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Adı</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Başlangıç</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Hedef Değer</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Gerçekleşme</th>
                                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">İlerleme</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {goal.indicators.map(ind => {
                                                const indStatusConfig = getStatusConfigByPercentage(ind.progress);
                                                return (
                                                  <tr key={ind.id} className="border-t hover:bg-gray-50">
                                                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{ind.code}</td>
                                                    <td className="px-3 py-2 text-sm text-gray-900">{ind.name}</td>
                                                    <td className="px-3 py-2 text-sm text-right text-gray-600">
                                                      {ind.yearly_baseline?.toLocaleString('tr-TR') || '0'} {ind.unit}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-right text-gray-700">
                                                      {ind.yearly_target?.toLocaleString('tr-TR') || '-'} {ind.unit}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-right text-gray-700">
                                                      {ind.current_value.toLocaleString('tr-TR')} {ind.unit}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                      <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                          <div
                                                            className={`h-2 rounded-full ${indStatusConfig.progressBarColor}`}
                                                            style={{ width: `${Math.min(100, ind.progress)}%` }}
                                                          ></div>
                                                        </div>
                                                        <span className={`text-sm font-medium ${indStatusConfig.color}`}>
                                                          %{ind.progress}
                                                        </span>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}

                                      {goal.indicators.length === 0 && (
                                        <div className="text-center py-4 text-sm text-gray-500">
                                          Bu hedef için gösterge tanımlanmamış
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {dept.goals.length === 0 && (
                                  <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                    <div className="text-center py-4 text-sm text-gray-500">
                                      Bu müdürlük için hedef tanımlanmamış
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
