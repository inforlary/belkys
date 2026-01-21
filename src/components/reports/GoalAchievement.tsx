import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Target, AlertTriangle, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/exportHelpers';
import { generateGoalAchievementPDF } from '../../utils/reportPDFGenerators';
import { calculateIndicatorProgress, getProgressColor, getProgressTextColor } from '../../utils/progressCalculations';
import {
  IndicatorStatus,
  getIndicatorStatus,
  getStatusConfig,
  getStatusLabel,
  createEmptyStats,
  incrementStatusInStats,
  type IndicatorStats as StatusStats
} from '../../utils/indicatorStatus';

interface GoalData {
  id: string;
  code: string;
  title: string;
  objective_title: string;
  department_name: string;
  indicators_count: number;
  avg_progress: number;
  exceedingTarget: number;
  excellent: number;
  good: number;
  moderate: number;
  weak: number;
  veryWeak: number;
  forecast: string;
}

interface GoalAchievementProps {
  selectedYear?: number;
}

export default function GoalAchievement({ selectedYear }: GoalAchievementProps) {
  const { profile } = useAuth();
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = selectedYear || new Date().getFullYear();

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {

      let goalsQuery = supabase
        .from('goals')
        .select(`
          id,
          code,
          title,
          department_id,
          objectives (
            title
          ),
          departments (
            name
          )
        `)
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their department's goals
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: goalsData } = await goalsQuery.order('code');

      if (goalsData) {
        const processedGoals = await Promise.all(
          goalsData.map(async (goal) => {
            const { data: indicators } = await supabase
              .from('indicators')
              .select('id, baseline_value, target_value, calculation_method')
              .eq('organization_id', profile.organization_id)
              .eq('goal_id', goal.id);

            if (!indicators || indicators.length === 0) {
              return {
                id: goal.id,
                code: goal.code,
                title: goal.title,
                objective_title: (goal.objectives as any)?.title || '',
                department_name: (goal.departments as any)?.name || '',
                indicators_count: 0,
                avg_progress: 0,
                exceedingTarget: 0,
                excellent: 0,
                good: 0,
                moderate: 0,
                weak: 0,
                veryWeak: 0,
                forecast: 'Veri Yok',
              };
            }

            const indicatorIds = indicators.map(i => i.id);

            const [entriesData, targetsData] = await Promise.all([
              supabase
                .from('indicator_data_entries')
                .select('indicator_id, value, status')
                .eq('organization_id', profile.organization_id)
                .eq('period_year', currentYear)
                .eq('status', 'approved')
                .in('indicator_id', indicatorIds),
              supabase
                .from('indicator_targets')
                .select('indicator_id, target_value')
                .eq('year', currentYear)
                .in('indicator_id', indicatorIds),
            ]);

            const targetsByIndicator: Record<string, number> = {};
            targetsData.data?.forEach(target => {
              targetsByIndicator[target.indicator_id] = target.target_value;
            });

            let totalProgress = 0;
            const stats = createEmptyStats();

            indicators.forEach(indicator => {
              const yearlyTarget = targetsByIndicator[indicator.id] || indicator.target_value;

              if (yearlyTarget) {
                const progress = calculateIndicatorProgress({
                  id: indicator.id,
                  goal_id: goal.id,
                  baseline_value: indicator.baseline_value,
                  target_value: indicator.target_value,
                  yearly_target: yearlyTarget,
                  calculation_method: indicator.calculation_method
                }, entriesData.data || []);

                totalProgress += progress;

                const status = getIndicatorStatus(progress);
                incrementStatusInStats(stats, status);
              }
            });

            const avgProgress = stats.total > 0 ? totalProgress / stats.total : 0;
            let forecast = 'Belirsiz';
            if (avgProgress >= 80) forecast = 'Başarılı';
            else if (avgProgress >= 60) forecast = 'Büyük İhtimalle Başarılı';
            else if (avgProgress >= 40) forecast = 'Risk Altında';
            else forecast = 'Ciddi Risk';

            return {
              id: goal.id,
              code: goal.code,
              title: goal.title,
              objective_title: (goal.objectives as any)?.title || '',
              department_name: (goal.departments as any)?.name || '',
              indicators_count: stats.total,
              avg_progress: avgProgress,
              exceedingTarget: stats.exceedingTarget,
              excellent: stats.excellent,
              good: stats.good,
              moderate: stats.moderate,
              weak: stats.weak,
              veryWeak: stats.veryWeak,
              forecast: forecast,
            };
          })
        );

        setGoals(processedGoals.sort((a, b) => b.avg_progress - a.avg_progress));
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = goals.map(goal => ({
      'Kod': goal.code,
      'Hedef': goal.title,
      'Amaç': goal.objective_title,
      'Birim': goal.department_name,
      'Gösterge Sayısı': goal.indicators_count,
      'Ortalama İlerleme (%)': Math.round(goal.avg_progress),
      'Hedefte': goal.on_track_indicators,
      'Risk Altında': goal.at_risk_indicators,
      'Geride': goal.behind_indicators,
      'Başarı Tahmini': goal.forecast,
    }));

    exportToExcel(exportData, 'Hedef_Basarisi');
  };

  const handlePDFExport = () => {
    generateGoalAchievementPDF(goals);
  };

  const getForecastColor = (forecast: string) => {
    if (forecast === 'Başarılı') return 'text-green-600 bg-green-50 border-green-200';
    if (forecast === 'Büyük İhtimalle Başarılı')
      return 'text-green-600 bg-green-50 border-green-200';
    if (forecast === 'Risk Altında') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (forecast === 'Ciddi Risk') return 'text-red-600 bg-red-50 border-red-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Hedef Başarı Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Hedeflere ulaşma durumu ve başarı tahminleri
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

      {goals.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz hedef bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className={`bg-white border rounded-lg p-6 ${
                goal.avg_progress < 50 ? 'border-red-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {goal.avg_progress < 50 && <AlertTriangle className="w-5 h-5 text-red-500" />}
                    {goal.avg_progress >= 80 && <Target className="w-5 h-5 text-green-500" />}
                    <h3 className="text-lg font-semibold text-slate-900">
                      {goal.code} - {goal.title}
                    </h3>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>Amaç: {goal.objective_title}</p>
                    <p>Birim: {goal.department_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-3xl font-bold ${getProgressTextColor(goal.avg_progress)}`}
                  >
                    {Math.round(goal.avg_progress)}%
                  </div>
                  <div className="text-xs text-slate-500">{goal.indicators_count} gösterge</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getProgressColor(goal.avg_progress)}`}
                    style={{ width: `${Math.min(goal.avg_progress, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-7 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">{goal.exceedingTarget}</div>
                  <div className="text-xs text-slate-600">Hedef Üstü</div>
                </div>
                <div className="bg-green-100 rounded-lg p-3 text-center border border-green-300">
                  <div className="text-2xl font-bold text-green-700">{goal.excellent}</div>
                  <div className="text-xs text-slate-600">Çok İyi</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{goal.good}</div>
                  <div className="text-xs text-slate-600">İyi</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-600">{goal.moderate}</div>
                  <div className="text-xs text-slate-600">Orta</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{goal.weak}</div>
                  <div className="text-xs text-slate-600">Zayıf</div>
                </div>
                <div className="bg-amber-100 rounded-lg p-3 text-center border border-amber-300">
                  <div className="text-2xl font-bold text-amber-800">{goal.veryWeak}</div>
                  <div className="text-xs text-slate-600">Çok Zayıf</div>
                </div>
                <div
                  className={`rounded-lg p-3 text-center border ${getForecastColor(goal.forecast)}`}
                >
                  <div className="text-xs font-medium mb-1">Başarı Tahmini</div>
                  <div className="text-sm font-bold">{goal.forecast}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
