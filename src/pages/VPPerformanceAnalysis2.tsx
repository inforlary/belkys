import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import {
  User,
  Building2,
  Target,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Award,
  BarChart3,
  Activity,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Shield,
  DollarSign
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

interface BudgetPPSummary {
  total_forms: number;
  approved: number;
  pending: number;
  draft: number;
}

interface RiskSummary {
  total_risks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ICSummary {
  total_actions: number;
  total_controls: number;
  completed_actions: number;
  in_progress_actions: number;
}

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  performance_percentage: number;
  indicators: IndicatorDetail[];
  budget_pp: BudgetPPSummary;
  risks: RiskSummary;
  internal_control: ICSummary;
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
  const [expandedTabs, setExpandedTabs] = useState<{ [key: string]: string }>({});

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
          .from('vp_department_assignments')
          .select(`
            department_id,
            departments (
              id,
              name,
              code
            )
          `)
          .eq('vp_id', vp.id);

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

    const goalIds = goals?.map(g => g.id) || [];

    if (goalIds.length === 0) {
      return {
        department_id: dept.id,
        department_name: dept.name,
        total_indicators: 0,
        performance_percentage: 0,
        indicators: [],
        budget_pp: { total_forms: 0, approved: 0, pending: 0, draft: 0 },
        risks: { total_risks: 0, critical: 0, high: 0, medium: 0, low: 0 },
        internal_control: { total_actions: 0, total_controls: 0, completed_actions: 0, in_progress_actions: 0 }
      };
    }

    const { data: indicators, error: indicatorsError } = await supabase
      .from('indicators')
      .select('id, code, name, unit, goal_id, target_value, baseline_value, calculation_method, measurement_frequency')
      .in('goal_id', goalIds);

    if (indicatorsError) throw indicatorsError;

    const indicatorIds = indicators?.map(i => i.id) || [];

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
        .in('year', [selectedYear, selectedYear - 1])
    ]);

    const entries = entriesRes.data || [];
    const targets = targetsRes.data || [];

    const targetsByIndicator: Record<string, number> = {};
    const baselineByIndicator: Record<string, number> = {};

    targets.forEach(target => {
      if (target.year === selectedYear) {
        targetsByIndicator[target.indicator_id] = target.target_value;
      } else if (target.year === selectedYear - 1) {
        baselineByIndicator[target.indicator_id] = target.baseline_value || target.target_value;
      }
    });

    const enrichedIndicators: IndicatorDetail[] = [];
    let totalProgress = 0;

    for (const ind of indicators || []) {
      const goal = goals?.find(g => g.id === ind.goal_id);

      let baselineValue;
      if (baselineByIndicator[ind.id] !== undefined && baselineByIndicator[ind.id] !== null) {
        baselineValue = baselineByIndicator[ind.id];
      } else if (ind.baseline_value !== undefined && ind.baseline_value !== null) {
        baselineValue = ind.baseline_value;
      } else {
        baselineValue = 0;
      }

      const yearlyTarget = targetsByIndicator[ind.id] !== undefined
        ? targetsByIndicator[ind.id]
        : ind.target_value;

      const indicatorWithTarget = {
        ...ind,
        yearly_target: yearlyTarget,
        yearly_baseline: baselineValue
      };

      const progress = calculateIndicatorProgress(indicatorWithTarget, entries);
      totalProgress += progress;

      const indicatorEntries = entries.filter(e => e.indicator_id === ind.id);
      const sumOfEntries = indicatorEntries.reduce((sum, entry) => sum + entry.value, 0);
      const currentValue = baselineValue + sumOfEntries;

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
        goal_code: goal?.code || '',
        goal_title: goal?.title || '',
        objective_code: (goal as any)?.objectives?.code || '',
        objective_title: (goal as any)?.objectives?.title || '',
        yearly_target: yearlyTarget,
        yearly_baseline: baselineValue,
        progress,
        current_value: currentValue
      });
    }

    const performancePercentage = enrichedIndicators.length > 0
      ? Math.round(totalProgress / enrichedIndicators.length)
      : 0;

    const [budgetPP, risks, ic] = await Promise.all([
      loadBudgetPPSummary(dept.id),
      loadRiskSummary(dept.id),
      loadICSummary(dept.id)
    ]);

    return {
      department_id: dept.id,
      department_name: dept.name,
      total_indicators: enrichedIndicators.length,
      performance_percentage: performancePercentage,
      indicators: enrichedIndicators.sort((a, b) =>
        a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
      ),
      budget_pp: budgetPP,
      risks,
      internal_control: ic
    };
  };

  const loadBudgetPPSummary = async (departmentId: string): Promise<BudgetPPSummary> => {
    const { data, error } = await supabase
      .from('budget_performance_forms')
      .select('approval_status')
      .eq('department_id', departmentId)
      .eq('fiscal_year', selectedYear);

    if (error || !data) {
      return { total_forms: 0, approved: 0, pending: 0, draft: 0 };
    }

    return {
      total_forms: data.length,
      approved: data.filter(f => f.approval_status === 'approved').length,
      pending: data.filter(f => f.approval_status === 'pending').length,
      draft: data.filter(f => f.approval_status === 'draft').length
    };
  };

  const loadRiskSummary = async (departmentId: string): Promise<RiskSummary> => {
    const { data, error } = await supabase
      .from('risks')
      .select('residual_risk_level')
      .eq('department_id', departmentId)
      .eq('approval_status', 'approved');

    if (error || !data) {
      return { total_risks: 0, critical: 0, high: 0, medium: 0, low: 0 };
    }

    return {
      total_risks: data.length,
      critical: data.filter(r => r.residual_risk_level === 'critical').length,
      high: data.filter(r => r.residual_risk_level === 'high').length,
      medium: data.filter(r => r.residual_risk_level === 'medium').length,
      low: data.filter(r => r.residual_risk_level === 'low').length
    };
  };

  const loadICSummary = async (departmentId: string): Promise<ICSummary> => {
    const [actionsRes, controlsRes] = await Promise.all([
      supabase
        .from('ic_actions')
        .select('status')
        .contains('responsible_departments', [departmentId]),
      supabase
        .from('ic_controls')
        .select('id')
        .eq('department_id', departmentId)
    ]);

    const actions = actionsRes.data || [];
    const controls = controlsRes.data || [];

    return {
      total_actions: actions.length,
      total_controls: controls.length,
      completed_actions: actions.filter(a => a.status === 'completed').length,
      in_progress_actions: actions.filter(a => a.status === 'in_progress').length
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

  const toggleTab = (deptId: string, tabName: string) => {
    setExpandedTabs(prev => ({
      ...prev,
      [deptId]: prev[deptId] === tabName ? '' : tabName
    }));
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
                        const activeTab = expandedTabs[dept.department_id] || '';
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
                              <div className="mt-4 space-y-3">
                                <div className="grid grid-cols-4 gap-3">
                                  <button
                                    onClick={() => toggleTab(dept.department_id, 'indicators')}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                      activeTab === 'indicators'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <Target className="w-5 h-5" />
                                    <span className="font-medium">Gösterge İlerleme</span>
                                  </button>
                                  <button
                                    onClick={() => toggleTab(dept.department_id, 'budget')}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                      activeTab === 'budget'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <DollarSign className="w-5 h-5" />
                                    <span className="font-medium">Bütçe PP</span>
                                  </button>
                                  <button
                                    onClick={() => toggleTab(dept.department_id, 'risk')}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                      activeTab === 'risk'
                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="font-medium">Risk Yönetimi</span>
                                  </button>
                                  <button
                                    onClick={() => toggleTab(dept.department_id, 'ic')}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                      activeTab === 'ic'
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <Shield className="w-5 h-5" />
                                    <span className="font-medium">İç Kontrol</span>
                                  </button>
                                </div>

                                {activeTab === 'indicators' && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <Target className="w-5 h-5 text-blue-600" />
                                      Gösterge İlerleme Tablosu
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Amaç</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Hedef</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Kod</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Adı</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Hedef</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Gerçekleşme</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">İlerleme</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {dept.indicators.map(ind => (
                                            <tr key={ind.id} className="border-t">
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
                                )}

                                {activeTab === 'budget' && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <DollarSign className="w-5 h-5 text-green-600" />
                                      Bütçe Performans Programı
                                    </h4>
                                    <div className="grid grid-cols-4 gap-4">
                                      <div className="bg-blue-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Toplam Form</p>
                                        <p className="text-2xl font-bold text-blue-600">{dept.budget_pp.total_forms}</p>
                                      </div>
                                      <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Onaylı</p>
                                        <p className="text-2xl font-bold text-green-600">{dept.budget_pp.approved}</p>
                                      </div>
                                      <div className="bg-yellow-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Bekleyen</p>
                                        <p className="text-2xl font-bold text-yellow-600">{dept.budget_pp.pending}</p>
                                      </div>
                                      <div className="bg-gray-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Taslak</p>
                                        <p className="text-2xl font-bold text-gray-600">{dept.budget_pp.draft}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {activeTab === 'risk' && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <AlertCircle className="w-5 h-5 text-orange-600" />
                                      Risk Yönetimi
                                    </h4>
                                    <div className="grid grid-cols-5 gap-4">
                                      <div className="bg-gray-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Toplam Risk</p>
                                        <p className="text-2xl font-bold text-gray-900">{dept.risks.total_risks}</p>
                                      </div>
                                      <div className="bg-red-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Kritik</p>
                                        <p className="text-2xl font-bold text-red-600">{dept.risks.critical}</p>
                                      </div>
                                      <div className="bg-orange-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Yüksek</p>
                                        <p className="text-2xl font-bold text-orange-600">{dept.risks.high}</p>
                                      </div>
                                      <div className="bg-yellow-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Orta</p>
                                        <p className="text-2xl font-bold text-yellow-600">{dept.risks.medium}</p>
                                      </div>
                                      <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Düşük</p>
                                        <p className="text-2xl font-bold text-green-600">{dept.risks.low}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {activeTab === 'ic' && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <Shield className="w-5 h-5 text-purple-600" />
                                      İç Kontrol Sistemi
                                    </h4>
                                    <div className="grid grid-cols-4 gap-4">
                                      <div className="bg-purple-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Toplam Aksiyon</p>
                                        <p className="text-2xl font-bold text-purple-600">{dept.internal_control.total_actions}</p>
                                      </div>
                                      <div className="bg-blue-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Toplam Kontrol</p>
                                        <p className="text-2xl font-bold text-blue-600">{dept.internal_control.total_controls}</p>
                                      </div>
                                      <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Tamamlanan</p>
                                        <p className="text-2xl font-bold text-green-600">{dept.internal_control.completed_actions}</p>
                                      </div>
                                      <div className="bg-yellow-50 p-4 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Devam Eden</p>
                                        <p className="text-2xl font-bold text-yellow-600">{dept.internal_control.in_progress_actions}</p>
                                      </div>
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
