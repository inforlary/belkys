import { useState, useEffect } from 'react';
import { Target, TrendingUp, AlertTriangle, DollarSign, CheckCircle, Clock, Activity, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface KPIData {
  totalGoals: number;
  totalIndicators: number;
  avgAchievement: number;
  totalRisks: number;
  budgetUtilization: number;
  activeActivities: number;
  completedActivities: number;
  dataEntryRate: number;
}

interface QuarterlyTrend {
  period: string;
  achievement: number;
  target: number;
}

interface DepartmentPerformance {
  department: string;
  achievement: number;
  goalCount: number;
  indicatorCount: number;
}

interface RiskDistribution {
  level: string;
  count: number;
  color: string;
}

export default function InstitutionOverview() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [quarterlyTrends, setQuarterlyTrends] = useState<QuarterlyTrend[]>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<DepartmentPerformance[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution[]>([]);
  const [goalProgress, setGoalProgress] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedQuarter, profile]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      setError('Organizasyon bilgisi bulunamadı');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadKPIData(),
        loadQuarterlyTrends(),
        loadDepartmentPerformance(),
        loadRiskDistribution(),
        loadGoalProgress()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIData = async () => {
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('id')
      .eq('organization_id', profile?.organization_id)
      .eq('fiscal_year', selectedYear);

    if (goalsError) {
      console.error('Goals error:', goalsError);
    }

    const goalIds = goals?.map(g => g.id) || [];

    const { data: indicators } = await supabase
      .from('indicators')
      .select('id, goal_id')
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
      .eq('organization_id', profile?.organization_id);

    const { data: activities } = await supabase
      .from('sub_program_activities')
      .select('id, status')
      .eq('organization_id', profile?.organization_id);

    const completedActivities = activities?.filter(a => a.status === 'approved').length || 0;

    const totalExpectedEntries = indicatorIds.length * 4;
    const totalActualEntries = dataEntries?.length || 0;
    const dataEntryRate = totalExpectedEntries > 0 ? Math.round((totalActualEntries / totalExpectedEntries) * 100) : 0;

    setKpiData({
      totalGoals: goals?.length || 0,
      totalIndicators: indicators?.length || 0,
      avgAchievement: Math.round(avgAchievement),
      totalRisks: risks?.length || 0,
      budgetUtilization: 0,
      activeActivities: activities?.filter(a => a.status === 'draft' || a.status === 'director_review').length || 0,
      completedActivities,
      dataEntryRate
    });
  };

  const loadQuarterlyTrends = async () => {
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('organization_id', profile?.organization_id)
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

    const trends: QuarterlyTrend[] = [];
    for (let q = 1; q <= 4; q++) {
      const { data } = await supabase
        .from('indicator_data_entries')
        .select('value, indicator_id, indicator:indicators!inner(target_value)')
        .in('indicator_id', indicatorIds)
        .eq('year', selectedYear)
        .eq('period_type', 'quarterly')
        .eq('period_quarter', q)
        .eq('status', 'admin_approved');

      let totalAchievement = 0;
      let validEntries = 0;

      data?.forEach(entry => {
        const target = targetMap[entry.indicator_id] !== undefined && targetMap[entry.indicator_id] !== null
          ? targetMap[entry.indicator_id]
          : (entry.indicator?.target_value !== undefined && entry.indicator?.target_value !== null ? entry.indicator.target_value : null);

        if (target !== null && target !== 0) {
          totalAchievement += (entry.value / target) * 100;
          validEntries++;
        }
      });

      const avgAchievement = validEntries > 0 ? totalAchievement / validEntries : 0;

      trends.push({
        period: `Ç${q}`,
        achievement: Math.round(avgAchievement),
        target: 100
      });
    }
    setQuarterlyTrends(trends);
  };

  const loadDepartmentPerformance = async () => {
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id);

    if (!departments) return;

    const deptPerf: DepartmentPerformance[] = [];

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

      deptPerf.push({
        department: dept.name,
        achievement: Math.round(avgAchievement),
        goalCount: goals?.length || 0,
        indicatorCount: indicators?.length || 0
      });
    }

    setDepartmentPerformance(deptPerf.sort((a, b) => b.achievement - a.achievement));
  };

  const loadRiskDistribution = async () => {
    const { data: risks } = await supabase
      .from('risks')
      .select('inherent_probability, inherent_impact')
      .eq('organization_id', profile?.organization_id);

    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    risks?.forEach(risk => {
      const score = (risk.inherent_probability || 0) * (risk.inherent_impact || 0);
      if (score <= 4) distribution.low++;
      else if (score <= 9) distribution.medium++;
      else if (score <= 16) distribution.high++;
      else distribution.critical++;
    });

    setRiskDistribution([
      { level: 'Düşük', count: distribution.low, color: '#10b981' },
      { level: 'Orta', count: distribution.medium, color: '#f59e0b' },
      { level: 'Yüksek', count: distribution.high, color: '#ef4444' },
      { level: 'Kritik', count: distribution.critical, color: '#991b1b' }
    ]);
  };

  const loadGoalProgress = async () => {
    const { data: objectives } = await supabase
      .from('objectives')
      .select('id, title')
      .eq('organization_id', profile?.organization_id);

    if (!objectives) return;

    const progress = [];

    for (const obj of objectives) {
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('objective_id', obj.id)
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

      progress.push({
        objective: obj.title.length > 30 ? obj.title.substring(0, 30) + '...' : obj.title,
        goals: goalIds.length,
        indicators: indicatorIds.length,
        achievement: Math.round(avgAchievement)
      });
    }

    setGoalProgress(progress);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Toplam Hedef',
      value: kpiData?.totalGoals || 0,
      icon: Target,
      color: 'bg-blue-500',
      trend: '+5%'
    },
    {
      title: 'Toplam Gösterge',
      value: kpiData?.totalIndicators || 0,
      icon: Activity,
      color: 'bg-green-500',
      trend: '+12%'
    },
    {
      title: 'Ortalama Gerçekleşme',
      value: `${kpiData?.avgAchievement || 0}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      trend: '+3%'
    },
    {
      title: 'Toplam Risk',
      value: kpiData?.totalRisks || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      trend: '-2%'
    },
    {
      title: 'Bütçe Kullanımı',
      value: `${kpiData?.budgetUtilization || 0}%`,
      icon: DollarSign,
      color: 'bg-yellow-500',
      trend: '+8%'
    },
    {
      title: 'Aktif Faaliyet',
      value: kpiData?.activeActivities || 0,
      icon: Clock,
      color: 'bg-indigo-500',
      trend: '+4%'
    },
    {
      title: 'Tamamlanan Faaliyet',
      value: kpiData?.completedActivities || 0,
      icon: CheckCircle,
      color: 'bg-teal-500',
      trend: '+15%'
    },
    {
      title: 'Veri Giriş Oranı',
      value: `${kpiData?.dataEntryRate || 0}%`,
      icon: Users,
      color: 'bg-pink-500',
      trend: '+6%'
    }
  ];

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
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Çeyrek</label>
          <select
            value={selectedQuarter || ''}
            onChange={(e) => setSelectedQuarter(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tüm Yıl</option>
            <option value={1}>Ç1</option>
            <option value={2}>Ç2</option>
            <option value={3}>Ç3</option>
            <option value={4}>Ç4</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-green-600">{card.trend}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Çeyreklik İlerleme Trendi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quarterlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="achievement" stroke="#3b82f6" strokeWidth={2} name="Gerçekleşme %" />
              <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Hedef %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Dağılımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskDistribution}
                dataKey="count"
                nameKey="level"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.level}: ${entry.count}`}
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Amaç Bazında Genel İlerleme</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={goalProgress}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="objective" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="achievement" fill="#3b82f6" name="Gerçekleşme %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Müdürlük Performans Karşılaştırması</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Müdürlük
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hedef Sayısı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gösterge Sayısı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Başarı Oranı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departmentPerformance.map((dept, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {dept.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dept.goalCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dept.indicatorCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(dept.achievement, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{dept.achievement}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      dept.achievement >= 80 ? 'bg-green-100 text-green-800' :
                      dept.achievement >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {dept.achievement >= 80 ? 'İyi' : dept.achievement >= 60 ? 'Orta' : 'Düşük'}
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
