import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Award, AlertTriangle, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/exportHelpers';
import { generateDepartmentPerformancePDF } from '../../utils/reportPDFGenerators';
import { calculateIndicatorProgress } from '../../utils/progressCalculations';

interface DepartmentData {
  id: string;
  name: string;
  goals_count: number;
  indicators_count: number;
  avg_progress: number;
  top_indicator: string;
  bottom_indicator: string;
  rank: number;
}

export default function DepartmentPerformance() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const currentYear = new Date().getFullYear();

      let deptsQuery = supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their own department
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        deptsQuery = deptsQuery.eq('id', profile.department_id);
      }

      const { data: depts } = await deptsQuery.order('name');

      if (depts) {
        const departmentData = await Promise.all(
          depts.map(async (dept) => {
            const { data: goals } = await supabase
              .from('goals')
              .select('id')
              .eq('organization_id', profile.organization_id)
              .eq('department_id', dept.id);

            const goalsCount = goals?.length || 0;

            if (!goals || goals.length === 0) {
              return {
                id: dept.id,
                name: dept.name,
                goals_count: 0,
                indicators_count: 0,
                avg_progress: 0,
                top_indicator: '-',
                bottom_indicator: '-',
                rank: 0,
              };
            }

            const goalIds = goals.map(g => g.id);

            const { data: indicators } = await supabase
              .from('indicators')
              .select('id, name, baseline_value, target_value, calculation_method')
              .eq('organization_id', profile.organization_id)
              .in('goal_id', goalIds);

            if (!indicators || indicators.length === 0) {
              return {
                id: dept.id,
                name: dept.name,
                goals_count: goalsCount,
                indicators_count: 0,
                avg_progress: 0,
                top_indicator: '-',
                bottom_indicator: '-',
                rank: 0,
              };
            }

            const indicatorIds = indicators.map(i => i.id);

            const [entriesData, targetsData] = await Promise.all([
              supabase
                .from('indicator_data_entries')
                .select('indicator_id, value, status')
                .eq('organization_id', profile.organization_id)
                .eq('period_year', currentYear)
                .in('status', ['approved', 'submitted'])
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

            const indicatorProgress: Array<{ id: string; name: string; progress: number }> = [];
            let totalProgress = 0;
            let validCount = 0;

            indicators.forEach(ind => {
              const yearlyTarget = targetsByIndicator[ind.id] || ind.target_value;

              if (yearlyTarget) {
                const progress = calculateIndicatorProgress({
                  id: ind.id,
                  goal_id: '',
                  baseline_value: ind.baseline_value,
                  target_value: ind.target_value,
                  yearly_target: yearlyTarget,
                  calculation_method: ind.calculation_method
                }, entriesData.data || []);

                indicatorProgress.push({ id: ind.id, name: ind.name, progress });
                totalProgress += progress;
                validCount++;
              }
            });

            indicatorProgress.sort((a, b) => b.progress - a.progress);

            return {
              id: dept.id,
              name: dept.name,
              goals_count: goalsCount,
              indicators_count: validCount,
              avg_progress: validCount > 0 ? totalProgress / validCount : 0,
              top_indicator: indicatorProgress[0]?.name || '-',
              bottom_indicator: indicatorProgress[indicatorProgress.length - 1]?.name || '-',
              rank: 0,
            };
          })
        );

        const sorted = departmentData
          .filter(d => d.indicators_count > 0)
          .sort((a, b) => b.avg_progress - a.avg_progress);

        sorted.forEach((dept, idx) => {
          dept.rank = idx + 1;
        });

        const remaining = departmentData.filter(d => d.indicators_count === 0);

        setDepartments([...sorted, ...remaining]);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = departments.map(dept => ({
      'Sıra': dept.rank || '-',
      'Birim': dept.name,
      'Hedef Sayısı': dept.goals_count,
      'Gösterge Sayısı': dept.indicators_count,
      'Ortalama İlerleme (%)': Math.round(dept.avg_progress),
      'En İyi Gösterge': dept.top_indicator,
      'En Düşük Gösterge': dept.bottom_indicator,
    }));

    exportToExcel(exportData, 'Birim_Performansi');
  };

  const handlePDFExport = () => {
    generateDepartmentPerformancePDF(departments);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Birim Performans Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Birimler arası karşılaştırmalı performans analizi
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

      {departments.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz veri bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className={`bg-white border rounded-lg p-6 ${
                dept.rank === 1
                  ? 'border-yellow-400 bg-yellow-50'
                  : dept.rank > 0 && dept.avg_progress < 50
                  ? 'border-red-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {dept.rank === 1 && <Award className="w-5 h-5 text-yellow-500" />}
                    {dept.rank > 0 && dept.avg_progress < 50 && (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                    <h3 className="text-lg font-semibold text-slate-900">
                      {dept.rank > 0 && `#${dept.rank} - `}
                      {dept.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                    <span>{dept.goals_count} hedef</span>
                    <span>•</span>
                    <span>{dept.indicators_count} gösterge</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-3xl font-bold ${
                      dept.avg_progress >= 70
                        ? 'text-green-600'
                        : dept.avg_progress >= 50
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {Math.round(dept.avg_progress)}%
                  </div>
                  <div className="text-xs text-slate-500">Ortalama İlerleme</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      dept.avg_progress >= 70
                        ? 'bg-green-500'
                        : dept.avg_progress >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(dept.avg_progress, 100)}%` }}
                  />
                </div>
              </div>

              {dept.indicators_count > 0 && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-slate-600 mb-1">En İyi Performans</div>
                    <div className="font-medium text-slate-900 truncate">{dept.top_indicator}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-xs text-slate-600 mb-1">Geliştirilmesi Gereken</div>
                    <div className="font-medium text-slate-900 truncate">{dept.bottom_indicator}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
