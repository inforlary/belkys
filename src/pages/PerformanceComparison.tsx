import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Eye,
  Grid3x3,
} from 'lucide-react';
import { exportToExcel } from '../utils/exportHelpers';
import { calculateIndicatorProgress } from '../utils/progressCalculations';

interface YearData {
  baseline: number | null;
  target: number | null;
  actual: number | null;
  achievement: number | null;
}

interface IndicatorData {
  code: string;
  name: string;
  unit: string;
  department: string;
  years: Record<number, YearData>;
}

export default function PerformanceComparison() {
  const { profile } = useAuth();
  const [data, setData] = useState<IndicatorData[]>([]);
  const [filteredData, setFilteredData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<Record<number, boolean>>({});
  const [selectedGoal, setSelectedGoal] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [goals, setGoals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Map<string, string>>(new Map());

  const activeYears = Object.entries(selectedYears)
    .filter(([_, checked]) => checked)
    .map(([year, _]) => parseInt(year))
    .sort((a, b) => a - b);

  useEffect(() => {
    if (profile) {
      loadAvailableYears();
    }
  }, [profile]);

  useEffect(() => {
    if (profile && activeYears.length > 0) {
      loadData();
    }
  }, [profile, selectedYears]);

  useEffect(() => {
    filterData();
  }, [data, selectedGoal]);

  const loadAvailableYears = async () => {
    if (!profile) return;

    try {
      const { data: targets, error } = await supabase
        .from('indicator_targets')
        .select('year')
        .order('year');

      if (error) throw error;

      const years = Array.from(new Set((targets || []).map(t => t.year))).sort();
      setAvailableYears(years);

      const defaultYears: Record<number, boolean> = {};
      const currentYear = new Date().getFullYear();
      years.forEach(year => {
        defaultYears[year] = year === currentYear || year === currentYear - 1;
      });
      setSelectedYears(defaultYears);
    } catch (error: any) {
      console.error('Error loading years:', error.message);
    }
  };

  const loadData = async () => {
    if (!profile || activeYears.length === 0) {
      setData([]);
      setFilteredData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [goalsRes, deptRes, indicatorsRes, targetsRes, entriesRes] = await Promise.all([
        supabase
          .from('goals')
          .select('id, code, title, department_id')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicators')
          .select('id, code, name, unit, goal_id, calculation_method, baseline_value')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        supabase
          .from('indicator_targets')
          .select('*')
          .in('year', activeYears),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, period_year, period_quarter, value, status')
          .eq('organization_id', profile.organization_id)
          .in('period_year', activeYears)
          .in('status', ['approved', 'submitted'])
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (deptRes.error) throw deptRes.error;
      if (indicatorsRes.error) throw indicatorsRes.error;
      if (targetsRes.error) throw targetsRes.error;
      if (entriesRes.error) throw entriesRes.error;

      setGoals(goalsRes.data || []);

      const deptMap = new Map();
      (deptRes.data || []).forEach(dept => {
        deptMap.set(dept.id, dept.name);
      });
      setDepartments(deptMap);

      const goalMap = new Map();
      (goalsRes.data || []).forEach(goal => {
        goalMap.set(goal.id, goal);
      });

      const comparisonData: IndicatorData[] = (indicatorsRes.data || []).map(indicator => {
        const goal = goalMap.get(indicator.goal_id);
        const deptId = goal?.department_id;
        const deptName = deptId ? deptMap.get(deptId) || '-' : '-';

        const years: Record<number, YearData> = {};

        activeYears.forEach(year => {
          const target = (targetsRes.data || []).find(
            t => t.indicator_id === indicator.id && t.year === year
          );

          const entries = (entriesRes.data || []).filter(
            e => e.indicator_id === indicator.id && e.period_year === year
          );

          const dataEntriesForCalc = entries.map(e => ({
            indicator_id: indicator.id,
            value: e.value || 0,
            status: e.status
          }));

          const sumOfEntries = entries.reduce((sum, e) => sum + (e.value || 0), 0);
          const baselineValue = target?.baseline_value ?? indicator.baseline_value ?? 0;
          const calculationMethod = indicator.calculation_method || 'cumulative';

          let actual: number | null = null;
          if (entries.length > 0) {
            switch (calculationMethod) {
              case 'cumulative':
              case 'increasing':
                actual = baselineValue + sumOfEntries;
                break;
              case 'cumulative_decreasing':
              case 'decreasing':
                actual = baselineValue - sumOfEntries;
                break;
              case 'maintenance':
              case 'percentage':
                actual = sumOfEntries;
                break;
              default:
                actual = baselineValue + sumOfEntries;
                break;
            }
          }

          const indicatorForCalc = {
            id: indicator.id,
            goal_id: indicator.goal_id,
            yearly_target: target?.target_value ?? null,
            target_value: target?.target_value ?? null,
            baseline_value: baselineValue,
            calculation_method: calculationMethod
          };

          const achievement = calculateIndicatorProgress(indicatorForCalc, dataEntriesForCalc);

          years[year] = {
            baseline: baselineValue,
            target: target?.target_value ?? null,
            actual,
            achievement,
          };
        });

        return {
          code: indicator.code,
          name: indicator.name,
          unit: indicator.unit,
          department: deptName,
          years,
        };
      });

      setData(comparisonData);
      setFilteredData(comparisonData);
    } catch (error: any) {
      console.error('Error loading data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    if (selectedGoal === 'all') {
      setFilteredData(data);
    } else {
      setFilteredData(data);
    }
  };

  const handleExportToExcel = () => {
    const exportData = filteredData.map(item => {
      const row: any = {
        'Gösterge Kodu': item.code,
        'Gösterge Adı': item.name,
        'Birim': item.unit,
        'Departman': item.department,
      };

      activeYears.forEach(year => {
        const yearData = item.years[year];
        row[`Başlangıç ${year}`] = yearData?.baseline ?? '-';
        row[`Hedef ${year}`] = yearData?.target ?? '-';
        row[`Gerçekleşen ${year}`] = yearData?.actual ?? '-';
        row[`Gerçekleşme % ${year}`] = yearData?.achievement ? `${yearData.achievement.toFixed(1)}%` : '-';
      });

      return row;
    });

    exportToExcel(exportData, `Performans_Karsilastirma_${new Date().toISOString().split('T')[0]}`);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const toggleYear = (year: number) => {
    setSelectedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  const getTrendIcon = (current: number | null, previous: number | null) => {
    if (!current || !previous) return <Minus className="w-4 h-4 text-gray-400" />;
    if (current > previous) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performans Karşılaştırma</h1>
          <p className="text-sm text-gray-600 mt-1">Gösterge performanslarını yıllar arası karşılaştırın</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {viewMode === 'table' ? <Grid3x3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Karşılaştırılacak Yılları Seçin
            </label>
            <div className="flex flex-wrap gap-3">
              {availableYears.map(year => (
                <label
                  key={year}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedYears[year] || false}
                    onChange={() => toggleYear(year)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{year}</span>
                </label>
              ))}
            </div>
          </div>

          {activeYears.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Lütfen en az bir yıl seçin
            </div>
          )}
        </div>
      </div>

      {activeYears.length > 0 && filteredData.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Seçilen kriterlere uygun gösterge bulunamadı</p>
        </div>
      )}

      {activeYears.length > 0 && viewMode === 'table' && filteredData.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gösterge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Birim
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departman
                  </th>
                  {activeYears.map(year => (
                    <th
                      key={year}
                      colSpan={4}
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200"
                    >
                      {year}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50"></th>
                  <th className="bg-gray-50"></th>
                  <th className="bg-gray-50"></th>
                  {activeYears.map(year => (
                    <React.Fragment key={year}>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50 border-l border-gray-200">
                        Başlangıç
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50">
                        Hedef
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50">
                        Gerçekleşen
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50">
                        %
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.code}</div>
                      <div className="text-sm text-gray-500">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.department}
                    </td>
                    {activeYears.map(year => {
                      const yearData = item.years[year];
                      return (
                        <React.Fragment key={year}>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-l border-gray-200">
                            {formatNumber(yearData?.baseline)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(yearData?.target)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatNumber(yearData?.actual)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {yearData?.achievement ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  yearData.achievement >= 100
                                    ? 'bg-green-100 text-green-800'
                                    : yearData.achievement >= 75
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {yearData.achievement.toFixed(1)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeYears.length > 0 && viewMode === 'cards' && filteredData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredData.map((item, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-500">{item.code}</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{item.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {item.unit} • {item.department}
                </div>
              </div>

              <div className="space-y-4">
                {activeYears.map((year, yearIdx) => {
                  const yearData = item.years[year];
                  const prevYear = activeYears[yearIdx - 1];
                  const prevYearData = prevYear ? item.years[prevYear] : null;

                  return (
                    <div key={year} className="border-t pt-4 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{year}</span>
                        {prevYearData && getTrendIcon(yearData?.actual, prevYearData?.actual)}
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Başlangıç</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">
                            {formatNumber(yearData?.baseline)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Hedef</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">
                            {formatNumber(yearData?.target)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Gerçekleşen</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">
                            {formatNumber(yearData?.actual)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Gerçekleşme</div>
                          <div className="text-sm font-medium mt-1">
                            {yearData?.achievement ? (
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs ${
                                  yearData.achievement >= 100
                                    ? 'bg-green-100 text-green-800'
                                    : yearData.achievement >= 75
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {yearData.achievement.toFixed(1)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
