import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, TrendingUp, TrendingDown, Minus, FileText, ArrowUpDown, X, FileSpreadsheet, FileDown } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../../utils/exportHelpers';
import Modal from '../ui/Modal';
import { calculateIndicatorProgress, calculateGoalProgress } from '../../utils/progressCalculations';
import {
  IndicatorStatus,
  getIndicatorStatus,
  getStatusConfig,
  getStatusLabel,
  createEmptyStats,
  incrementStatusInStats,
  type IndicatorStats as StatusStats
} from '../../utils/indicatorStatus';

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  avg_progress: number;
  exceedingTarget: number;
  excellent: number;
  good: number;
  moderate: number;
  weak: number;
  veryWeak: number;
}

interface IndicatorDetail {
  id: string;
  name: string;
  code: string;
  current_value: number;
  target_value: number;
  progress: number;
  status: IndicatorStatus;
  department_name?: string;
  has_target: boolean;
  has_data: boolean;
}

interface PerformanceDashboardProps {
  selectedYear?: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'progress-desc' | 'progress-asc' | 'count-desc' | 'count-asc';

export default function PerformanceDashboard({ selectedYear }: PerformanceDashboardProps) {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DepartmentPerformance[]>([]);
  const [sortedDepartments, setSortedDepartments] = useState<DepartmentPerformance[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('progress-desc');
  const currentYear = selectedYear || new Date().getFullYear();
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IndicatorStatus | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentPerformance | null>(null);
  const [indicatorDetails, setIndicatorDetails] = useState<IndicatorDetail[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [overallStats, setOverallStats] = useState<StatusStats>(createEmptyStats());

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  useEffect(() => {
    sortDepartments();
  }, [departments, sortBy]);

  const sortDepartments = () => {
    const sorted = [...departments].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.department_name.localeCompare(b.department_name, 'tr');
        case 'name-desc':
          return b.department_name.localeCompare(a.department_name, 'tr');
        case 'progress-desc':
          return b.avg_progress - a.avg_progress;
        case 'progress-asc':
          return a.avg_progress - b.avg_progress;
        case 'count-desc':
          return b.total_indicators - a.total_indicators;
        case 'count-asc':
          return a.total_indicators - b.total_indicators;
        default:
          return 0;
      }
    });
    setSortedDepartments(sorted);
  };

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      // First get goals to filter indicators by department
      let goalsQuery = supabase
        .from('goals')
        .select('id, department_id')
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their department's data
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: allowedGoals } = await goalsQuery;
      const allowedGoalIds = allowedGoals?.map(g => g.id) || [];

      if (allowedGoalIds.length === 0) {
        setDepartments([]);
        setOverallProgress(0);
        setOverallStats(createEmptyStats());
        setLoading(false);
        return;
      }

      // Get all departments
      let deptsQuery = supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        deptsQuery = deptsQuery.eq('id', profile.department_id);
      }

      const { data: depts } = await deptsQuery.order('name');

      if (depts) {
        const performanceData = await Promise.all(
          depts.map(async (dept) => {
            const deptGoals = allowedGoals?.filter(g => g.department_id === dept.id) || [];
            const deptGoalIds = deptGoals.map(g => g.id);

            if (deptGoalIds.length === 0) {
              return {
                department_id: dept.id,
                department_name: dept.name,
                total_indicators: 0,
                avg_progress: 0,
                exceedingTarget: 0,
                excellent: 0,
                good: 0,
                moderate: 0,
                weak: 0,
                veryWeak: 0,
              };
            }

            const { data: indicators } = await supabase
              .from('indicators')
              .select('id, calculation_method, goal_id, goal_impact_percentage, baseline_value')
              .eq('organization_id', profile.organization_id)
              .in('goal_id', deptGoalIds);

            if (!indicators || indicators.length === 0) {
              return {
                department_id: dept.id,
                department_name: dept.name,
                total_indicators: 0,
                avg_progress: 0,
                exceedingTarget: 0,
                excellent: 0,
                good: 0,
                moderate: 0,
                weak: 0,
                veryWeak: 0,
              };
            }

            const indicatorIds = indicators.map(i => i.id);

            const [dataEntriesResult, targetsResult] = await Promise.all([
              supabase
                .from('indicator_data_entries')
                .select('indicator_id, value, status')
                .eq('organization_id', profile.organization_id)
                .eq('period_year', currentYear)
                .eq('status', 'approved')
                .in('indicator_id', indicatorIds),
              supabase
                .from('indicator_targets')
                .select('indicator_id, target_value, baseline_value')
                .eq('year', currentYear)
                .in('indicator_id', indicatorIds)
            ]);

            const { data: dataEntries } = dataEntriesResult;

            const targetsByIndicator: Record<string, { target: number; baseline: number }> = {};
            targetsResult.data?.forEach(target => {
              targetsByIndicator[target.indicator_id] = {
                target: target.target_value,
                baseline: target.baseline_value || 0,
              };
            });

            const stats = createEmptyStats();
            let totalGoalProgress = 0;
            let goalCount = 0;

            deptGoals.forEach(goal => {
              const allGoalIndicators = indicators.filter(ind => ind.goal_id === goal.id).map(ind => {
                const targetData = targetsByIndicator[ind.id];
                return {
                  id: ind.id,
                  goal_id: ind.goal_id,
                  goal_impact_percentage: ind.goal_impact_percentage,
                  yearly_target: targetData?.target || 0,
                  target_value: targetData?.target || 0,
                  baseline_value: targetData?.baseline || ind.baseline_value || 0,
                  calculation_method: ind.calculation_method
                };
              });

              if (allGoalIndicators.length === 0) return;

              const goalIndicatorsWithTarget = allGoalIndicators.filter(ind => ind.yearly_target > 0);

              if (goalIndicatorsWithTarget.length > 0) {
                const goalProgress = calculateGoalProgress(goal.id, goalIndicatorsWithTarget, dataEntries || []);
                totalGoalProgress += goalProgress;
                goalCount++;
              }

              allGoalIndicators.forEach(indicator => {
                const indicatorEntries = (dataEntries || []).filter(e => e.indicator_id === indicator.id && e.status === 'approved');

                if (indicator.yearly_target <= 0 || indicatorEntries.length === 0) {
                  const status = getIndicatorStatus(0);
                  incrementStatusInStats(stats, status);
                  return;
                }

                const progress = calculateIndicatorProgress(indicator, dataEntries || []);

                const status = getIndicatorStatus(progress);
                incrementStatusInStats(stats, status);
              });
            });

            return {
              department_id: dept.id,
              department_name: dept.name,
              total_indicators: stats.total,
              avg_progress: goalCount > 0 ? totalGoalProgress / goalCount : 0,
              exceedingTarget: stats.exceedingTarget,
              excellent: stats.excellent,
              good: stats.good,
              moderate: stats.moderate,
              weak: stats.weak,
              veryWeak: stats.veryWeak,
            };
          })
        );

        setDepartments(performanceData);

        const totalDepartments = performanceData.filter(d => d.total_indicators > 0).length;
        const sumOfDepartmentProgress = performanceData.reduce((sum, d) => sum + d.avg_progress, 0);
        setOverallProgress(totalDepartments > 0 ? sumOfDepartmentProgress / totalDepartments : 0);

        const aggregatedStats = createEmptyStats();
        performanceData.forEach(d => {
          aggregatedStats.exceedingTarget += d.exceedingTarget;
          aggregatedStats.excellent += d.excellent;
          aggregatedStats.good += d.good;
          aggregatedStats.moderate += d.moderate;
          aggregatedStats.weak += d.weak;
          aggregatedStats.veryWeak += d.veryWeak;
          aggregatedStats.total += d.total_indicators;
        });

        setOverallStats(aggregatedStats);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = sortedDepartments.map((dept, index) => ({
      'Sıra': index + 1,
      'Birim': dept.department_name,
      'Gösterge Sayısı': dept.total_indicators,
      'Ortalama İlerleme (%)': Math.round(dept.avg_progress),
      'Hedefi Aşan': dept.exceedingTarget,
      'Mükemmel': dept.excellent,
      'İyi': dept.good,
      'Orta': dept.moderate,
      'Zayıf': dept.weak,
      'Çok Zayıf': dept.veryWeak,
    }));

    exportToExcel(exportData, `Performans_Gosterge_Paneli_${currentYear}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const departmentCards = sortedDepartments.map((dept, index) => `
      <div class="department-card" style="margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: #f1f5f9; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
              ${index + 1}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${dept.department_name}</h3>
              <p style="margin: 0; font-size: 12px; color: #64748b;">${dept.total_indicators} gösterge</p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${Math.round(dept.avg_progress)}%</div>
            <div style="font-size: 11px; color: #64748b;">Ortalama İlerleme</div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="width: 100%; background-color: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
            <div style="height: 8px; background-color: ${
              dept.avg_progress >= 115 ? '#a855f7' :
              dept.avg_progress >= 85 ? '#10b981' :
              dept.avg_progress >= 70 ? '#22c55e' :
              dept.avg_progress >= 55 ? '#eab308' :
              dept.avg_progress >= 45 ? '#f97316' : '#dc2626'
            }; width: ${Math.min(dept.avg_progress, 100)}%;"></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
          <div style="background: #faf5ff; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #a855f7;">${dept.exceedingTarget}</div>
            <div style="font-size: 10px; color: #64748b;">Hedef Üstü</div>
          </div>
          <div style="background: #dcfce7; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #15803d;">${dept.excellent}</div>
            <div style="font-size: 10px; color: #64748b;">Çok İyi</div>
          </div>
          <div style="background: #f0fdf4; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #16a34a;">${dept.good}</div>
            <div style="font-size: 10px; color: #64748b;">İyi</div>
          </div>
          <div style="background: #fef9c3; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #ca8a04;">${dept.moderate}</div>
            <div style="font-size: 10px; color: #64748b;">Orta</div>
          </div>
          <div style="background: #fee2e2; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #dc2626;">${dept.weak}</div>
            <div style="font-size: 10px; color: #64748b;">Zayıf</div>
          </div>
          <div style="background: #fef3c7; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #92400e;">${dept.veryWeak}</div>
            <div style="font-size: 10px; color: #64748b;">Ç. Zayıf</div>
          </div>
        </div>
      </div>
    `).join('');

    const content = `
      <h2>Genel Performans Özeti</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${sortedDepartments.length}</div>
          <div class="stat-label">Toplam Birim</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #10b981;">
          <div class="stat-value" style="color: #10b981;">${overallStats.exceedingTarget}</div>
          <div class="stat-label">Toplam Hedefi Aşan</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #3b82f6;">
          <div class="stat-value" style="color: #3b82f6;">${overallStats.excellent}</div>
          <div class="stat-label">Toplam Mükemmel</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #22c55e;">
          <div class="stat-value" style="color: #22c55e;">${overallStats.good}</div>
          <div class="stat-label">Toplam İyi</div>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 10px;">
        <div class="stat-box" style="border-left: 4px solid #eab308;">
          <div class="stat-value" style="color: #ca8a04;">${overallStats.moderate}</div>
          <div class="stat-label">Toplam Orta</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #f97316;">
          <div class="stat-value" style="color: #f97316;">${overallStats.weak}</div>
          <div class="stat-label">Toplam Zayıf</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #dc2626;">
          <div class="stat-value" style="color: #dc2626;">${overallStats.veryWeak}</div>
          <div class="stat-label">Toplam Çok Zayıf</div>
        </div>
      </div>

      <h2 style="margin-top: 25px; margin-bottom: 15px;">Birim Bazlı Performans</h2>
      ${departmentCards}
    `;

    exportToPDF(`Performans Gösterge Paneli - ${currentYear}`, content, `Performans_Gosterge_Paneli_${currentYear}_${new Date().toISOString().split('T')[0]}`);
  };

  const loadIndicatorDetails = async (status: IndicatorStatus, dept?: DepartmentPerformance) => {
    if (!profile?.organization_id) return;

    setSelectedDepartment(dept || null);
    setSelectedStatus(status);
    setShowIndicatorModal(true);
    setLoadingIndicators(true);

    try {
      let goalsQuery = supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (dept) {
        goalsQuery = goalsQuery.eq('department_id', dept.department_id);
      } else if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: goals } = await goalsQuery;

      if (!goals || goals.length === 0) {
        setIndicatorDetails([]);
        setLoadingIndicators(false);
        return;
      }

      const goalIds = goals.map(g => g.id);

      const { data: indicators } = await supabase
        .from('indicators')
        .select(`
          id,
          name,
          code,
          goal_id,
          calculation_method,
          baseline_value,
          goal:goals!goal_id(
            department_id,
            department:departments(name)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .in('goal_id', goalIds);

      if (!indicators || indicators.length === 0) {
        setIndicatorDetails([]);
        setLoadingIndicators(false);
        return;
      }

      const indicatorIds = indicators.map(i => i.id);

      const [entriesResult, targetsResult] = await Promise.all([
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, period_quarter, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .eq('status', 'approved')
          .in('indicator_id', indicatorIds)
          .order('period_quarter', { ascending: true }),
        supabase
          .from('indicator_targets')
          .select('indicator_id, target_value, baseline_value')
          .eq('year', currentYear)
          .in('indicator_id', indicatorIds),
      ]);

      const entriesByIndicator: Record<string, number[]> = {};
      entriesResult.data?.forEach(entry => {
        if (!entriesByIndicator[entry.indicator_id]) {
          entriesByIndicator[entry.indicator_id] = [];
        }
        entriesByIndicator[entry.indicator_id].push(entry.value || 0);
      });

      const targetsByIndicator: Record<string, { target: number; baseline: number }> = {};
      targetsResult.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = {
          target: target.target_value,
          baseline: target.baseline_value || 0,
        };
      });

      const details: IndicatorDetail[] = [];

      indicators.forEach(indicator => {
        const targetData = targetsByIndicator[indicator.id];
        const periodValues = entriesByIndicator[indicator.id] || [];
        const hasTarget = targetData && targetData.target > 0;
        const hasData = periodValues.length > 0;

        const departmentName = indicator.goal?.department?.name || 'Atanmamış';

        let progress = 0;
        let currentValue = 0;
        let targetValue = 0;

        if (hasTarget) {
          targetValue = targetData.target;

          if (hasData) {
            const indicatorWithTarget = {
              id: indicator.id,
              goal_id: indicator.goal_id,
              yearly_target: targetData.target,
              baseline_value: targetData.baseline || indicator.baseline_value || 0,
              calculation_method: indicator.calculation_method
            };

            progress = calculateIndicatorProgress(indicatorWithTarget, entriesResult.data || []);

            const sum = periodValues.reduce((acc, val) => acc + val, 0);
            const calculationMethod = indicator.calculation_method || 'cumulative_increasing';

            if (calculationMethod.includes('cumulative') || calculationMethod === 'increasing') {
              currentValue = (targetData.baseline || indicator.baseline_value || 0) + sum;
            } else if (calculationMethod === 'decreasing') {
              currentValue = (targetData.baseline || indicator.baseline_value || 0) - sum;
            } else if (calculationMethod.includes('maintenance') || calculationMethod.includes('percentage')) {
              currentValue = periodValues.length > 0 ? sum / periodValues.length : (targetData.baseline || indicator.baseline_value || 0);
            }
          } else {
            currentValue = targetData.baseline || indicator.baseline_value || 0;
            progress = 0;
          }
        }

        const indicatorStatus = getIndicatorStatus(progress);

        if (indicatorStatus === status) {
          details.push({
            id: indicator.id,
            name: indicator.name,
            code: indicator.code || '',
            current_value: currentValue,
            target_value: targetValue,
            progress: progress,
            status: indicatorStatus,
            department_name: departmentName,
            has_target: hasTarget,
            has_data: hasData,
          });
        }
      });

      details.sort((a, b) => a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' }));
      setIndicatorDetails(details);
    } catch (error) {
      console.error('Gösterge detayları yükleme hatası:', error);
    } finally {
      setLoadingIndicators(false);
    }
  };

  const getStatusColorClass = (status: IndicatorStatus) => {
    const config = getStatusConfig(status);
    return `${config.color} ${config.bgColor}`;
  };

  const handleExportIndicatorDetailsExcel = () => {
    if (indicatorDetails.length === 0) return;

    const exportData = indicatorDetails.map(ind => ({
      'Gösterge Kodu': ind.code,
      'Gösterge Adı': ind.name,
      'Müdürlük': ind.department_name || '-',
      'Gerçekleşen': ind.current_value.toFixed(2),
      'Hedef': ind.target_value.toFixed(2),
      'İlerleme (%)': Math.round(ind.progress),
      'Durum': getStatusLabel(ind.status),
      'Hedef Tanımlı': ind.has_target ? 'Evet' : 'Hayır',
      'Veri Girişi': ind.has_data ? 'Var' : 'Yok',
    }));

    const statusLabel = selectedStatus ? getStatusLabel(selectedStatus) : 'Tum';
    const deptLabel = selectedDepartment ? `_${selectedDepartment.department_name}` : '_Kurum_Geneli';
    exportToExcel(
      exportData,
      `${statusLabel}_Gostergeler${deptLabel}_${currentYear}_${new Date().toISOString().split('T')[0]}`
    );
  };

  const handleExportIndicatorDetailsPDF = () => {
    if (indicatorDetails.length === 0) return;

    const headers = ['Kod', 'Gösterge', 'Müdürlük', 'Gerçekleşen', 'Hedef', 'İlerleme', 'Durum'];
    const rows = indicatorDetails.map(ind => [
      ind.code,
      ind.name,
      ind.department_name || '-',
      ind.current_value.toFixed(2),
      ind.target_value > 0 ? ind.target_value.toFixed(2) : 'Belirtilmemiş',
      `${Math.round(ind.progress)}%`,
      getStatusLabel(ind.status),
    ]);

    const statusLabel = selectedStatus ? getStatusLabel(selectedStatus) : 'Tüm';
    const deptLabel = selectedDepartment ? ` - ${selectedDepartment.department_name}` : ' - Kurum Geneli';
    const content = `
      <h2>${statusLabel} Göstergeler${deptLabel} - ${currentYear}</h2>
      <div class="mb-4">
        <p><strong>Toplam Gösterge:</strong> ${indicatorDetails.length}</p>
        <p><strong>Hedefi Olmayan:</strong> ${indicatorDetails.filter(i => !i.has_target).length}</p>
        <p><strong>Veri Girişi Olmayan:</strong> ${indicatorDetails.filter(i => !i.has_data).length}</p>
      </div>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF(
      `${statusLabel} Göstergeler${deptLabel}`,
      content,
      `${statusLabel}_Gostergeler${selectedDepartment ? `_${selectedDepartment.department_name}` : '_Kurum_Geneli'}_${currentYear}_${new Date().toISOString().split('T')[0]}`
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Performans Gösterge Paneli</h2>
          <p className="text-sm text-slate-600 mt-1">
            Birimler bazında performans karşılaştırması
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-4">
        <ArrowUpDown className="w-5 h-5 text-slate-500" />
        <label className="text-sm font-medium text-slate-700">Sıralama:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="progress-desc">İlerleme (Yüksekten Düşüğe)</option>
          <option value="progress-asc">İlerleme (Düşükten Yükseğe)</option>
          <option value="count-desc">Gösterge Sayısı (Yüksekten Düşüğe)</option>
          <option value="count-asc">Gösterge Sayısı (Düşükten Yükseğe)</option>
          <option value="name-asc">Birim Adı (A-Z)</option>
          <option value="name-desc">Birim Adı (Z-A)</option>
        </select>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Kurum Genel İlerleme</p>
            <p className="text-4xl font-bold mt-2">{Math.round(overallProgress)}%</p>
          </div>
          {overallProgress >= 70 ? (
            <TrendingUp className="w-16 h-16 text-blue-200" />
          ) : overallProgress >= 50 ? (
            <Minus className="w-16 h-16 text-blue-200" />
          ) : (
            <TrendingDown className="w-16 h-16 text-blue-200" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-900">{overallStats.total}</div>
          <div className="text-sm text-slate-600 mt-1">Toplam Gösterge</div>
        </div>
        <button
          onClick={() => overallStats.exceedingTarget > 0 && loadIndicatorDetails('exceeding_target')}
          disabled={overallStats.exceedingTarget === 0}
          className={`bg-purple-50 border border-purple-200 rounded-lg p-4 text-center transition-all ${
            overallStats.exceedingTarget > 0 ? 'hover:bg-purple-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-purple-600">{overallStats.exceedingTarget}</div>
          <div className="text-sm text-slate-600 mt-1">Hedef Üstü</div>
        </button>
        <button
          onClick={() => overallStats.excellent > 0 && loadIndicatorDetails('excellent')}
          disabled={overallStats.excellent === 0}
          className={`bg-green-100 border border-green-300 rounded-lg p-4 text-center transition-all ${
            overallStats.excellent > 0 ? 'hover:bg-green-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-700">{overallStats.excellent}</div>
          <div className="text-sm text-slate-600 mt-1">Çok İyi</div>
        </button>
        <button
          onClick={() => overallStats.good > 0 && loadIndicatorDetails('good')}
          disabled={overallStats.good === 0}
          className={`bg-green-50 border border-green-200 rounded-lg p-4 text-center transition-all ${
            overallStats.good > 0 ? 'hover:bg-green-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-600">{overallStats.good}</div>
          <div className="text-sm text-slate-600 mt-1">İyi</div>
        </button>
        <button
          onClick={() => overallStats.moderate > 0 && loadIndicatorDetails('moderate')}
          disabled={overallStats.moderate === 0}
          className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center transition-all ${
            overallStats.moderate > 0 ? 'hover:bg-yellow-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-600">{overallStats.moderate}</div>
          <div className="text-sm text-slate-600 mt-1">Orta</div>
        </button>
        <button
          onClick={() => overallStats.weak > 0 && loadIndicatorDetails('weak')}
          disabled={overallStats.weak === 0}
          className={`bg-red-50 border border-red-200 rounded-lg p-4 text-center transition-all ${
            overallStats.weak > 0 ? 'hover:bg-red-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-red-600">{overallStats.weak}</div>
          <div className="text-sm text-slate-600 mt-1">Zayıf</div>
        </button>
        <button
          onClick={() => overallStats.veryWeak > 0 && loadIndicatorDetails('very_weak')}
          disabled={overallStats.veryWeak === 0}
          className={`bg-amber-100 border border-amber-300 rounded-lg p-4 text-center transition-all ${
            overallStats.veryWeak > 0 ? 'hover:bg-amber-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-amber-800">{overallStats.veryWeak}</div>
          <div className="text-sm text-slate-600 mt-1">Çok Zayıf</div>
        </button>
      </div>

      {sortedDepartments.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz veri bulunmuyor</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedDepartments.map((dept, index) => {
            const rank = index + 1;
            const isTopThree = sortBy === 'progress-desc' && rank <= 3;
            const rankColors = {
              1: 'bg-yellow-100 text-yellow-800 border-yellow-300',
              2: 'bg-gray-100 text-gray-800 border-gray-300',
              3: 'bg-orange-100 text-orange-800 border-orange-300'
            };

            return (
              <div
                key={dept.department_id}
                className={`bg-white border rounded-lg p-6 ${
                  isTopThree ? 'border-2 ' + (rankColors[rank as 1 | 2 | 3] || '') : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      isTopThree ? rankColors[rank as 1 | 2 | 3] : 'bg-slate-100 text-slate-600'
                    }`}>
                      {rank}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{dept.department_name}</h3>
                      <p className="text-sm text-slate-600">{dept.total_indicators} gösterge</p>
                    </div>
                  </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(dept.avg_progress)}%
                  </div>
                  <div className="text-xs text-slate-500">Ortalama İlerleme</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      dept.avg_progress >= 115
                        ? 'bg-purple-500'
                        : dept.avg_progress >= 85
                        ? 'bg-green-500'
                        : dept.avg_progress >= 70
                        ? 'bg-green-400'
                        : dept.avg_progress >= 55
                        ? 'bg-yellow-500'
                        : dept.avg_progress >= 45
                        ? 'bg-red-500'
                        : 'bg-amber-700'
                    }`}
                    style={{ width: `${Math.min(dept.avg_progress, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-6 gap-3">
                <button
                  onClick={() => dept.exceedingTarget > 0 && loadIndicatorDetails('exceeding_target', dept)}
                  disabled={dept.exceedingTarget === 0}
                  className={`bg-purple-50 rounded-lg p-3 text-center transition-all ${
                    dept.exceedingTarget > 0 ? 'hover:bg-purple-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-purple-600">{dept.exceedingTarget}</div>
                  <div className="text-xs text-slate-600">Hedef Üstü</div>
                </button>
                <button
                  onClick={() => dept.excellent > 0 && loadIndicatorDetails('excellent', dept)}
                  disabled={dept.excellent === 0}
                  className={`bg-green-100 rounded-lg p-3 text-center transition-all ${
                    dept.excellent > 0 ? 'hover:bg-green-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-green-700">{dept.excellent}</div>
                  <div className="text-xs text-slate-600">Çok İyi</div>
                </button>
                <button
                  onClick={() => dept.good > 0 && loadIndicatorDetails('good', dept)}
                  disabled={dept.good === 0}
                  className={`bg-green-50 rounded-lg p-3 text-center transition-all ${
                    dept.good > 0 ? 'hover:bg-green-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-green-600">{dept.good}</div>
                  <div className="text-xs text-slate-600">İyi</div>
                </button>
                <button
                  onClick={() => dept.moderate > 0 && loadIndicatorDetails('moderate', dept)}
                  disabled={dept.moderate === 0}
                  className={`bg-yellow-50 rounded-lg p-3 text-center transition-all ${
                    dept.moderate > 0 ? 'hover:bg-yellow-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-yellow-600">{dept.moderate}</div>
                  <div className="text-xs text-slate-600">Orta</div>
                </button>
                <button
                  onClick={() => dept.weak > 0 && loadIndicatorDetails('weak', dept)}
                  disabled={dept.weak === 0}
                  className={`bg-red-50 rounded-lg p-3 text-center transition-all ${
                    dept.weak > 0 ? 'hover:bg-red-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-red-600">{dept.weak}</div>
                  <div className="text-xs text-slate-600">Zayıf</div>
                </button>
                <button
                  onClick={() => dept.veryWeak > 0 && loadIndicatorDetails('very_weak', dept)}
                  disabled={dept.veryWeak === 0}
                  className={`bg-amber-100 rounded-lg p-3 text-center transition-all ${
                    dept.veryWeak > 0 ? 'hover:bg-amber-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-amber-800">{dept.veryWeak}</div>
                  <div className="text-xs text-slate-600">Çok Zayıf</div>
                </button>
              </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        title={`${selectedDepartment?.department_name || 'Kurum Geneli'} - ${selectedStatus ? getStatusLabel(selectedStatus) : ''} Göstergeler`}
        size="large"
      >
        <div className="space-y-4">
          {loadingIndicators ? (
            <div className="text-center py-8 text-slate-500">Göstergeler yükleniyor...</div>
          ) : indicatorDetails.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Bu kategoride gösterge bulunmuyor</div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-600">
                      Toplam <span className="font-bold text-slate-900">{indicatorDetails.length}</span> gösterge
                    </div>
                    {selectedStatus && (
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColorClass(selectedStatus)}`}>
                        {getStatusLabel(selectedStatus)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportIndicatorDetailsExcel}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={handleExportIndicatorDetailsPDF}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>

              {indicatorDetails.map((indicator) => (
                <div
                  key={indicator.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {indicator.code}
                        </span>
                        {indicator.department_name && (
                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                            {indicator.department_name}
                          </span>
                        )}
                        {selectedStatus && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColorClass(selectedStatus)}`}>
                            {getStatusLabel(selectedStatus)}
                          </span>
                        )}
                        {!indicator.has_target && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                            Hedef Belirlenmemiş
                          </span>
                        )}
                        {!indicator.has_data && (
                          <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full border border-orange-200">
                            Veri Girişi Yok
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-slate-900 mb-3">{indicator.name}</h4>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Gerçekleşen</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {indicator.current_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Hedef</div>
                          <div className="text-lg font-semibold text-slate-700">
                            {indicator.target_value > 0
                              ? indicator.target_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                              : 'Belirtilmemiş'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">İlerleme</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {Math.round(indicator.progress)}%
                          </div>
                        </div>
                      </div>

                      {indicator.has_target && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getStatusConfig(indicator.status).progressBarColor}`}
                              style={{ width: `${Math.min(indicator.progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => setShowIndicatorModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
