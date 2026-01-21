import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

interface DepartmentComparison {
  department: string;
  achievement: number;
  goalCount: number;
  indicatorCount: number;
  riskCount: number;
  budgetUtilization: number;
  dataEntryRate: number;
}

interface YearComparison {
  year: number;
  achievement: number;
  goalCount: number;
  indicatorCount: number;
  completedActivities: number;
}

interface QuarterTrend {
  quarter: string;
  year: number;
  achievement: number;
}

interface BestWorstPerformer {
  department: string;
  metric: string;
  value: number;
  rank: number;
}

export default function ComparativeAnalysis() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMetric, setSelectedMetric] = useState<'achievement' | 'budget' | 'dataEntry'>('achievement');
  const [departmentComparison, setDepartmentComparison] = useState<DepartmentComparison[]>([]);
  const [yearComparison, setYearComparison] = useState<YearComparison[]>([]);
  const [quarterTrends, setQuarterTrends] = useState<QuarterTrend[]>([]);
  const [bestPerformers, setBestPerformers] = useState<BestWorstPerformer[]>([]);
  const [worstPerformers, setWorstPerformers] = useState<BestWorstPerformer[]>([]);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [scatterData, setScatterData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedYear, profile]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        loadDepartmentComparison(),
        loadYearComparison(),
        loadQuarterTrends(),
        loadPerformers()
      ]);
    } catch (error) {
      console.error('Error loading comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentComparison = async () => {
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id);

    if (!departments) return;

    const comparisons: DepartmentComparison[] = [];

    for (const dept of departments) {
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('department_id', dept.id)
        .eq('fiscal_year', selectedYear);

      const goalIds = goals?.map(g => g.id) || [];

      const { data: indicators } = await supabase
        .from('indicators')
        .select('id')
        .in('goal_id', goalIds);

      const indicatorIds = indicators?.map(i => i.id) || [];

      const { data: targets } = await supabase
        .from('indicator_targets')
        .select('indicator_id, target_value')
        .in('indicator_id', indicatorIds)
        .eq('year', selectedYear);

      const targetMap: Record<string, number> = {};
      targets?.forEach(t => {
        if (t.target_value !== null && t.target_value !== undefined) {
          targetMap[t.indicator_id] = t.target_value;
        }
      });

      const { data: dataEntries } = await supabase
        .from('indicator_data_entries')
        .select('value, indicator_id, indicator:indicators!inner(target_value)')
        .in('indicator_id', indicatorIds)
        .eq('year', selectedYear)
        .eq('status', 'admin_approved');

      let totalAchievement = 0;
      let validEntries = 0;

      dataEntries?.forEach(entry => {
        const target = targetMap[entry.indicator_id] !== undefined && targetMap[entry.indicator_id] !== null
          ? targetMap[entry.indicator_id]
          : (entry.indicator?.target_value !== undefined && entry.indicator?.target_value !== null ? entry.indicator.target_value : null);

        if (target !== null && target !== 0) {
          totalAchievement += (entry.value / target) * 100;
          validEntries++;
        }
      });

      const avgAchievement = validEntries > 0 ? totalAchievement / validEntries : 0;

      const { data: risks } = await supabase
        .from('risks')
        .select('id')
        .eq('department_id', dept.id);

      const totalExpectedEntries = indicatorIds.length * 4;
      const totalActualEntries = dataEntries?.length || 0;
      const dataEntryRate = totalExpectedEntries > 0 ? Math.round((totalActualEntries / totalExpectedEntries) * 100) : 0;

      comparisons.push({
        department: dept.name,
        achievement: Math.round(avgAchievement),
        goalCount: goals?.length || 0,
        indicatorCount: indicators?.length || 0,
        riskCount: risks?.length || 0,
        budgetUtilization: 0,
        dataEntryRate
      });
    }

    setDepartmentComparison(comparisons.sort((a, b) => b.achievement - a.achievement));
    prepareRadarData(comparisons);
    prepareScatterData(comparisons);
  };

  const loadYearComparison = async () => {
    const years = [2023, 2024, 2025];
    const comparisons: YearComparison[] = [];

    for (const year of years) {
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile?.organization_id)
        .eq('fiscal_year', year);

      const goalIds = goals?.map(g => g.id) || [];

      const { data: indicators } = await supabase
        .from('indicators')
        .select('id')
        .in('goal_id', goalIds);

      const indicatorIds = indicators?.map(i => i.id) || [];

      const { data: dataEntries } = await supabase
        .from('indicator_data_entries')
        .select('value, indicator:indicators!inner(target_value)')
        .in('indicator_id', indicatorIds)
        .eq('year', year)
        .eq('status', 'admin_approved');

      const totalAchievement = dataEntries?.reduce((sum, entry) => {
        const target = entry.indicator?.target_value || 1;
        return sum + ((entry.value / target) * 100);
      }, 0) || 0;

      const avgAchievement = dataEntries?.length ? totalAchievement / dataEntries.length : 0;

      const { data: activities } = await supabase
        .from('sub_program_activities')
        .select('id, status')
        .eq('organization_id', profile?.organization_id);

      const completedActivities = activities?.filter(a => a.status === 'admin_approved').length || 0;

      comparisons.push({
        year,
        achievement: Math.round(avgAchievement),
        goalCount: goals?.length || 0,
        indicatorCount: indicators?.length || 0,
        completedActivities
      });
    }

    setYearComparison(comparisons);
  };

  const loadQuarterTrends = async () => {
    const years = [selectedYear - 1, selectedYear];
    const trends: QuarterTrend[] = [];

    for (const year of years) {
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile?.organization_id)
        .eq('fiscal_year', year);

      const goalIds = goals?.map(g => g.id) || [];

      const { data: indicators } = await supabase
        .from('indicators')
        .select('id')
        .in('goal_id', goalIds);

      const indicatorIds = indicators?.map(i => i.id) || [];

      for (let q = 1; q <= 4; q++) {
        const { data } = await supabase
          .from('indicator_data_entries')
          .select('value, indicator:indicators!inner(target_value)')
          .in('indicator_id', indicatorIds)
          .eq('year', year)
          .eq('period_type', 'quarterly')
          .eq('period_quarter', q)
          .eq('status', 'admin_approved');

        const totalAchievement = data?.reduce((sum, entry) => {
          const target = entry.indicator?.target_value || 1;
          return sum + ((entry.value / target) * 100);
        }, 0) || 0;

        const avgAchievement = data?.length ? totalAchievement / data.length : 0;

        trends.push({
          quarter: `${year} Ç${q}`,
          year,
          achievement: Math.round(avgAchievement)
        });
      }
    }

    setQuarterTrends(trends);
  };

  const loadPerformers = async () => {
    const best: BestWorstPerformer[] = [];
    const worst: BestWorstPerformer[] = [];

    const sortedByAchievement = [...departmentComparison].sort((a, b) => b.achievement - a.achievement);
    const sortedByBudget = [...departmentComparison].sort((a, b) => b.budgetUtilization - a.budgetUtilization);
    const sortedByDataEntry = [...departmentComparison].sort((a, b) => b.dataEntryRate - a.dataEntryRate);

    if (sortedByAchievement.length > 0) {
      best.push({
        department: sortedByAchievement[0].department,
        metric: 'Başarı Oranı',
        value: sortedByAchievement[0].achievement,
        rank: 1
      });
      worst.push({
        department: sortedByAchievement[sortedByAchievement.length - 1].department,
        metric: 'Başarı Oranı',
        value: sortedByAchievement[sortedByAchievement.length - 1].achievement,
        rank: sortedByAchievement.length
      });
    }

    if (sortedByBudget.length > 0) {
      best.push({
        department: sortedByBudget[0].department,
        metric: 'Bütçe Kullanımı',
        value: sortedByBudget[0].budgetUtilization,
        rank: 1
      });
    }

    if (sortedByDataEntry.length > 0) {
      best.push({
        department: sortedByDataEntry[0].department,
        metric: 'Veri Giriş Oranı',
        value: sortedByDataEntry[0].dataEntryRate,
        rank: 1
      });
    }

    setBestPerformers(best);
    setWorstPerformers(worst);
  };

  const prepareRadarData = (comparisons: DepartmentComparison[]) => {
    const radarData = comparisons.slice(0, 5).map(dept => ({
      department: dept.department.substring(0, 15),
      'Başarı Oranı': dept.achievement,
      'Bütçe Kullanımı': dept.budgetUtilization,
      'Veri Giriş': dept.dataEntryRate,
      'Hedef Sayısı': dept.goalCount * 10,
      'Risk Yönetimi': Math.max(0, 100 - (dept.riskCount * 5))
    }));

    setRadarData(radarData);
  };

  const prepareScatterData = (comparisons: DepartmentComparison[]) => {
    const scatterData = comparisons.map(dept => ({
      x: dept.achievement,
      y: dept.budgetUtilization,
      z: dept.goalCount * 5,
      name: dept.department
    }));

    setScatterData(scatterData);
  };

  useEffect(() => {
    if (departmentComparison.length > 0) {
      loadPerformers();
      prepareRadarData(departmentComparison);
      prepareScatterData(departmentComparison);
    }
  }, [departmentComparison]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Karşılaştırma verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mali Yıl</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={2023}>2023</option>
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Karşılaştırma Metriği</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="achievement">Başarı Oranı</option>
            <option value="budget">Bütçe Kullanımı</option>
            <option value="dataEntry">Veri Giriş Oranı</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-6 h-6 text-green-700" />
            <h3 className="text-lg font-semibold text-green-900">En İyi Performans</h3>
          </div>
          <div className="space-y-3">
            {bestPerformers.map((performer, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{performer.metric}</div>
                    <div className="text-lg font-bold text-gray-900">{performer.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700">
                      {performer.value}
                      {performer.metric.includes('Oran') ? '%' : ''}
                    </div>
                    <div className="text-xs text-gray-500">1. sıra</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6 text-red-700" />
            <h3 className="text-lg font-semibold text-red-900">Gelişme Gereken Alanlar</h3>
          </div>
          <div className="space-y-3">
            {worstPerformers.map((performer, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{performer.metric}</div>
                    <div className="text-lg font-bold text-gray-900">{performer.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-700">
                      {performer.value}
                      {performer.metric.includes('Oran') ? '%' : ''}
                    </div>
                    <div className="text-xs text-gray-500">{performer.rank}. sıra</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Müdürlükler Arası Karşılaştırma</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={departmentComparison}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="achievement" fill="#3b82f6" name="Başarı Oranı (%)" />
            <Bar dataKey="budgetUtilization" fill="#10b981" name="Bütçe Kullanımı (%)" />
            <Bar dataKey="dataEntryRate" fill="#f59e0b" name="Veri Giriş Oranı (%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Çok Boyutlu Performans Analizi (Radar Chart)</h3>
        <ResponsiveContainer width="100%" height={500}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="department" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar name="Başarı Oranı" dataKey="Başarı Oranı" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            <Radar name="Bütçe Kullanımı" dataKey="Bütçe Kullanımı" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            <Radar name="Veri Giriş" dataKey="Veri Giriş" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Yıllar Arası Karşılaştırma</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={yearComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="achievement" stroke="#3b82f6" strokeWidth={2} name="Başarı Oranı" />
              <Line type="monotone" dataKey="goalCount" stroke="#10b981" strokeWidth={2} name="Hedef Sayısı" />
              <Line type="monotone" dataKey="indicatorCount" stroke="#f59e0b" strokeWidth={2} name="Gösterge Sayısı" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Çeyreklik Trend Analizi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quarterTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="quarter" angle={-45} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="achievement"
                stroke="#3b82f6"
                strokeWidth={3}
                name="Başarı Oranı (%)"
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Başarı vs Bütçe Kullanımı (Scatter Plot)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Yatay eksen: Başarı oranı | Dikey eksen: Bütçe kullanımı | Balon boyutu: Hedef sayısı
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="Başarı Oranı" unit="%" />
            <YAxis type="number" dataKey="y" name="Bütçe Kullanımı" unit="%" />
            <ZAxis type="number" dataKey="z" range={[100, 1000]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter name="Müdürlükler" data={scatterData} fill="#3b82f6" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detaylı Müdürlük Karşılaştırma Tablosu</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sıra</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müdürlük</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Başarı Oranı</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bütçe Kullanımı</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Veri Giriş</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hedef</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gösterge</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departmentComparison.map((dept, index) => (
                <tr key={index} className={index < 3 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {dept.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                      dept.achievement >= 80 ? 'bg-green-100 text-green-800' :
                      dept.achievement >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {dept.achievement}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {dept.budgetUtilization}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {dept.dataEntryRate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {dept.goalCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {dept.indicatorCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      dept.riskCount > 10 ? 'bg-red-100 text-red-800' :
                      dept.riskCount > 5 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {dept.riskCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
