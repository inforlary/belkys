import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Filter, Download, BarChart3, TrendingUp } from 'lucide-react';
import { exportToExcel } from '../utils/exportHelpers';

interface Indicator {
  id: string;
  code: string;
  name: string;
  unit: string;
  calculation_method: string;
  goal_id: string;
  goal_title?: string;
  goal_code?: string;
  objective_title?: string;
}

interface QuarterData {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  total: number | null;
}

interface IndicatorComparison {
  indicator: Indicator;
  years: {
    [year: number]: {
      target: number | null;
      quarters: QuarterData;
      achievement: number | null;
    };
  };
}

interface GoalYearComparison {
  goal_code: string;
  goal_title: string;
  objective_title: string;
  indicators: {
    code: string;
    name: string;
    unit: string;
    years: {
      [year: number]: {
        target: number | null;
        actual: number | null;
        achievement: number | null;
      };
    };
  }[];
}

export default function PerformanceMonitoring() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [comparisonType, setComparisonType] = useState<'indicator-quarters' | 'goal-years'>('indicator-quarters');

  const [objectives, setObjectives] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [comparisonYear, setComparisonYear] = useState<number>(currentYear - 1);
  const [availableYears] = useState<number[]>([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]);

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicatorComparisons, setIndicatorComparisons] = useState<IndicatorComparison[]>([]);
  const [goalComparisons, setGoalComparisons] = useState<GoalYearComparison[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadInitialData();
  }, [profile]);

  useEffect(() => {
    if (profile && comparisonType) loadComparisonData();
  }, [profile, comparisonType, selectedObjective, selectedGoal, selectedIndicator, selectedYear, comparisonYear]);

  const loadInitialData = async () => {
    if (!profile) return;

    try {
      const [objectivesRes, goalsRes] = await Promise.all([
        supabase
          .from('objectives')
          .select('id, code, title')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        supabase
          .from('goals')
          .select('id, code, title, objective_id')
          .eq('organization_id', profile.organization_id)
          .order('code')
      ]);

      if (objectivesRes.error) throw objectivesRes.error;
      if (goalsRes.error) throw goalsRes.error;

      setObjectives(objectivesRes.data || []);
      setGoals(goalsRes.data || []);

      const indicatorsRes = await supabase
        .from('indicators')
        .select('id, code, name, unit, calculation_method, goal_id')
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (indicatorsRes.error) throw indicatorsRes.error;

      const enrichedIndicators = (indicatorsRes.data || []).map(ind => {
        const goal = goalsRes.data?.find(g => g.id === ind.goal_id);
        const objective = objectivesRes.data?.find(o => o.id === goal?.objective_id);
        return {
          ...ind,
          goal_title: goal?.title,
          goal_code: goal?.code,
          objective_title: objective?.title
        };
      });

      setIndicators(enrichedIndicators);
    } catch (error: any) {
      console.error('Error loading initial data:', error.message);
    }
  };

  const loadComparisonData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      if (comparisonType === 'indicator-quarters') {
        await loadIndicatorQuarterComparison();
      } else {
        await loadGoalYearComparison();
      }
    } catch (error: any) {
      console.error('Error loading comparison:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadIndicatorQuarterComparison = async () => {
    if (!profile) return;

    let filteredIndicators = indicators;

    if (selectedObjective) {
      const objectiveGoals = goals.filter(g => g.objective_id === selectedObjective);
      const goalIds = objectiveGoals.map(g => g.id);
      filteredIndicators = indicators.filter(ind => goalIds.includes(ind.goal_id));
    }

    if (selectedGoal) {
      filteredIndicators = indicators.filter(ind => ind.goal_id === selectedGoal);
    }

    if (selectedIndicator) {
      filteredIndicators = indicators.filter(ind => ind.id === selectedIndicator);
    }

    const years = [selectedYear, comparisonYear];

    const [targetsRes, entriesRes] = await Promise.all([
      supabase
        .from('indicator_targets')
        .select('*')
        .in('year', years),
      supabase
        .from('indicator_data_entries')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .in('period_year', years)
    ]);

    if (targetsRes.error) throw targetsRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const comparisons: IndicatorComparison[] = filteredIndicators.map(indicator => {
      const yearData: any = {};

      years.forEach(year => {
        const target = (targetsRes.data || []).find(
          t => t.indicator_id === indicator.id && t.year === year
        );

        const yearEntries = (entriesRes.data || []).filter(
          e => e.indicator_id === indicator.id && e.period_year === year
        );

        const quarters: QuarterData = { q1: null, q2: null, q3: null, q4: null, total: null };

        [1, 2, 3, 4].forEach(q => {
          const entry = yearEntries.find(e => e.period_quarter === q);
          quarters[`q${q}` as keyof QuarterData] = entry?.value ?? null;
        });

        const values = Object.values(quarters).filter((v): v is number => v !== null && v !== 'total');

        if (values.length > 0) {
          if (indicator.calculation_method === 'cumulative') {
            quarters.total = values.reduce((sum, val) => sum + val, 0);
          } else {
            quarters.total = values.reduce((sum, val) => sum + val, 0) / values.length;
          }
        }

        const achievement = target?.target_value && quarters.total
          ? ((quarters.total / target.target_value) * 100)
          : null;

        yearData[year] = {
          target: target?.target_value ?? null,
          quarters,
          achievement
        };
      });

      return {
        indicator,
        years: yearData
      };
    });

    setIndicatorComparisons(comparisons);
  };

  const loadGoalYearComparison = async () => {
    if (!profile) return;

    let filteredGoals = goals;

    if (selectedObjective) {
      filteredGoals = goals.filter(g => g.objective_id === selectedObjective);
    }

    if (selectedGoal) {
      filteredGoals = goals.filter(g => g.id === selectedGoal);
    }

    const years = [selectedYear, comparisonYear];

    const [targetsRes, entriesRes] = await Promise.all([
      supabase
        .from('indicator_targets')
        .select('*')
        .in('year', years),
      supabase
        .from('indicator_data_entries')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .in('period_year', years)
    ]);

    if (targetsRes.error) throw targetsRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const comparisons: GoalYearComparison[] = filteredGoals.map(goal => {
      const objective = objectives.find(o => o.id === goal.objective_id);
      const goalIndicators = indicators.filter(ind => ind.goal_id === goal.id);

      const indicatorData = goalIndicators.map(indicator => {
        const yearData: any = {};

        years.forEach(year => {
          const target = (targetsRes.data || []).find(
            t => t.indicator_id === indicator.id && t.year === year
          );

          const yearEntries = (entriesRes.data || []).filter(
            e => e.indicator_id === indicator.id && e.period_year === year
          );

          const values = yearEntries.map(e => e.value).filter((v): v is number => v !== null);
          let actual: number | null = null;

          if (values.length > 0) {
            if (indicator.calculation_method === 'cumulative') {
              actual = values.reduce((sum, val) => sum + val, 0);
            } else {
              actual = values.reduce((sum, val) => sum + val, 0) / values.length;
            }
          }

          const achievement = target?.target_value && actual
            ? ((actual / target.target_value) * 100)
            : null;

          yearData[year] = {
            target: target?.target_value ?? null,
            actual,
            achievement
          };
        });

        return {
          code: indicator.code,
          name: indicator.name,
          unit: indicator.unit,
          years: yearData
        };
      });

      return {
        goal_code: goal.code,
        goal_title: goal.title,
        objective_title: objective?.title || '',
        indicators: indicatorData
      };
    });

    setGoalComparisons(comparisons);
  };

  const handleExportToExcel = () => {
    let exportData: any[] = [];

    if (comparisonType === 'indicator-quarters') {
      exportData = indicatorComparisons.flatMap(comp =>
        [selectedYear, comparisonYear].map(year => {
          const yearData = comp.years[year];
          return {
            'Gösterge Kodu': comp.indicator.code,
            'Gösterge Adı': comp.indicator.name,
            'Amaç': comp.indicator.goal_code,
            'Birim': comp.indicator.unit,
            'Yıl': year,
            'Hedef': yearData?.target ?? '-',
            'Ç1': yearData?.quarters.q1 ?? '-',
            'Ç2': yearData?.quarters.q2 ?? '-',
            'Ç3': yearData?.quarters.q3 ?? '-',
            'Ç4': yearData?.quarters.q4 ?? '-',
            'Toplam/Ortalama': yearData?.quarters.total?.toFixed(2) ?? '-',
            'Başarı (%)': yearData?.achievement?.toFixed(1) ?? '-'
          };
        })
      );
    } else {
      exportData = goalComparisons.flatMap(goal =>
        goal.indicators.flatMap(ind =>
          [selectedYear, comparisonYear].map(year => {
            const yearData = ind.years[year];
            return {
              'Hedef Kodu': goal.goal_code,
              'Hedef': goal.goal_title,
              'Amaç': goal.objective_title,
              'Gösterge Kodu': ind.code,
              'Gösterge': ind.name,
              'Birim': ind.unit,
              'Yıl': year,
              'Hedef Değeri': yearData?.target ?? '-',
              'Gerçekleşen': yearData?.actual?.toFixed(2) ?? '-',
              'Başarı (%)': yearData?.achievement?.toFixed(1) ?? '-'
            };
          })
        )
      );
    }

    exportToExcel(exportData, `performans_karsilastirma_${comparisonType}_${Date.now()}`);
  };

  const filteredGoalsForSelect = selectedObjective
    ? goals.filter(g => g.objective_id === selectedObjective)
    : goals;

  const filteredIndicatorsForSelect = selectedGoal
    ? indicators.filter(ind => ind.goal_id === selectedGoal)
    : selectedObjective
    ? indicators.filter(ind => {
        const goal = goals.find(g => g.id === ind.goal_id);
        return goal?.objective_id === selectedObjective;
      })
    : indicators;

  if (loading && (indicatorComparisons.length === 0 && goalComparisons.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Performans Karşılaştırma</h1>
        <Button variant="outline" size="sm" onClick={handleExportToExcel}>
          <Download className="w-4 h-4 mr-2" />
          Excel İndir
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filtreler</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Karşılaştırma Türü
              </label>
              <select
                value={comparisonType}
                onChange={(e) => setComparisonType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="indicator-quarters">Gösterge - Çeyrekler Arası</option>
                <option value="goal-years">Hedef - Yıllar Arası</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birinci Yıl
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İkinci Yıl
              </label>
              <select
                value={comparisonYear}
                onChange={(e) => setComparisonYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amaç
              </label>
              <select
                value={selectedObjective}
                onChange={(e) => {
                  setSelectedObjective(e.target.value);
                  setSelectedGoal('');
                  setSelectedIndicator('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tümü</option>
                {objectives.map(obj => (
                  <option key={obj.id} value={obj.id}>
                    {obj.code} - {obj.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hedef
              </label>
              <select
                value={selectedGoal}
                onChange={(e) => {
                  setSelectedGoal(e.target.value);
                  setSelectedIndicator('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tümü</option>
                {filteredGoalsForSelect.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.code} - {goal.title}
                  </option>
                ))}
              </select>
            </div>

            {comparisonType === 'indicator-quarters' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gösterge
                </label>
                <select
                  value={selectedIndicator}
                  onChange={(e) => setSelectedIndicator(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tümü</option>
                  {filteredIndicatorsForSelect.map(ind => (
                    <option key={ind.id} value={ind.id}>
                      {ind.code} - {ind.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {comparisonType === 'indicator-quarters' && (
        <div className="space-y-4">
          {indicatorComparisons.map(comp => (
            <Card key={comp.indicator.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {comp.indicator.code} - {comp.indicator.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {comp.indicator.objective_title} / {comp.indicator.goal_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Yıl
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Hedef
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Ç1
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Ç2
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Ç3
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Ç4
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Toplam/Ort.
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Başarı %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[selectedYear, comparisonYear].map(year => {
                        const yearData = comp.years[year];
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {year}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-900">
                              {yearData?.target ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-900">
                              {yearData?.quarters.q1 ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-900">
                              {yearData?.quarters.q2 ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-900">
                              {yearData?.quarters.q3 ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-900">
                              {yearData?.quarters.q4 ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">
                              {yearData?.quarters.total?.toFixed(2) ?? '-'} {comp.indicator.unit}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {yearData?.achievement ? (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  yearData.achievement >= 100
                                    ? 'bg-green-100 text-green-800'
                                    : yearData.achievement >= 75
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  %{yearData.achievement.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ))}

          {indicatorComparisons.length === 0 && (
            <Card>
              <CardBody>
                <div className="text-center py-12 text-gray-500">
                  Karşılaştırma için veri bulunamadı
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {comparisonType === 'goal-years' && (
        <div className="space-y-4">
          {goalComparisons.map(goal => (
            <Card key={goal.goal_code}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {goal.goal_code} - {goal.goal_title}
                    </h3>
                    <p className="text-sm text-gray-600">{goal.objective_title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Gösterge
                        </th>
                        <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Birim
                        </th>
                        {[selectedYear, comparisonYear].map(year => (
                          <th key={year} colSpan={3} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-l">
                            {year}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {[selectedYear, comparisonYear].map(year => (
                          <>
                            <th key={`${year}-target`} className="px-2 py-2 text-center text-xs font-medium text-gray-400 border-l">
                              Hedef
                            </th>
                            <th key={`${year}-actual`} className="px-2 py-2 text-center text-xs font-medium text-gray-400">
                              Gerçekleşen
                            </th>
                            <th key={`${year}-achievement`} className="px-2 py-2 text-center text-xs font-medium text-gray-400">
                              Başarı %
                            </th>
                          </>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {goal.indicators.map(ind => (
                        <tr key={ind.code} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{ind.code}</div>
                            <div className="text-xs text-gray-500">{ind.name}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {ind.unit}
                          </td>
                          {[selectedYear, comparisonYear].map(year => {
                            const yearData = ind.years[year];
                            return (
                              <>
                                <td key={`${year}-target`} className="px-2 py-3 text-sm text-center text-gray-900 border-l">
                                  {yearData?.target ?? '-'}
                                </td>
                                <td key={`${year}-actual`} className="px-2 py-3 text-sm text-center font-medium text-gray-900">
                                  {yearData?.actual?.toFixed(2) ?? '-'}
                                </td>
                                <td key={`${year}-achievement`} className="px-2 py-3 text-center">
                                  {yearData?.achievement ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      yearData.achievement >= 100
                                        ? 'bg-green-100 text-green-800'
                                        : yearData.achievement >= 75
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      %{yearData.achievement.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-400">-</span>
                                  )}
                                </td>
                              </>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {goal.indicators.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Bu amaç için gösterge bulunamadı
                  </div>
                )}
              </CardBody>
            </Card>
          ))}

          {goalComparisons.length === 0 && (
            <Card>
              <CardBody>
                <div className="text-center py-12 text-gray-500">
                  Karşılaştırma için veri bulunamadı
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
