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
  Download
} from 'lucide-react';
import type { Profile, Department } from '../types/database';
import * as XLSX from 'xlsx';
import {
  calculateIndicatorProgress,
  calculateGoalProgress,
  getProgressColor,
  getProgressTextColor
} from '../utils/progressCalculations';

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

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  performance_percentage: number;
  indicators: IndicatorDetail[];
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

      const { data: vps, error: vpsError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email
        `)
        .eq('organization_id', profile.organization_id)
        .eq('role', 'vice_president')
        .order('full_name');

      if (vpsError) throw vpsError;

      const vpPerformanceData: VPPerformance[] = [];

      for (const vp of vps || []) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('vice_president_departments')
          .select(`
            department_id,
            departments (
              id,
              name,
              code
            )
          `)
          .eq('vice_president_id', vp.id);

        if (assignmentsError) throw assignmentsError;

        const departments = assignments?.map(a => a.departments).filter(Boolean) as Department[] || [];

        const departmentPerformances: DepartmentPerformance[] = [];
        let totalIndicatorsForVP = 0;
        let totalPerformanceSum = 0;
        let departmentsWithIndicators = 0;

        for (const dept of departments) {
          const deptPerf = await loadDepartmentPerformance(dept);
          departmentPerformances.push(deptPerf);

          if (deptPerf.total_indicators > 0) {
            totalIndicatorsForVP += deptPerf.total_indicators;
            totalPerformanceSum += deptPerf.performance_percentage;
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

  const loadDepartmentPerformance = async (dept: Department): Promise<DepartmentPerformance> => {
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select(`
        id,
        code,
        title,
        objectives!inner(
          code,
          title
        )
      `)
      .eq('organization_id', profile?.organization_id)
      .eq('department_id', dept.id);

    if (goalsError) throw goalsError;

    if (!goals || goals.length === 0) {
      return {
        department_id: dept.id,
        department_name: dept.name,
        total_indicators: 0,
        performance_percentage: 0,
        indicators: []
      };
    }

    const goalIds = goals.map(g => g.id);

    const { data: indicators, error: indicatorsError } = await supabase
      .from('indicators')
      .select('id, code, name, unit, goal_id, target_value, baseline_value, calculation_method, measurement_frequency')
      .in('goal_id', goalIds);

    if (indicatorsError) throw indicatorsError;

    if (!indicators || indicators.length === 0) {
      return {
        department_id: dept.id,
        department_name: dept.name,
        total_indicators: 0,
        performance_percentage: 0,
        indicators: []
      };
    }

    const indicatorIds = indicators.map(i => i.id);

    const [entriesRes, targetsRes] = await Promise.all([
      supabase
        .from('indicator_data_entries')
        .select('*')
        .in('indicator_id', indicatorIds)
        .eq('period_year', selectedYear)
        .eq('status', 'approved'),
      supabase
        .from('indicator_targets')
        .select('indicator_id, year, target_value, baseline_value')
        .in('indicator_id', indicatorIds)
        .eq('year', selectedYear)
    ]);

    const entries = entriesRes.data || [];
    const targets = targetsRes.data || [];

    const targetsByIndicator: Record<string, number> = {};
    targets.forEach(target => {
      targetsByIndicator[target.indicator_id] = target.target_value;
    });

    let totalGoalProgress = 0;
    const enrichedIndicators: IndicatorDetail[] = [];

    for (const goal of goals) {
      const goalIndicators = indicators.filter(i => i.goal_id === goal.id);

      const goalIndicatorsWithTargets = goalIndicators.map(ind => {
        const yearlyTarget = targetsByIndicator[ind.id] ?? ind.target_value;
        const baselineValue = ind.baseline_value ?? 0;

        return {
          ...ind,
          yearly_target: yearlyTarget,
          yearly_baseline: baselineValue
        };
      });

      const goalProgress = calculateGoalProgress(
        goal.id,
        goalIndicatorsWithTargets,
        entries
      );

      totalGoalProgress += goalProgress;

      for (const ind of goalIndicatorsWithTargets) {
        const progress = calculateIndicatorProgress(ind, entries);
        const indicatorEntries = entries.filter(e => e.indicator_id === ind.id);
        const sumOfEntries = indicatorEntries.reduce((sum, entry) => sum + entry.value, 0);
        const currentValue = ind.yearly_baseline + sumOfEntries;

        enrichedIndicators.push({
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
          objective_code: (goal as any).objectives?.code || '',
          objective_title: (goal as any).objectives?.title || '',
          yearly_target: ind.yearly_target,
          yearly_baseline: ind.yearly_baseline,
          progress,
          current_value: currentValue
        });
      }
    }

    const performancePercentage = goals.length > 0
      ? Math.round(totalGoalProgress / goals.length)
      : 0;

    return {
      department_id: dept.id,
      department_name: dept.name,
      total_indicators: enrichedIndicators.length,
      performance_percentage: performancePercentage,
      indicators: enrichedIndicators.sort((a, b) =>
        a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
      )
    };
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

      sheetData.push([`Başkan Yardımcısı: ${vp.vp_name}`]);
      sheetData.push([`Genel Performans: %${vp.overall_performance}`]);
      sheetData.push([`Toplam Müdürlük: ${vp.total_departments}`]);
      sheetData.push([`Toplam Gösterge: ${vp.total_indicators}`]);
      sheetData.push([]);

      vp.departments.forEach(dept => {
        sheetData.push([`Müdürlük: ${dept.department_name}`, `Performans: %${dept.performance_percentage}`]);
        sheetData.push([]);

        sheetData.push(['Amaç Kodu', 'Hedef Kodu', 'Gösterge Kodu', 'Gösterge Adı', 'Hedef', 'Gerçekleşme', 'İlerleme %']);

        dept.indicators.forEach(ind => {
          sheetData.push([
            ind.objective_code,
            ind.goal_code,
            ind.code,
            ind.name,
            ind.yearly_target || '-',
            ind.current_value,
            ind.progress
          ]);
        });

        sheetData.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const sanitizedName = vp.vp_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedName);
    });

    XLSX.writeFile(workbook, `VP_Performans_Analizi_${selectedYear}.xlsx`);
  };

  const getPerformanceGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'Mükemmel', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (percentage >= 75) return { grade: 'Çok İyi', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (percentage >= 60) return { grade: 'İyi', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (percentage >= 40) return { grade: 'Geliştirilmeli', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { grade: 'Yetersiz', color: 'text-red-600', bgColor: 'bg-red-100' };
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
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Excel İndir
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
            const performanceGrade = getPerformanceGrade(vp.overall_performance);

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
                          <p className={`text-3xl font-bold ${performanceGrade.color}`}>
                            %{vp.overall_performance}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full ${performanceGrade.bgColor} ${performanceGrade.color}`}>
                            {performanceGrade.grade}
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
                          className={`h-3 rounded-full ${getProgressColor(vp.overall_performance)}`}
                          style={{ width: `${Math.min(100, vp.overall_performance)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {isVPExpanded && (
                    <div className="mt-6 space-y-3">
                      {vp.departments.map(dept => {
                        const isDeptExpanded = expandedDepartments.has(dept.department_id);
                        const deptGrade = getPerformanceGrade(dept.performance_percentage);

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
                                    <p className="text-sm text-gray-600">{dept.total_indicators} gösterge</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className={`text-2xl font-bold ${deptGrade.color}`}>
                                      %{dept.performance_percentage}
                                    </p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${deptGrade.bgColor} ${deptGrade.color}`}>
                                      {deptGrade.grade}
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
                                    className={`h-2 rounded-full ${getProgressColor(dept.performance_percentage)}`}
                                    style={{ width: `${Math.min(100, dept.performance_percentage)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>

                            {isDeptExpanded && (
                              <div className="mt-4">
                                <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-600" />
                                    Amaç ve Hedef Bazında Gösterge İlerlemesi
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                      <thead>
                                        <tr className="bg-gray-100">
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Amaç</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Hedef</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Kodu</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Adı</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Hedef Değer</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Gerçekleşme</th>
                                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">İlerleme</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dept.indicators.map(ind => (
                                          <tr key={ind.id} className="border-t hover:bg-gray-50">
                                            <td className="px-3 py-2 text-sm text-gray-600">{ind.objective_code}</td>
                                            <td className="px-3 py-2 text-sm text-gray-600">{ind.goal_code}</td>
                                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{ind.code}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{ind.name}</td>
                                            <td className="px-3 py-2 text-sm text-right text-gray-700">
                                              {ind.yearly_target?.toLocaleString('tr-TR') || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-right text-gray-700">
                                              {ind.current_value.toLocaleString('tr-TR')}
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                  <div
                                                    className={`h-2 rounded-full ${getProgressColor(ind.progress)}`}
                                                    style={{ width: `${Math.min(100, ind.progress)}%` }}
                                                  ></div>
                                                </div>
                                                <span className={`text-sm font-medium ${getProgressTextColor(ind.progress)}`}>
                                                  %{ind.progress}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
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
