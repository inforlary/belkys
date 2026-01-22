import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calendar, FileText, X, FileSpreadsheet, FileDown } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../../utils/exportHelpers';
import { calculatePerformancePercentage, CalculationMethod } from '../../utils/indicatorCalculations';
import { calculateGoalProgress } from '../../utils/progressCalculations';
import {
  IndicatorStatus,
  getIndicatorStatus,
  getStatusConfig,
  getStatusLabel,
  createEmptyStats,
  incrementStatusInStats,
  type IndicatorStats as StatusStats
} from '../../utils/indicatorStatus';
import Modal from '../ui/Modal';

interface PlanSummary {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  objectives_count: number;
  goals_count: number;
  indicators_count: number;
}

interface ExecutiveData {
  overall_progress: number;
  total_indicators: number;
  exceedingTarget: number;
  excellent: number;
  good: number;
  moderate: number;
  weak: number;
  veryWeak: number;
  top_performers: Array<{ name: string; progress: number }>;
  concerns: Array<{ name: string; progress: number }>;
  overdue_activities: number;
  pending_approvals: number;
  data_completion: number;
  recommendations: string[];
  strategic_plans: PlanSummary[];
}

interface ExecutiveSummaryProps {
  selectedYear?: number;
}

interface IndicatorDetail {
  id: string;
  name: string;
  code: string;
  current_value: number;
  target_value: number;
  progress: number;
  status: IndicatorStatus;
}

export default function ExecutiveSummary({ selectedYear }: ExecutiveSummaryProps) {
  const { profile } = useAuth();
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const currentYear = selectedYear || new Date().getFullYear();
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IndicatorStatus | null>(null);
  const [indicatorDetails, setIndicatorDetails] = useState<IndicatorDetail[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      // Load strategic plans
      const { data: plansData } = await supabase
        .from('strategic_plans')
        .select('id, name, start_year, end_year')
        .eq('organization_id', profile.organization_id)
        .order('start_year', { ascending: false });

      let strategicPlans: PlanSummary[] = [];

      if (plansData && plansData.length > 0) {
        strategicPlans = await Promise.all(
          plansData.map(async (plan) => {
            const { data: objectives, count: objectivesCount } = await supabase
              .from('objectives')
              .select('id', { count: 'exact' })
              .eq('strategic_plan_id', plan.id);

            if (!objectives || objectives.length === 0) {
              return {
                id: plan.id,
                name: plan.name,
                start_year: plan.start_year,
                end_year: plan.end_year,
                objectives_count: 0,
                goals_count: 0,
                indicators_count: 0,
              };
            }

            const objectiveIds = objectives.map(o => o.id);

            let goalsQuery = supabase
              .from('goals')
              .select('id', { count: 'exact' })
              .in('objective_id', objectiveIds);

            if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
              goalsQuery = goalsQuery.eq('department_id', profile.department_id);
            }

            const { data: goals, count: goalsCount } = await goalsQuery;

            let indicatorCount = 0;
            if (goals && goals.length > 0) {
              const goalIds = goals.map(g => g.id);
              const { count } = await supabase
                .from('indicators')
                .select('id', { count: 'exact', head: true })
                .in('goal_id', goalIds);
              indicatorCount = count || 0;
            }

            return {
              id: plan.id,
              name: plan.name,
              start_year: plan.start_year,
              end_year: plan.end_year,
              objectives_count: objectivesCount || 0,
              goals_count: goalsCount || 0,
              indicators_count: indicatorCount,
            };
          })
        );
      }

      // Get allowed goals first (department filtering)
      let goalsQuery = supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their department's data
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: allowedGoals } = await goalsQuery;
      const allowedGoalIds = allowedGoals?.map(g => g.id) || [];

      if (allowedGoalIds.length === 0) {
        setData({
          overall_progress: 0,
          total_indicators: 0,
          exceedingTarget: 0,
          excellent: 0,
          good: 0,
          moderate: 0,
          weak: 0,
          veryWeak: 0,
          top_performers: [],
          concerns: [],
          overdue_activities: 0,
          pending_approvals: 0,
          data_completion: 0,
          recommendations: ['Henüz hedef bulunmuyor. Stratejik planınızı tamamlayın.'],
          strategic_plans: strategicPlans,
        });
        setLoading(false);
        return;
      }

      let indicatorsQuery = supabase
        .from('indicators')
        .select('id, name, goal_id, calculation_method, goal_impact_percentage, target_value, baseline_value')
        .eq('organization_id', profile.organization_id)
        .in('goal_id', allowedGoalIds);

      const { data: indicators } = await indicatorsQuery;

      if (!indicators || indicators.length === 0) {
        setData({
          overall_progress: 0,
          total_indicators: 0,
          exceedingTarget: 0,
          excellent: 0,
          good: 0,
          moderate: 0,
          weak: 0,
          veryWeak: 0,
          top_performers: [],
          concerns: [],
          overdue_activities: 0,
          pending_approvals: 0,
          data_completion: 0,
          recommendations: ['Henüz gösterge bulunmuyor. Stratejik planınızı tamamlayın.'],
          strategic_plans: strategicPlans,
        });
        setLoading(false);
        return;
      }

      const indicatorIds = indicators.map(i => i.id);

      const [entriesData, activitiesData, pendingApprovalsData] = await Promise.all([
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .eq('status', 'approved')
          .in('indicator_id', indicatorIds),
        (async () => {
          let activitiesQuery = supabase
            .from('activities')
            .select('id, end_date, status, start_date')
            .eq('organization_id', profile.organization_id)
            .eq('status', 'ongoing');

          if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
            activitiesQuery = activitiesQuery.eq('department_id', profile.department_id);
          }

          const { data } = await activitiesQuery;

          const filteredActivities = data?.filter(activity => {
            const startYear = new Date(activity.start_date).getFullYear();
            const endYear = new Date(activity.end_date).getFullYear();
            return startYear <= currentYear && endYear >= currentYear;
          }) || [];

          return { data: filteredActivities };
        })(),
        supabase
          .from('indicator_data_entries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .in('status', ['submitted', 'pending']),
      ]);

      const indicatorProgress: Array<{ id: string; name: string; progress: number }> = [];
      const stats = createEmptyStats();
      const quartersByIndicator: Record<string, number> = {};

      let totalGoalProgress = 0;
      let goalCount = 0;

      allowedGoals.forEach(goal => {
        const goalIndicators = indicators.filter(ind => ind.goal_id === goal.id).map(ind => ({
          id: ind.id,
          goal_id: ind.goal_id,
          goal_impact_percentage: ind.goal_impact_percentage,
          target_value: ind.target_value,
          baseline_value: ind.baseline_value,
          calculation_method: ind.calculation_method
        }));

        if (goalIndicators.length === 0) return;

        const goalProgress = calculateGoalProgress(goal.id, goalIndicators, entriesData.data || []);
        totalGoalProgress += goalProgress;
        goalCount++;

        goalIndicators.forEach(indicator => {
          const indicatorEntries = (entriesData.data || []).filter(e => e.indicator_id === indicator.id && e.status === 'approved');

          if (!quartersByIndicator[indicator.id]) {
            quartersByIndicator[indicator.id] = 0;
          }
          quartersByIndicator[indicator.id] += indicatorEntries.length;

          if (indicatorEntries.length === 0) {
            indicatorProgress.push({ id: indicator.id, name: indicators.find(i => i.id === indicator.id)?.name || '', progress: 0 });
            const status = getIndicatorStatus(0);
            incrementStatusInStats(stats, status);
            return;
          }

          const periodValues = indicatorEntries.map(e => e.value || 0);
          const calculationMethod = (indicator.calculation_method || 'standard') as CalculationMethod;

          const progress = calculatePerformancePercentage({
            method: calculationMethod,
            baselineValue: indicator.baseline_value || 0,
            targetValue: indicator.target_value || 0,
            periodValues: periodValues,
            currentValue: 0,
          });

          indicatorProgress.push({ id: indicator.id, name: indicators.find(i => i.id === indicator.id)?.name || '', progress });

          const status = getIndicatorStatus(progress);
          incrementStatusInStats(stats, status);
        });
      });

      indicatorProgress.sort((a, b) => b.progress - a.progress);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdueActivities =
        activitiesData.data?.filter(a => {
          const endDate = new Date(a.end_date);
          endDate.setHours(0, 0, 0, 0);
          return endDate < today;
        }).length || 0;

      const totalExpectedEntries = indicators.length * 4;
      const totalEntries = Object.values(quartersByIndicator).reduce((sum, count) => sum + count, 0);
      const dataCompletion = (totalEntries / totalExpectedEntries) * 100;

      const recommendations: string[] = [];
      const overallProgress = goalCount > 0 ? totalGoalProgress / goalCount : 0;

      if (overallProgress < 50) {
        recommendations.push('Kurum genel performansı düşük seviyede. Acil eylem planı gerekli.');
      }
      if (stats.veryWeak > 0 || stats.weak > 0) {
        recommendations.push(
          `${stats.veryWeak + stats.weak} gösterge ciddi şekilde geride. Bu göstergelere öncelik verilmeli.`
        );
      }
      if (overdueActivities > 0) {
        recommendations.push(
          `${overdueActivities} faaliyet süresi geçmiş. Faaliyet takvimi gözden geçirilmeli.`
        );
      }
      if (dataCompletion < 75) {
        recommendations.push(
          'Veri giriş oranı düşük. Sorumlu personele hatırlatma yapılmalı.'
        );
      }
      if (pendingApprovalsData.count && pendingApprovalsData.count > 10) {
        recommendations.push(
          'Çok sayıda onay bekleyen veri girişi var. Onay süreçleri hızlandırılmalı.'
        );
      }
      if (stats.moderate > 0) {
        recommendations.push(
          `${stats.moderate} gösterge orta seviyede. Performans iyileştirme çalışmaları başlatılmalı.`
        );
      }

      if (recommendations.length === 0) {
        recommendations.push('Genel performans iyi durumda. Mevcut çalışmalara devam edilmeli.');
      }

      const exceedingTargetIndicators = indicatorProgress.filter(ind => ind.progress >= 115);
      const weakIndicators = indicatorProgress.filter(ind => ind.progress < 55);

      setData({
        overall_progress: overallProgress,
        total_indicators: indicators.length,
        exceedingTarget: stats.exceedingTarget,
        excellent: stats.excellent,
        good: stats.good,
        moderate: stats.moderate,
        weak: stats.weak,
        veryWeak: stats.veryWeak,
        top_performers: exceedingTargetIndicators,
        concerns: weakIndicators,
        overdue_activities: overdueActivities,
        pending_approvals: pendingApprovalsData.count || 0,
        data_completion: dataCompletion,
        recommendations: recommendations,
        strategic_plans: strategicPlans,
      });
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!data) return;

    const exportData = [
      { 'Metrik': 'Genel İlerleme', 'Değer': `${Math.round(data.overall_progress)}%` },
      { 'Metrik': 'Toplam Gösterge', 'Değer': data.total_indicators },
      { 'Metrik': 'Hedefi Aşan', 'Değer': data.exceedingTarget },
      { 'Metrik': 'Mükemmel', 'Değer': data.excellent },
      { 'Metrik': 'İyi', 'Değer': data.good },
      { 'Metrik': 'Orta', 'Değer': data.moderate },
      { 'Metrik': 'Zayıf', 'Değer': data.weak },
      { 'Metrik': 'Çok Zayıf', 'Değer': data.veryWeak },
      { 'Metrik': 'Gecikmiş Faaliyet', 'Değer': data.overdue_activities },
      { 'Metrik': 'Bekleyen Onay', 'Değer': data.pending_approvals },
      { 'Metrik': 'Veri Giriş Oranı', 'Değer': `${Math.round(data.data_completion)}%` },
    ];

    exportToExcel(exportData, `Yonetici_Ozeti_${currentYear}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    if (!data) return;

    const topPerformersHeaders = ['Gösterge', 'İlerleme'];
    const topPerformersRows = data.top_performers.slice(0, 10).map(p => [
      p.name,
      `${Math.round(p.progress)}%`
    ]);

    const concernsHeaders = ['Gösterge', 'İlerleme'];
    const concernsRows = data.concerns.slice(0, 10).map(c => [
      c.name,
      `${Math.round(c.progress)}%`
    ]);

    const plansHeaders = ['Stratejik Plan', 'Dönem', 'Amaç', 'Hedef', 'Gösterge'];
    const plansRows = data.strategic_plans.map(plan => [
      plan.name,
      `${plan.start_year} - ${plan.end_year}`,
      plan.objectives_count,
      plan.goals_count,
      plan.indicators_count
    ]);

    const content = `
      <h2>Genel Performans Özeti</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${Math.round(data.overall_progress)}%</div>
          <div class="stat-label">Genel İlerleme</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.total_indicators}</div>
          <div class="stat-label">Toplam Gösterge</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #10b981;">
          <div class="stat-value" style="color: #10b981;">${data.exceedingTarget}</div>
          <div class="stat-label">Hedefi Aşan</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #3b82f6;">
          <div class="stat-value" style="color: #3b82f6;">${data.excellent}</div>
          <div class="stat-label">Mükemmel</div>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 10px;">
        <div class="stat-box" style="border-left: 4px solid #22c55e;">
          <div class="stat-value" style="color: #22c55e;">${data.good}</div>
          <div class="stat-label">İyi</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #eab308;">
          <div class="stat-value" style="color: #ca8a04;">${data.moderate}</div>
          <div class="stat-label">Orta</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #f97316;">
          <div class="stat-value" style="color: #f97316;">${data.weak}</div>
          <div class="stat-label">Zayıf</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #dc2626;">
          <div class="stat-value" style="color: #dc2626;">${data.veryWeak}</div>
          <div class="stat-label">Çok Zayıf</div>
        </div>
      </div>

      <h2>Operasyonel Metrikler</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${data.overdue_activities}</div>
          <div class="stat-label">Gecikmiş Faaliyet</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.pending_approvals}</div>
          <div class="stat-label">Bekleyen Onay</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${Math.round(data.data_completion)}%</div>
          <div class="stat-label">Veri Giriş Oranı</div>
        </div>
      </div>

      ${data.top_performers.length > 0 ? `
        <h2>En İyi Performans Gösteren Göstergeler</h2>
        ${generateTableHTML(topPerformersHeaders, topPerformersRows)}
      ` : ''}

      ${data.concerns.length > 0 ? `
        <h2>Dikkat Gerektiren Göstergeler</h2>
        ${generateTableHTML(concernsHeaders, concernsRows)}
      ` : ''}

      ${data.strategic_plans.length > 0 ? `
        <h2>Stratejik Planlar</h2>
        ${generateTableHTML(plansHeaders, plansRows)}
      ` : ''}

      <h2>Öneriler</h2>
      <ul>
        ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    `;

    exportToPDF(`Yönetici Özeti - ${currentYear}`, content, `Yonetici_Ozeti_${currentYear}_${new Date().toISOString().split('T')[0]}`);
  };

  const loadIndicatorDetails = async (status: IndicatorStatus) => {
    if (!profile?.organization_id) return;

    setSelectedStatus(status);
    setShowIndicatorModal(true);
    setLoadingIndicators(true);

    try {
      let goalsQuery = supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: allowedGoals } = await goalsQuery;
      const allowedGoalIds = allowedGoals?.map(g => g.id) || [];

      let indicatorsQuery = supabase
        .from('indicators')
        .select('id, name, code, goal_id, calculation_method')
        .eq('organization_id', profile.organization_id);

      if (allowedGoalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', allowedGoalIds);
      } else if (profile.role !== 'admin' && profile.role !== 'manager') {
        setIndicatorDetails([]);
        setLoadingIndicators(false);
        return;
      }

      const { data: indicators } = await indicatorsQuery;

      if (!indicators || indicators.length === 0) {
        setIndicatorDetails([]);
        setLoadingIndicators(false);
        return;
      }

      const indicatorIds = indicators.map(i => i.id);

      const [entriesResult, targetsResult] = await Promise.all([
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, period_quarter')
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
        if (targetData && targetData.target > 0) {
          const periodValues = entriesByIndicator[indicator.id] || [];
          const calculationMethod = (indicator.calculation_method || 'standard') as CalculationMethod;

          const sum = periodValues.reduce((acc, val) => acc + val, 0);
          let currentValue = sum;

          if (calculationMethod.includes('cumulative') || calculationMethod === 'increasing') {
            currentValue = targetData.baseline + sum;
          } else if (calculationMethod === 'decreasing') {
            currentValue = targetData.baseline - sum;
          }

          const progress = calculatePerformancePercentage({
            method: calculationMethod,
            baselineValue: targetData.baseline,
            targetValue: targetData.target,
            periodValues: periodValues,
            currentValue: currentValue,
          });

          const indicatorStatus = getIndicatorStatus(progress);

          if (indicatorStatus === status) {
            details.push({
              id: indicator.id,
              name: indicator.name,
              code: indicator.code || '',
              current_value: currentValue,
              target_value: targetData.target,
              progress: progress,
              status: indicatorStatus,
            });
          }
        }
      });

      details.sort((a, b) => a.code.localeCompare(b.code));
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

  const handlePDFExport = () => {
    if (!data) return;

    const content = `
      <h2>Kurum Genel Durumu - ${currentYear}</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${Math.round(data.overall_progress)}%</div>
          <div class="stat-label">Genel İlerleme</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.total_indicators}</div>
          <div class="stat-label">Toplam Gösterge</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.on_track}</div>
          <div class="stat-label">Hedefte</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.at_risk}</div>
          <div class="stat-label">Risk Altında</div>
        </div>
      </div>

      <h3>Performans Dağılımı</h3>
      <table>
        <tr><th>Metrik</th><th>Değer</th></tr>
        <tr><td>Geride Kalan Göstergeler</td><td>${data.behind}</td></tr>
        <tr><td>Gecikmiş Faaliyetler</td><td>${data.overdue_activities}</td></tr>
        <tr><td>Bekleyen Onaylar</td><td>${data.pending_approvals}</td></tr>
        <tr><td>Veri Giriş Tamamlanma Oranı</td><td>${Math.round(data.data_completion)}%</td></tr>
      </table>

      <h3>Hedef Sapması Gösteren Göstergeler</h3>
      ${data.top_performers.length > 0 ? `
      <table>
        <tr><th>Gösterge</th><th>İlerleme</th></tr>
        ${data.top_performers.map(p => `<tr><td>${p.name}</td><td>${Math.round(p.progress)}%</td></tr>`).join('')}
      </table>
      ` : '<p>Hedef sapması olan gösterge bulunmuyor</p>'}

      <h3>Geride Kalan Göstergeler</h3>
      ${data.concerns.length > 0 ? `
      <table>
        <tr><th>Gösterge</th><th>İlerleme</th></tr>
        ${data.concerns.map(c => `<tr><td>${c.name}</td><td>${Math.round(c.progress)}%</td></tr>`).join('')}
      </table>
      ` : '<p>Geride kalan gösterge bulunmuyor</p>'}

      <h3>Öneriler ve Dikkat Noktaları</h3>
      ${data.recommendations.map(rec => `<div class="recommendation">• ${rec}</div>`).join('')}
    `;

    exportToPDF('Yönetici Özet Raporu', content);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  if (!data) {
    return <div className="text-center py-8 text-slate-500">Veri yüklenemedi</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Yönetici Özet Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Yüksek seviye performans özeti ve öneriler
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

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Kurum Genel Durumu - {currentYear}
            </p>
            <p className="text-5xl font-bold">{Math.round(data.overall_progress)}%</p>
            <p className="text-blue-100 mt-2">Genel İlerleme Oranı</p>
          </div>
          {data.overall_progress >= 70 ? (
            <TrendingUp className="w-20 h-20 text-blue-300" />
          ) : (
            <TrendingDown className="w-20 h-20 text-blue-300" />
          )}
        </div>
      </div>

      {data.strategic_plans.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Stratejik Planlar
          </h3>
          <div className="space-y-4">
            {data.strategic_plans.map((plan) => (
              <div
                key={plan.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-slate-900">{plan.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {plan.start_year} - {plan.end_year}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{plan.objectives_count}</div>
                    <div className="text-xs text-slate-600 mt-1">Amaç</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{plan.goals_count}</div>
                    <div className="text-xs text-slate-600 mt-1">Hedef</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">{plan.indicators_count}</div>
                    <div className="text-xs text-slate-600 mt-1">Gösterge</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-900">{data.total_indicators}</div>
          <div className="text-sm text-slate-600 mt-1">Toplam Gösterge</div>
        </div>
        <button
          onClick={() => data.exceedingTarget > 0 && loadIndicatorDetails('exceeding_target')}
          disabled={data.exceedingTarget === 0}
          className={`bg-purple-50 border border-purple-200 rounded-lg p-4 text-center transition-all ${
            data.exceedingTarget > 0 ? 'hover:bg-purple-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-purple-600">{data.exceedingTarget}</div>
          <div className="text-sm text-slate-600 mt-1">Hedef Üstü</div>
        </button>
        <button
          onClick={() => data.excellent > 0 && loadIndicatorDetails('excellent')}
          disabled={data.excellent === 0}
          className={`bg-green-100 border border-green-300 rounded-lg p-4 text-center transition-all ${
            data.excellent > 0 ? 'hover:bg-green-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-700">{data.excellent}</div>
          <div className="text-sm text-slate-600 mt-1">Çok İyi</div>
        </button>
        <button
          onClick={() => data.good > 0 && loadIndicatorDetails('good')}
          disabled={data.good === 0}
          className={`bg-green-50 border border-green-200 rounded-lg p-4 text-center transition-all ${
            data.good > 0 ? 'hover:bg-green-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-600">{data.good}</div>
          <div className="text-sm text-slate-600 mt-1">İyi</div>
        </button>
        <button
          onClick={() => data.moderate > 0 && loadIndicatorDetails('moderate')}
          disabled={data.moderate === 0}
          className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center transition-all ${
            data.moderate > 0 ? 'hover:bg-yellow-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-600">{data.moderate}</div>
          <div className="text-sm text-slate-600 mt-1">Orta</div>
        </button>
        <button
          onClick={() => data.weak > 0 && loadIndicatorDetails('weak')}
          disabled={data.weak === 0}
          className={`bg-red-50 border border-red-200 rounded-lg p-4 text-center transition-all ${
            data.weak > 0 ? 'hover:bg-red-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-red-600">{data.weak}</div>
          <div className="text-sm text-slate-600 mt-1">Zayıf</div>
        </button>
        <button
          onClick={() => data.veryWeak > 0 && loadIndicatorDetails('very_weak')}
          disabled={data.veryWeak === 0}
          className={`bg-amber-100 border border-amber-300 rounded-lg p-4 text-center transition-all ${
            data.veryWeak > 0 ? 'hover:bg-amber-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-amber-800">{data.veryWeak}</div>
          <div className="text-sm text-slate-600 mt-1">Çok Zayıf</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Veri Giriş Oranı</span>
            <CheckCircle
              className={`w-5 h-5 ${data.data_completion >= 75 ? 'text-green-500' : 'text-yellow-500'}`}
            />
          </div>
          <div className="text-2xl font-bold text-slate-900">{Math.round(data.data_completion)}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Bekleyen Onay</span>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{data.pending_approvals}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Gecikmiş Faaliyet</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{data.overdue_activities}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Hedef Sapması Gösteren Göstergeler
          </h3>
          {data.top_performers.length === 0 ? (
            <p className="text-sm text-slate-500">Hedef sapması olan gösterge bulunmuyor</p>
          ) : (
            <div className="space-y-3">
              {data.top_performers.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  <span className="text-sm font-semibold text-purple-600 ml-2">
                    {Math.round(item.progress)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Geride Kalan Göstergeler
          </h3>
          {data.concerns.length === 0 ? (
            <p className="text-sm text-slate-500">Geride kalan gösterge bulunmuyor</p>
          ) : (
            <div className="space-y-3">
              {data.concerns.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  <span className="text-sm font-semibold text-red-600 ml-2">
                    {Math.round(item.progress)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Öneriler ve Dikkat Noktaları
        </h3>
        <ul className="space-y-2">
          {data.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-amber-600 mt-0.5">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      <Modal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        title={`${selectedStatus ? getStatusLabel(selectedStatus) : ''} Göstergeler - Kurum Geneli`}
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
                  <div className="text-sm text-slate-600">
                    Toplam <span className="font-bold text-slate-900">{indicatorDetails.length}</span> gösterge
                  </div>
                  {selectedStatus && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColorClass(selectedStatus)}`}>
                      {getStatusLabel(selectedStatus)}
                    </div>
                  )}
                </div>
              </div>

              {indicatorDetails.map((indicator) => (
                <div
                  key={indicator.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {indicator.code}
                        </span>
                        {selectedStatus && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColorClass(selectedStatus)}`}>
                            {getStatusLabel(selectedStatus)}
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
                            {indicator.target_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">İlerleme</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {Math.round(indicator.progress)}%
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${getStatusConfig(indicator.status).progressBarColor}`}
                            style={{ width: `${Math.min(indicator.progress, 100)}%` }}
                          />
                        </div>
                      </div>
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
