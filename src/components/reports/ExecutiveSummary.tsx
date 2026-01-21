import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calendar, FileText, X } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/exportHelpers';
import { calculatePerformancePercentage, CalculationMethod } from '../../utils/indicatorCalculations';
import Modal from '../ui/Modal';

interface ExecutiveData {
  overall_progress: number;
  total_indicators: number;
  on_track: number;
  at_risk: number;
  behind: number;
  top_performers: Array<{ name: string; progress: number }>;
  concerns: Array<{ name: string; progress: number }>;
  overdue_activities: number;
  pending_approvals: number;
  data_completion: number;
  recommendations: string[];
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
  status: 'on_track' | 'at_risk' | 'behind';
}

export default function ExecutiveSummary({ selectedYear }: ExecutiveSummaryProps) {
  const { profile } = useAuth();
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const currentYear = selectedYear || new Date().getFullYear();
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'on_track' | 'at_risk' | 'behind' | null>(null);
  const [indicatorDetails, setIndicatorDetails] = useState<IndicatorDetail[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {

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

      let indicatorsQuery = supabase
        .from('indicators')
        .select('id, name, goal_id, calculation_method')
        .eq('organization_id', profile.organization_id);

      if (allowedGoalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', allowedGoalIds);
      } else if (profile.role !== 'admin' && profile.role !== 'manager') {
        indicatorsQuery = indicatorsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { data: indicators } = await indicatorsQuery;

      if (!indicators || indicators.length === 0) {
        setData({
          overall_progress: 0,
          total_indicators: 0,
          on_track: 0,
          at_risk: 0,
          behind: 0,
          top_performers: [],
          concerns: [],
          overdue_activities: 0,
          pending_approvals: 0,
          data_completion: 0,
          recommendations: ['Henüz gösterge bulunmuyor. Stratejik planınızı tamamlayın.'],
        });
        setLoading(false);
        return;
      }

      const indicatorIds = indicators.map(i => i.id);

      const [entriesData, targetsData, activitiesData, pendingApprovalsData] = await Promise.all([
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, period_quarter')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .in('status', ['approved', 'submitted'])
          .in('indicator_id', indicatorIds)
          .order('period_quarter', { ascending: true }),
        supabase
          .from('indicator_targets')
          .select('indicator_id, target_value, baseline_value')
          .eq('year', currentYear)
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

      const entriesByIndicator: Record<string, number[]> = {};
      const quartersByIndicator: Record<string, number> = {};
      entriesData.data?.forEach(entry => {
        if (!entriesByIndicator[entry.indicator_id]) {
          entriesByIndicator[entry.indicator_id] = [];
        }
        entriesByIndicator[entry.indicator_id].push(entry.value || 0);

        if (!quartersByIndicator[entry.indicator_id]) {
          quartersByIndicator[entry.indicator_id] = 0;
        }
        quartersByIndicator[entry.indicator_id]++;
      });

      const targetsByIndicator: Record<string, { target: number; baseline: number }> = {};
      targetsData.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = {
          target: target.target_value,
          baseline: target.baseline_value || 0,
        };
      });

      const indicatorProgress: Array<{ id: string; name: string; progress: number }> = [];
      let totalProgress = 0;
      let onTrack = 0;
      let atRisk = 0;
      let behind = 0;

      indicators.forEach(ind => {
        const targetData = targetsByIndicator[ind.id];
        if (!targetData || targetData.target === 0) {
          indicatorProgress.push({ id: ind.id, name: ind.name, progress: 0 });
          behind++;
          return;
        }

        const periodValues = entriesByIndicator[ind.id] || [];
        const calculationMethod = (ind.calculation_method || 'standard') as CalculationMethod;

        const progress = calculatePerformancePercentage({
          method: calculationMethod,
          baselineValue: targetData.baseline,
          targetValue: targetData.target,
          periodValues: periodValues,
          currentValue: 0,
        });

        indicatorProgress.push({ id: ind.id, name: ind.name, progress });
        totalProgress += progress;

        if (progress >= 70) onTrack++;
        else if (progress >= 50) atRisk++;
        else behind++;
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
      const overallProgress = indicators.length > 0 ? totalProgress / indicators.length : 0;

      if (overallProgress < 50) {
        recommendations.push('Kurum genel performansı düşük seviyede. Acil eylem planı gerekli.');
      }
      if (behind > 0) {
        recommendations.push(
          `${behind} gösterge ciddi şekilde geride. Bu göstergelere öncelik verilmeli.`
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
      if (atRisk > 0) {
        recommendations.push(
          `${atRisk} gösterge risk altında. Performans iyileştirme çalışmaları başlatılmalı.`
        );
      }

      if (recommendations.length === 0) {
        recommendations.push('Genel performans iyi durumda. Mevcut çalışmalara devam edilmeli.');
      }

      setData({
        overall_progress: overallProgress,
        total_indicators: indicators.length,
        on_track: onTrack,
        at_risk: atRisk,
        behind: behind,
        top_performers: indicatorProgress.slice(0, 5),
        concerns: indicatorProgress.slice(-5).reverse(),
        overdue_activities: overdueActivities,
        pending_approvals: pendingApprovalsData.count || 0,
        data_completion: dataCompletion,
        recommendations: recommendations,
      });
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const exportData = [
      { 'Metrik': 'Genel İlerleme', 'Değer': `${Math.round(data.overall_progress)}%` },
      { 'Metrik': 'Toplam Gösterge', 'Değer': data.total_indicators },
      { 'Metrik': 'Hedefte', 'Değer': data.on_track },
      { 'Metrik': 'Risk Altında', 'Değer': data.at_risk },
      { 'Metrik': 'Geride', 'Değer': data.behind },
      { 'Metrik': 'Gecikmiş Faaliyet', 'Değer': data.overdue_activities },
      { 'Metrik': 'Bekleyen Onay', 'Değer': data.pending_approvals },
      { 'Metrik': 'Veri Giriş Oranı', 'Değer': `${Math.round(data.data_completion)}%` },
    ];

    exportToExcel(exportData, 'Yonetici_Ozeti');
  };

  const loadIndicatorDetails = async (status: 'on_track' | 'at_risk' | 'behind') => {
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
          .in('status', ['approved', 'submitted'])
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

          let indicatorStatus: 'on_track' | 'at_risk' | 'behind';
          if (progress >= 70) indicatorStatus = 'on_track';
          else if (progress >= 50) indicatorStatus = 'at_risk';
          else indicatorStatus = 'behind';

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

  const getStatusLabel = (status: 'on_track' | 'at_risk' | 'behind') => {
    switch (status) {
      case 'on_track': return 'Hedefte';
      case 'at_risk': return 'Risk Altında';
      case 'behind': return 'Geride';
    }
  };

  const getStatusColor = (status: 'on_track' | 'at_risk' | 'behind') => {
    switch (status) {
      case 'on_track': return 'text-green-600 bg-green-50';
      case 'at_risk': return 'text-yellow-600 bg-yellow-50';
      case 'behind': return 'text-red-600 bg-red-50';
    }
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

      <h3>En Yüksek Performans Gösteren Alanlar</h3>
      <table>
        <tr><th>Gösterge</th><th>İlerleme</th></tr>
        ${data.top_performers.map(p => `<tr><td>${p.name}</td><td>${Math.round(p.progress)}%</td></tr>`).join('')}
      </table>

      <h3>Dikkat Gerektiren Alanlar</h3>
      <table>
        <tr><th>Gösterge</th><th>İlerleme</th></tr>
        ${data.concerns.map(c => `<tr><td>${c.name}</td><td>${Math.round(c.progress)}%</td></tr>`).join('')}
      </table>

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
            onClick={handlePDFExport}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF'e Aktar
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
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

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-900">{data.total_indicators}</div>
          <div className="text-sm text-slate-600 mt-1">Toplam Gösterge</div>
        </div>
        <button
          onClick={() => data.on_track > 0 && loadIndicatorDetails('on_track')}
          disabled={data.on_track === 0}
          className={`bg-green-50 border border-green-200 rounded-lg p-4 text-center transition-all ${
            data.on_track > 0 ? 'hover:bg-green-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-600">{data.on_track}</div>
          <div className="text-sm text-slate-600 mt-1">Hedefte</div>
        </button>
        <button
          onClick={() => data.at_risk > 0 && loadIndicatorDetails('at_risk')}
          disabled={data.at_risk === 0}
          className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center transition-all ${
            data.at_risk > 0 ? 'hover:bg-yellow-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-600">{data.at_risk}</div>
          <div className="text-sm text-slate-600 mt-1">Risk Altında</div>
        </button>
        <button
          onClick={() => data.behind > 0 && loadIndicatorDetails('behind')}
          disabled={data.behind === 0}
          className={`bg-red-50 border border-red-200 rounded-lg p-4 text-center transition-all ${
            data.behind > 0 ? 'hover:bg-red-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-red-600">{data.behind}</div>
          <div className="text-sm text-slate-600 mt-1">Geride</div>
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
            <TrendingUp className="w-5 h-5 text-green-500" />
            En Yüksek Performans
          </h3>
          {data.top_performers.length === 0 ? (
            <p className="text-sm text-slate-500">Veri bulunmuyor</p>
          ) : (
            <div className="space-y-3">
              {data.top_performers.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  <span className="text-sm font-semibold text-green-600 ml-2">
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
            Dikkat Gerektiren Alanlar
          </h3>
          {data.concerns.length === 0 ? (
            <p className="text-sm text-slate-500">Veri bulunmuyor</p>
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
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedStatus)}`}>
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
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(selectedStatus)}`}>
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
                            className={`h-2 rounded-full transition-all ${
                              indicator.status === 'on_track'
                                ? 'bg-green-500'
                                : indicator.status === 'at_risk'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
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
