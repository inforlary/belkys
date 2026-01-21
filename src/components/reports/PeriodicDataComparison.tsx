import { useState, useEffect } from 'react';
import {
  FileDown,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ComparisonData {
  code: string;
  name: string;
  unit: string;
  department: string;
  baseline: number | null;
  target: number | null;
  year2024: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    total: number;
  };
  year2025: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    total: number;
  };
  change: number;
  changePercent: number;
  targetAchievement: number;
}

interface PeriodicDataComparisonProps {
  selectedYear?: number;
}

export function PeriodicDataComparison({ selectedYear }: PeriodicDataComparisonProps) {
  const { profile } = useAuth();
  const [data, setData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = selectedYear || new Date().getFullYear();
  const [year1, setYear1] = useState(currentYear - 1);
  const [year2, setYear2] = useState(currentYear);
  const [selectedDept, setSelectedDept] = useState('all');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    setYear1(currentYear - 1);
    setYear2(currentYear);
  }, [selectedYear]);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile, year1, year2, selectedDept]);

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    const { data: depts } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile.organization_id)
      .order('name');

    if (depts) setDepartments(depts);
  };

  const fetchData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      let goalsQuery = supabase
        .from('goals')
        .select('id, department_id')
        .eq('organization_id', profile.organization_id);

      if (selectedDept !== 'all') {
        goalsQuery = goalsQuery.eq('department_id', selectedDept);
      }

      const { data: goals } = await goalsQuery;
      if (!goals || goals.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const goalIds = goals.map(g => g.id);

      const { data: indicators } = await supabase
        .from('indicators')
        .select(`
          id,
          code,
          name,
          unit,
          baseline_value,
          target_value,
          goals!inner(
            departments(name)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .in('goal_id', goalIds)
        .order('code');

      if (!indicators || indicators.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const indicatorIds = indicators.map(i => i.id);

      const { data: entries } = await supabase
        .from('indicator_data_entries')
        .select('indicator_id, period_year, period_quarter, value')
        .eq('organization_id', profile.organization_id)
        .eq('period_type', 'quarterly')
        .in('indicator_id', indicatorIds)
        .in('period_year', [year1, year2])
        .eq('status', 'approved');

      const processedData: ComparisonData[] = indicators.map((ind: any) => {
        const indEntries = entries?.filter(e => e.indicator_id === ind.id) || [];

        const getValue = (year: number, quarter: number) => {
          const entry = indEntries.find(e =>
            e.period_year === year && e.period_quarter === quarter
          );
          return entry ? parseFloat(entry.value) : 0;
        };

        const y1q1 = getValue(year1, 1);
        const y1q2 = getValue(year1, 2);
        const y1q3 = getValue(year1, 3);
        const y1q4 = getValue(year1, 4);
        const y1total = y1q1 + y1q2 + y1q3 + y1q4;

        const y2q1 = getValue(year2, 1);
        const y2q2 = getValue(year2, 2);
        const y2q3 = getValue(year2, 3);
        const y2q4 = getValue(year2, 4);
        const y2total = y2q1 + y2q2 + y2q3 + y2q4;

        const change = y2total - y1total;
        const changePercent = y1total > 0 ? (change / y1total) * 100 : 0;

        const baseline = ind.baseline_value ? parseFloat(ind.baseline_value) : null;
        const target = ind.target_value ? parseFloat(ind.target_value) : null;

        let targetAchievement = 0;
        if (target && target > 0) {
          if (baseline !== null) {
            const progress = y2total - baseline;
            const required = target - baseline;
            targetAchievement = required > 0 ? (progress / required) * 100 : 0;
          } else {
            targetAchievement = (y2total / target) * 100;
          }
        }

        return {
          code: ind.code || 'N/A',
          name: ind.name,
          unit: ind.unit || '',
          department: ind.goals?.departments?.name || 'N/A',
          baseline,
          target,
          year2024: {
            q1: y1q1,
            q2: y1q2,
            q3: y1q3,
            q4: y1q4,
            total: y1total
          },
          year2025: {
            q1: y2q1,
            q2: y2q2,
            q3: y2q3,
            q4: y2q4,
            total: y2total
          },
          change,
          changePercent,
          targetAchievement
        };
      });

      setData(processedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const headers = [
      'Kod', 'Gösterge', 'Birim', 'Birim', 'Başlangıç', 'Hedef',
      `1Ç ${year1}`, `2Ç ${year1}`, `3Ç ${year1}`, `4Ç ${year1}`, `Toplam ${year1}`,
      `1Ç ${year2}`, `2Ç ${year2}`, `3Ç ${year2}`, `4Ç ${year2}`, `Toplam ${year2}`,
      'Değişim', 'Değişim %', 'Hedef Başarı %'
    ];

    const rows = data.map(d => [
      d.code, d.name, d.unit, d.department, d.baseline ?? '', d.target ?? '',
      d.year2024.q1, d.year2024.q2, d.year2024.q3, d.year2024.q4, d.year2024.total,
      d.year2025.q1, d.year2025.q2, d.year2025.q3, d.year2025.q4, d.year2025.total,
      d.change.toFixed(2), d.changePercent.toFixed(2), d.targetAchievement.toFixed(2)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performans_karsilastirma_${year1}_${year2}.csv`;
    link.click();
  };

  const num = (val: number | null) => {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  };

  const getTrendIcon = (percent: number) => {
    if (percent > 5) return <ArrowUpRight className="w-5 h-5 text-green-600" />;
    if (percent < -5) return <ArrowDownRight className="w-5 h-5 text-red-600" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return 'bg-green-100 text-green-800 border-green-300';
    if (percent >= 75) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (percent >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (percent >= 25) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600 font-medium">Veri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Performans Karşılaştırma</h1>
                  <p className="text-blue-100 mt-1">Dönemsel gösterge analizleri ve karşılaştırma raporu</p>
                </div>
              </div>
              <button
                onClick={exportToExcel}
                className="bg-white hover:bg-blue-50 text-blue-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
              >
                <FileDown className="w-5 h-5" />
                Excel İndir
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                <Filter className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Filtreler</span>
              </div>

              <select
                value={year1}
                onChange={(e) => setYear1(Number(e.target.value))}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              >
                <option value={2022}>2022</option>
                <option value={2023}>2023</option>
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>

              <span className="text-slate-400 font-bold">⟷</span>

              <select
                value={year2}
                onChange={(e) => setYear2(Number(e.target.value))}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              >
                <option value={2022}>2022</option>
                <option value={2023}>2023</option>
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-[200px]"
              >
                <option value="all">Tüm Birimler</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Tablo
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    viewMode === 'cards'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Kartlar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Toplam Gösterge</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{data.length}</p>
              </div>
              <Activity className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Artan Trend</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {data.filter(d => d.changePercent > 5).length}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Azalan Trend</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {data.filter(d => d.changePercent < -5).length}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Ort. Başarı</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {data.length > 0
                    ? (data.reduce((sum, d) => sum + d.targetAchievement, 0) / data.length).toFixed(0)
                    : '0'}%
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-16 text-center">
            <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-xl text-slate-500 font-medium">Veri bulunamadı</p>
            <p className="text-slate-400 mt-2">Seçilen kriterlere uygun gösterge verisi bulunmuyor</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider sticky left-0 bg-slate-700 z-10">Kod</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider min-w-[280px]">Gösterge</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider">Birim</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-slate-600">Başlangıç</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-slate-600">Hedef</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-orange-600">1Ç-{year1}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-orange-600">2Ç-{year1}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-orange-600">3Ç-{year1}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-orange-600">4Ç-{year1}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-orange-700 font-extrabold">Toplam {year1}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-blue-600">1Ç-{year2}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-blue-600">2Ç-{year2}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-blue-600">3Ç-{year2}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-blue-600">4Ç-{year2}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-blue-700 font-extrabold">Toplam {year2}</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-green-700">Değişim</th>
                    <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider bg-purple-700">Başarı</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx} className={`border-b border-slate-200 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-4 py-4 text-sm font-bold text-blue-700 sticky left-0 bg-inherit z-10">{item.code}</td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.department}</div>
                      </td>
                      <td className="px-3 py-4 text-sm text-center font-medium text-slate-600">{item.unit}</td>
                      <td className="px-3 py-4 text-sm text-center font-bold text-slate-800 bg-slate-100">{num(item.baseline)}</td>
                      <td className="px-3 py-4 text-sm text-center font-bold text-blue-700 bg-blue-50">{num(item.target)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2024.q1)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2024.q2)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2024.q3)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2024.q4)}</td>
                      <td className="px-3 py-4 text-sm text-center font-extrabold text-orange-900 bg-orange-50">{num(item.year2024.total)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2025.q1)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2025.q2)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2025.q3)}</td>
                      <td className="px-3 py-4 text-sm text-center text-slate-700">{num(item.year2025.q4)}</td>
                      <td className="px-3 py-4 text-sm text-center font-extrabold text-blue-900 bg-blue-100">{num(item.year2025.total)}</td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getTrendIcon(item.changePercent)}
                          <span className={`font-bold text-sm ${item.changePercent > 0 ? 'text-green-700' : item.changePercent < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                            {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border-2 ${getPercentColor(item.targetAchievement)}`}>
                          {item.targetAchievement.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-2xl transition-shadow">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-blue-100 text-xs font-semibold mb-1">{item.code}</div>
                      <h3 className="text-white font-bold text-lg leading-tight">{item.name}</h3>
                      <div className="text-blue-200 text-xs mt-2">{item.department}</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                      <span className="text-white font-bold text-sm">{item.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs text-slate-500 font-medium mb-1">Başlangıç</div>
                      <div className="text-xl font-bold text-slate-900">{num(item.baseline)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="text-xs text-blue-600 font-medium mb-1">Hedef</div>
                      <div className="text-xl font-bold text-blue-700">{num(item.target)}</div>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="text-sm font-bold text-orange-700 mb-3">{year1}</div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div className="text-center">
                        <div className="text-xs text-slate-500">1Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2024.q1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">2Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2024.q2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">3Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2024.q3)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">4Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2024.q4)}</div>
                      </div>
                    </div>
                    <div className="bg-orange-100 rounded px-3 py-2 text-center border border-orange-300">
                      <div className="text-xs text-orange-600 font-medium">Toplam</div>
                      <div className="text-xl font-bold text-orange-900">{num(item.year2024.total)}</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm font-bold text-blue-700 mb-3">{year2}</div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div className="text-center">
                        <div className="text-xs text-slate-500">1Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2025.q1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">2Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2025.q2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">3Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2025.q3)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">4Ç</div>
                        <div className="text-sm font-semibold text-slate-700">{num(item.year2025.q4)}</div>
                      </div>
                    </div>
                    <div className="bg-blue-100 rounded px-3 py-2 text-center border border-blue-300">
                      <div className="text-xs text-blue-600 font-medium">Toplam</div>
                      <div className="text-xl font-bold text-blue-900">{num(item.year2025.total)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(item.changePercent)}
                      <div>
                        <div className="text-xs text-slate-500">Değişim</div>
                        <div className={`text-lg font-bold ${item.changePercent > 0 ? 'text-green-600' : item.changePercent < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Başarı</div>
                      <div className={`text-lg font-bold px-3 py-1 rounded-lg border-2 ${getPercentColor(item.targetAchievement)}`}>
                        {item.targetAchievement.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
