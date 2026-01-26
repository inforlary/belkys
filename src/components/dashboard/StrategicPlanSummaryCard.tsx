import { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DepartmentPerformance {
  department_name: string;
  achievement_rate: number;
  data_entry_rate: number;
}

export default function StrategicPlanSummaryCard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overallAchievement, setOverallAchievement] = useState(0);
  const [dataEntryRate, setDataEntryRate] = useState(0);
  const [departmentPerformances, setDepartmentPerformances] = useState<DepartmentPerformance[]>([]);
  const [activeGoalsCount, setActiveGoalsCount] = useState(0);

  useEffect(() => {
    if (profile?.organization_id) {
      loadSummaryData();
    }
  }, [profile?.organization_id]);

  const loadSummaryData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const currentYear = new Date().getFullYear();

      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      setActiveGoalsCount(goals?.length || 0);

      const { data: indicators } = await supabase
        .from('indicators')
        .select(`
          id,
          goal_id,
          target_value,
          indicator_data_entries!inner(
            actual_value,
            period_year,
            status
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('indicator_data_entries.period_year', currentYear)
        .eq('indicator_data_entries.status', 'approved');

      let totalAchievement = 0;
      let achievementCount = 0;

      if (indicators) {
        indicators.forEach((indicator: any) => {
          const entries = indicator.indicator_data_entries;
          if (entries && entries.length > 0 && indicator.target_value) {
            const totalActual = entries.reduce((sum: number, entry: any) => sum + (entry.actual_value || 0), 0);
            const achievement = (totalActual / indicator.target_value) * 100;
            totalAchievement += Math.min(achievement, 100);
            achievementCount++;
          }
        });
      }

      const avgAchievement = achievementCount > 0 ? totalAchievement / achievementCount : 0;
      setOverallAchievement(avgAchievement);

      const { data: entries, count: totalEntries } = await supabase
        .from('indicator_data_entries')
        .select('id, status', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .eq('period_year', currentYear);

      const approvedCount = entries?.filter(e => e.status === 'approved').length || 0;
      const entryRate = totalEntries ? (approvedCount / totalEntries) * 100 : 0;
      setDataEntryRate(entryRate);

      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      if (departments) {
        const deptPerformances = await Promise.all(
          departments.slice(0, 5).map(async (dept) => {
            const { data: deptIndicators } = await supabase
              .from('indicators')
              .select(`
                id,
                target_value,
                indicator_data_entries!inner(
                  actual_value,
                  period_year,
                  status,
                  department_id
                )
              `)
              .eq('organization_id', profile.organization_id)
              .eq('indicator_data_entries.department_id', dept.id)
              .eq('indicator_data_entries.period_year', currentYear)
              .eq('indicator_data_entries.status', 'approved');

            let deptAchievement = 0;
            let deptCount = 0;

            if (deptIndicators) {
              deptIndicators.forEach((indicator: any) => {
                const entries = indicator.indicator_data_entries;
                if (entries && entries.length > 0 && indicator.target_value) {
                  const totalActual = entries.reduce((sum: number, entry: any) => sum + (entry.actual_value || 0), 0);
                  const achievement = (totalActual / indicator.target_value) * 100;
                  deptAchievement += Math.min(achievement, 100);
                  deptCount++;
                }
              });
            }

            const avgDeptAchievement = deptCount > 0 ? deptAchievement / deptCount : 0;

            const { count: deptTotalEntries } = await supabase
              .from('indicator_data_entries')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', profile.organization_id)
              .eq('department_id', dept.id)
              .eq('period_year', currentYear);

            const { count: deptApprovedEntries } = await supabase
              .from('indicator_data_entries')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', profile.organization_id)
              .eq('department_id', dept.id)
              .eq('period_year', currentYear)
              .eq('status', 'approved');

            const deptEntryRate = deptTotalEntries ? ((deptApprovedEntries || 0) / deptTotalEntries) * 100 : 0;

            return {
              department_name: dept.name,
              achievement_rate: avgDeptAchievement,
              data_entry_rate: deptEntryRate,
            };
          })
        );

        setDepartmentPerformances(deptPerformances);
      }
    } catch (error) {
      console.error('Error loading strategic plan summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBg = (rate: number) => {
    if (rate >= 80) return 'bg-green-50';
    if (rate >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Target className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Stratejik Plan Özeti</h3>
            <p className="text-sm text-slate-500">Genel performans ve veri giriş durumu</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`${getStatusBg(overallAchievement)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Ortalama Başarı</p>
              <p className={`text-2xl font-bold ${getStatusColor(overallAchievement)}`}>
                %{overallAchievement.toFixed(1)}
              </p>
            </div>
            <TrendingUp className={`w-8 h-8 ${getStatusColor(overallAchievement)}`} />
          </div>
        </div>

        <div className={`${getStatusBg(dataEntryRate)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Veri Giriş Oranı</p>
              <p className={`text-2xl font-bold ${getStatusColor(dataEntryRate)}`}>
                %{dataEntryRate.toFixed(1)}
              </p>
            </div>
            <AlertCircle className={`w-8 h-8 ${getStatusColor(dataEntryRate)}`} />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Aktif Hedefler</p>
              <p className="text-2xl font-bold text-blue-600">{activeGoalsCount}</p>
            </div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <Users className="w-4 h-4 mr-2" />
          Müdürlük Performansları
        </h4>
        <div className="space-y-2">
          {departmentPerformances.map((dept, index) => (
            <div key={index} className="flex items-center justify-between py-2 hover:bg-slate-50 rounded px-2">
              <span className="text-sm text-slate-700 font-medium">{dept.department_name}</span>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Başarı</p>
                  <p className={`text-sm font-semibold ${getStatusColor(dept.achievement_rate)}`}>
                    %{dept.achievement_rate.toFixed(1)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Veri Giriş</p>
                  <p className={`text-sm font-semibold ${getStatusColor(dept.data_entry_rate)}`}>
                    %{dept.data_entry_rate.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
