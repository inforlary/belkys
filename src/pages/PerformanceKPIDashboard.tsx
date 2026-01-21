import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import { TrendingUp, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { calculateIndicatorProgress } from '../utils/progressCalculations';
import { getIndicatorStatus, getStatusConfig, type IndicatorStatus } from '../utils/indicatorStatus';

interface Department {
  id: string;
  name: string;
}

interface Goal {
  id: string;
  code: string;
  title: string;
  department_id: string;
}

interface IndicatorData {
  id: string;
  code: string;
  name: string;
  unit: string;
  target_value: number | null;
  baseline_value: number | null;
  calculation_method: string;
  goal_id: string;
  goals?: {
    id: string;
    code: string;
    title: string;
    department_id: string;
    departments?: Department;
  };
  latest_value?: number;
  achievement_rate?: number;
}

interface GroupedData {
  goal: Goal;
  department?: Department;
  exceedingTarget: IndicatorData[];
  excellent: IndicatorData[];
  good: IndicatorData[];
  moderate: IndicatorData[];
  weak: IndicatorData[];
  veryWeak: IndicatorData[];
  avgProgress: number;
}

export default function PerformanceKPIDashboard() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const currentYear = new Date().getFullYear();

      let goalIds: string[] = [];
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        const allGoals = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile.organization_id);
        goalIds = allGoals.data?.map(g => g.id) || [];
      } else if (profile.department_id) {
        const goalsForDept = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('department_id', profile.department_id);
        goalIds = goalsForDept.data?.map(g => g.id) || [];
      }

      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          id,
          code,
          name,
          unit,
          target_value,
          baseline_value,
          calculation_method,
          goal_id,
          goals!goal_id (
            id,
            code,
            title,
            department_id,
            departments!department_id (id, name)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (goalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', goalIds);
      }

      const { data: indicatorsData, error: indicatorsError } = await indicatorsQuery;

      if (indicatorsError) {
        console.error('Göstergeler yüklenirken hata:', indicatorsError);
        setLoading(false);
        return;
      }

      const dataEntriesQuery = supabase
        .from('indicator_data_entries')
        .select('indicator_id, actual_value, year, period_type, period')
        .eq('year', currentYear)
        .eq('status', 'admin_approved');

      const { data: dataEntries } = await dataEntriesQuery;

      const indicatorsWithProgress = (indicatorsData || []).map(indicator => {
        const entries = (dataEntries || []).filter(e => e.indicator_id === indicator.id);

        let latestValue = 0;
        if (entries.length > 0) {
          const periodicalEntries = entries.filter(e => e.period_type === 'quarterly' || e.period_type === 'monthly');
          if (periodicalEntries.length > 0) {
            periodicalEntries.sort((a, b) => {
              if (a.period_type === b.period_type) {
                return (b.period || 0) - (a.period || 0);
              }
              return a.period_type === 'quarterly' ? -1 : 1;
            });
            latestValue = periodicalEntries[0].actual_value || 0;
          } else {
            const annualEntry = entries.find(e => e.period_type === 'annual');
            latestValue = annualEntry?.actual_value || 0;
          }
        }

        const progressData = calculateIndicatorProgress({
          latest_value: latestValue,
          target_value: indicator.target_value,
          baseline_value: indicator.baseline_value,
          calculation_method: indicator.calculation_method as any
        });

        return {
          ...indicator,
          latest_value: latestValue,
          achievement_rate: progressData.achievement_rate
        };
      });

      setIndicators(indicatorsWithProgress);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGroupedByGoal = (): GroupedData[] => {
    const grouped: { [key: string]: GroupedData } = {};

    indicators.forEach(indicator => {
      const goalId = indicator.goal_id;
      if (!indicator.goals) return;

      if (!grouped[goalId]) {
        grouped[goalId] = {
          goal: {
            id: indicator.goals.id,
            code: indicator.goals.code,
            title: indicator.goals.title,
            department_id: indicator.goals.department_id
          },
          department: indicator.goals.departments,
          exceedingTarget: [],
          excellent: [],
          good: [],
          moderate: [],
          weak: [],
          veryWeak: [],
          avgProgress: 0
        };
      }

      const achievementRate = indicator.achievement_rate || 0;
      const status = getIndicatorStatus(achievementRate);

      switch (status) {
        case 'exceeding_target':
          grouped[goalId].exceedingTarget.push(indicator);
          break;
        case 'excellent':
          grouped[goalId].excellent.push(indicator);
          break;
        case 'good':
          grouped[goalId].good.push(indicator);
          break;
        case 'moderate':
          grouped[goalId].moderate.push(indicator);
          break;
        case 'weak':
          grouped[goalId].weak.push(indicator);
          break;
        case 'very_weak':
          grouped[goalId].veryWeak.push(indicator);
          break;
      }
    });

    const result = Object.values(grouped);

    result.forEach(group => {
      const allIndicators = [
        ...group.exceedingTarget,
        ...group.excellent,
        ...group.good,
        ...group.moderate,
        ...group.weak,
        ...group.veryWeak
      ];
      const sum = allIndicators.reduce((acc, i) => acc + (i.achievement_rate || 0), 0);
      group.avgProgress = allIndicators.length > 0 ? sum / allIndicators.length : 0;
    });

    return result.sort((a, b) => b.avgProgress - a.avgProgress);
  };

  const groupedByGoal = getGroupedByGoal();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Performans Göstergeleri</h1>
        <p className="text-gray-600">Hedefe göre gösterge performansı</p>
      </div>

      {/* ÖZET İSTATİSTİKLER */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <Card>
          <CardBody className="p-3">
            <div className="text-xs text-gray-600 mb-1">Toplam</div>
            <div className="text-xl font-bold text-gray-900">{indicators.length}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-3 bg-purple-50">
            <div className="text-xs text-purple-700 mb-1">Hedef Üstü</div>
            <div className="text-xl font-bold text-purple-600">
              {indicators.filter(i => getIndicatorStatus(i.achievement_rate || 0) === 'exceeding_target').length}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-3 bg-green-100">
            <div className="text-xs text-green-800 mb-1">Çok İyi</div>
            <div className="text-xl font-bold text-green-700">
              {indicators.filter(i => getIndicatorStatus(i.achievement_rate || 0) === 'excellent').length}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-3 bg-green-50">
            <div className="text-xs text-green-700 mb-1">İyi</div>
            <div className="text-xl font-bold text-green-600">
              {indicators.filter(i => getIndicatorStatus(i.achievement_rate || 0) === 'good').length}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-3 bg-yellow-50">
            <div className="text-xs text-yellow-700 mb-1">Orta</div>
            <div className="text-xl font-bold text-yellow-600">
              {indicators.filter(i => getIndicatorStatus(i.achievement_rate || 0) === 'moderate').length}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-3 bg-red-50">
            <div className="text-xs text-red-700 mb-1">Zayıf</div>
            <div className="text-xl font-bold text-red-600">
              {indicators.filter(i => getIndicatorStatus(i.achievement_rate || 0) === 'weak').length}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-3 bg-amber-100">
            <div className="text-xs text-amber-900 mb-1">Çok Zayıf</div>
            <div className="text-xl font-bold text-amber-800">
              {indicators.filter(i => getIndicatorStatus(i.achievement_rate || 0) === 'very_weak').length}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* HEDEF KARTLARI */}
      <div className="space-y-6">
        {groupedByGoal.map((group, index) => {
          const totalCount = group.exceedingTarget.length + group.excellent.length + group.good.length +
                            group.moderate.length + group.weak.length + group.veryWeak.length;

          return (
            <Card key={group.goal.id} className="overflow-hidden">
              <CardBody className="p-0">
                {/* BAŞLIK */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{index + 1}</span>
                        <h2 className="text-lg font-bold text-gray-900">
                          {group.goal.code} - {group.goal.title}
                        </h2>
                      </div>
                      <div className="text-sm text-gray-600">
                        {totalCount} gösterge
                        {group.department && ` • ${group.department.name}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-700">
                        {Math.round(group.avgProgress)}%
                      </div>
                      <div className="text-xs text-gray-600">Ortalama İlerleme</div>
                    </div>
                  </div>

                  <div className="mt-4 w-full bg-gray-300 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                      style={{ width: `${Math.min(group.avgProgress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* İÇERİK */}
                <div className="p-4">
                  {/* ÖZET */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                      <span className="text-xs font-semibold text-purple-700 block mb-1">Hedef Üstü</span>
                      <div className="text-lg font-bold text-purple-600">{group.exceedingTarget.length}</div>
                    </div>

                    <div className="bg-green-100 border border-green-300 rounded-lg p-2">
                      <span className="text-xs font-semibold text-green-800 block mb-1">Çok İyi</span>
                      <div className="text-lg font-bold text-green-700">{group.excellent.length}</div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <span className="text-xs font-semibold text-green-700 block mb-1">İyi</span>
                      <div className="text-lg font-bold text-green-600">{group.good.length}</div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      <span className="text-xs font-semibold text-yellow-700 block mb-1">Orta</span>
                      <div className="text-lg font-bold text-yellow-600">{group.moderate.length}</div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                      <span className="text-xs font-semibold text-red-700 block mb-1">Zayıf</span>
                      <div className="text-lg font-bold text-red-600">{group.weak.length}</div>
                    </div>

                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-2">
                      <span className="text-xs font-semibold text-amber-900 block mb-1">Çok Zayıf</span>
                      <div className="text-lg font-bold text-amber-800">{group.veryWeak.length}</div>
                    </div>
                  </div>

                  {/* Sadece 0'dan büyük kategorileri göster */}
                  {[
                    { key: 'exceedingTarget', label: 'Hedef Üstü', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700' },
                    { key: 'excellent', label: 'Çok İyi', bgColor: 'bg-green-100', borderColor: 'border-green-300', textColor: 'text-green-800' },
                    { key: 'good', label: 'İyi', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700' },
                    { key: 'moderate', label: 'Orta', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-700' },
                    { key: 'weak', label: 'Zayıf', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700' },
                    { key: 'veryWeak', label: 'Çok Zayıf', bgColor: 'bg-amber-100', borderColor: 'border-amber-300', textColor: 'text-amber-900' }
                  ].map(category => {
                    const indicators = group[category.key as keyof GroupedData] as IndicatorData[];
                    if (!indicators || indicators.length === 0) return null;

                    return (
                      <div key={category.key} className="mb-6">
                        <h3 className={`text-sm font-semibold ${category.textColor} mb-3`}>
                          {category.label} Göstergeler ({indicators.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {indicators.map(indicator => (
                            <div key={indicator.id} className={`${category.bgColor} ${category.borderColor} border rounded-lg p-4`}>
                              <div className={`text-xs font-semibold ${category.textColor} mb-1`}>{indicator.code}</div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">{indicator.name}</h4>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Başarı Oranı:</span>
                                  <span className={`font-bold ${category.textColor}`}>
                                    %{(indicator.achievement_rate || 0).toFixed(1)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Hedef:</span>
                                  <span className="font-medium">
                                    {indicator.target_value?.toLocaleString('tr-TR') || '0'} {indicator.unit}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Gerçekleşen:</span>
                                  <span className="font-medium">
                                    {indicator.latest_value?.toLocaleString('tr-TR') || '0'} {indicator.unit}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {groupedByGoal.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Henüz gösterge verisi bulunmuyor.
        </div>
      )}
    </div>
  );
}
