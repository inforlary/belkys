import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { calculateIndicatorProgress } from '../utils/progressCalculations';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

interface Stats {
  totalGoals: number;
  totalIndicators: number;
  totalActivities: number;
  avgAchievement: number;
  activeUsers: number;
  pendingApprovals: number;
  completedActivities: number;
  overdueActivities: number;
}

interface MonthlyData {
  month: string;
  target: number;
  actual: number;
  achievement: number;
}

interface DepartmentPerformance {
  name: string;
  performance: number;
  goals: number;
  indicators: number;
}

interface IndicatorStatus {
  name: string;
  value: number;
}

interface ActivityTrend {
  month: string;
  completed: number;
  pending: number;
  overdue: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function EnhancedDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalGoals: 0,
    totalIndicators: 0,
    totalActivities: 0,
    avgAchievement: 0,
    activeUsers: 0,
    pendingApprovals: 0,
    completedActivities: 0,
    overdueActivities: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentPerformance[]>([]);
  const [indicatorStatus, setIndicatorStatus] = useState<IndicatorStatus[]>([]);
  const [activityTrend, setActivityTrend] = useState<ActivityTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadAllData();
    }
  }, [profile]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadMonthlyPerformance(),
        loadDepartmentPerformance(),
        loadIndicatorStatus(),
        loadActivityTrend(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!profile?.organization_id) return;

    const currentYear = new Date().getFullYear();

    const [
      goalsRes,
      indicatorsRes,
      activitiesRes,
      usersRes,
      approvalsRes,
      completedRes,
      overdueRes,
      indicatorsDataRes,
      targetsRes,
      entriesRes
    ] = await Promise.all([
      supabase.from('goals').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      supabase.from('indicators').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      supabase.from('indicator_data_entries').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('status', 'submitted'),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('status', 'completed'),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).lt('end_date', new Date().toISOString()).neq('status', 'completed'),
      supabase.from('indicators').select('id, baseline_value, target_value, calculation_method').eq('organization_id', profile.organization_id),
      supabase.from('indicator_targets').select('indicator_id, target_value').eq('year', currentYear),
      supabase.from('indicator_data_entries').select('indicator_id, value, status').eq('organization_id', profile.organization_id).eq('period_year', currentYear).in('status', ['approved', 'submitted'])
    ]);

    let avgAchievement = 0;
    if (indicatorsDataRes.data && targetsRes.data && entriesRes.data) {
      const achievements: number[] = [];
      const targetsByIndicator: Record<string, number> = {};

      targetsRes.data.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      indicatorsDataRes.data.forEach(indicator => {
        const yearlyTarget = targetsByIndicator[indicator.id] || indicator.target_value;

        if (yearlyTarget) {
          const progress = calculateIndicatorProgress({
            id: indicator.id,
            goal_id: '',
            baseline_value: indicator.baseline_value,
            target_value: indicator.target_value,
            yearly_target: yearlyTarget,
            calculation_method: indicator.calculation_method
          }, entriesRes.data);

          achievements.push(progress);
        }
      });

      if (achievements.length > 0) {
        avgAchievement = achievements.reduce((sum, val) => sum + val, 0) / achievements.length;
      }
    }

    setStats({
      totalGoals: goalsRes.count || 0,
      totalIndicators: indicatorsRes.count || 0,
      totalActivities: activitiesRes.count || 0,
      avgAchievement: Math.round(avgAchievement),
      activeUsers: usersRes.count || 0,
      pendingApprovals: approvalsRes.count || 0,
      completedActivities: completedRes.count || 0,
      overdueActivities: overdueRes.count || 0,
    });
  };

  const loadMonthlyPerformance = async () => {
    if (!profile?.organization_id) return;

    const currentYear = new Date().getFullYear();
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    const { data: entries } = await supabase
      .from('indicator_data_entries')
      .select('period_month, value, indicator_id')
      .eq('organization_id', profile.organization_id)
      .eq('period_year', currentYear)
      .eq('period_type', 'monthly');

    const { data: targets } = await supabase
      .from('indicator_targets')
      .select('indicator_id, target_value')
      .eq('year', currentYear);

    const monthlyDataMap: Record<number, { actual: number; target: number; count: number }> = {};

    entries?.forEach(entry => {
      if (!entry.period_month) return;
      if (!monthlyDataMap[entry.period_month]) {
        monthlyDataMap[entry.period_month] = { actual: 0, target: 0, count: 0 };
      }
      monthlyDataMap[entry.period_month].actual += entry.value || 0;
      monthlyDataMap[entry.period_month].count += 1;

      const target = targets?.find(t => t.indicator_id === entry.indicator_id);
      if (target) {
        monthlyDataMap[entry.period_month].target += (target.target_value || 0) / 12;
      }
    });

    const chartData = months.map((month, index) => {
      const data = monthlyDataMap[index + 1];
      if (!data) {
        return { month, target: 0, actual: 0, achievement: 0 };
      }
      const avgActual = data.count > 0 ? data.actual / data.count : 0;
      const avgTarget = data.count > 0 ? data.target / data.count : 0;
      const achievement = avgTarget > 0 ? (avgActual / avgTarget) * 100 : 0;
      return {
        month,
        target: Math.round(avgTarget),
        actual: Math.round(avgActual),
        achievement: Math.round(achievement)
      };
    });

    setMonthlyData(chartData);
  };

  const loadDepartmentPerformance = async () => {
    if (!profile?.organization_id) return;

    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile.organization_id);

    if (!departments) return;

    const deptPerformance: DepartmentPerformance[] = [];

    for (const dept of departments) {
      const [goalsRes, indicatorsDataRes, targetsRes, entriesRes] = await Promise.all([
        supabase.from('goals').select('id', { count: 'exact', head: true }).eq('department_id', dept.id),
        supabase
          .from('indicators')
          .select('id, goal_id, baseline_value, target_value, calculation_method, goals!inner(department_id)')
          .eq('organization_id', profile.organization_id)
          .eq('goals.department_id', dept.id),
        supabase.from('indicator_targets').select('indicator_id, target_value').eq('year', new Date().getFullYear()),
        supabase.from('indicator_data_entries').select('indicator_id, value, status').eq('organization_id', profile.organization_id).eq('period_year', new Date().getFullYear()).in('status', ['approved', 'submitted'])
      ]);

      const deptIndicators = indicatorsDataRes.data || [];

      let performance = 0;
      if (deptIndicators.length > 0) {
        const achievements: number[] = [];
        const targetsByIndicator: Record<string, number> = {};

        targetsRes.data?.forEach(target => {
          targetsByIndicator[target.indicator_id] = target.target_value;
        });

        deptIndicators.forEach(indicator => {
          const yearlyTarget = targetsByIndicator[indicator.id] || indicator.target_value;

          if (yearlyTarget) {
            const progress = calculateIndicatorProgress({
              id: indicator.id,
              goal_id: indicator.goal_id,
              baseline_value: indicator.baseline_value,
              target_value: indicator.target_value,
              yearly_target: yearlyTarget,
              calculation_method: indicator.calculation_method
            }, entriesRes.data || []);

            achievements.push(progress);
          }
        });

        if (achievements.length > 0) {
          performance = achievements.reduce((sum, val) => sum + val, 0) / achievements.length;
        }
      }

      deptPerformance.push({
        name: dept.name,
        performance: Math.round(performance),
        goals: goalsRes.count || 0,
        indicators: deptIndicators.length
      });
    }

    setDepartmentData(deptPerformance);
  };

  const loadIndicatorStatus = async () => {
    if (!profile?.organization_id) return;

    const { data: indicators } = await supabase
      .from('indicators')
      .select('id')
      .eq('organization_id', profile.organization_id);

    const { data: entries } = await supabase
      .from('indicator_data_entries')
      .select('indicator_id, value')
      .eq('organization_id', profile.organization_id)
      .eq('period_year', new Date().getFullYear());

    const { data: targets } = await supabase
      .from('indicator_targets')
      .select('indicator_id, target_value')
      .eq('year', new Date().getFullYear());

    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;

    indicators?.forEach(indicator => {
      const indicatorEntries = entries?.filter(e => e.indicator_id === indicator.id);
      const target = targets?.find(t => t.indicator_id === indicator.id);

      if (indicatorEntries && indicatorEntries.length > 0 && target && target.target_value > 0) {
        const avgActual = indicatorEntries.reduce((sum, e) => sum + (e.value || 0), 0) / indicatorEntries.length;
        const achievement = (avgActual / target.target_value) * 100;

        if (achievement >= 90) onTrack++;
        else if (achievement >= 70) atRisk++;
        else behind++;
      }
    });

    setIndicatorStatus([
      { name: 'Hedefte', value: onTrack },
      { name: 'Risk Altında', value: atRisk },
      { name: 'Geride', value: behind }
    ]);
  };

  const loadActivityTrend = async () => {
    if (!profile?.organization_id) return;

    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: months[d.getMonth()], year: d.getFullYear(), monthNum: d.getMonth() + 1 };
    });

    const trend: ActivityTrend[] = [];

    for (const period of last6Months) {
      const startDate = new Date(period.year, period.monthNum - 1, 1).toISOString();
      const endDate = new Date(period.year, period.monthNum, 0, 23, 59, 59).toISOString();

      const [completedRes, pendingRes, overdueRes] = await Promise.all([
        supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('status', 'completed').gte('end_date', startDate).lte('end_date', endDate),
        supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('status', 'in_progress').gte('start_date', startDate).lte('start_date', endDate),
        supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).lt('end_date', now.toISOString()).neq('status', 'completed')
      ]);

      trend.push({
        month: period.month,
        completed: completedRes.count || 0,
        pending: pendingRes.count || 0,
        overdue: overdueRes.count || 0
      });
    }

    setActivityTrend(trend);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Performans Kontrol Paneli</h1>
        <p className="text-gray-600 mt-1">Detaylı performans analizi ve trendler</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Hedefler</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalGoals}</p>
                <p className="text-xs text-green-600 mt-1">Aktif stratejik hedefler</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ortalama Başarı</p>
                <p className="text-3xl font-bold text-gray-900">%{stats.avgAchievement}</p>
                <div className="flex items-center gap-1 mt-1">
                  {stats.avgAchievement >= 90 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <p className="text-xs text-green-600">Hedefin üzerinde</p>
                    </>
                  ) : stats.avgAchievement >= 70 ? (
                    <>
                      <Activity className="w-4 h-4 text-yellow-600" />
                      <p className="text-xs text-yellow-600">Hedefte</p>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <p className="text-xs text-red-600">Geride</p>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faaliyetler</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalActivities}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {stats.completedActivities} tamamlandı
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bekleyen Onaylar</p>
                <p className="text-3xl font-bold text-orange-900">{stats.pendingApprovals}</p>
                {stats.overdueActivities > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {stats.overdueActivities} gecikmiş faaliyet
                  </p>
                )}
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Aylık Performans Trendi</h3>
            <p className="text-sm text-gray-600">Hedef vs Gerçekleşen karşılaştırması</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="target" stroke="#3b82f6" fill="#93c5fd" name="Hedef" />
                <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#6ee7b7" name="Gerçekleşen" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Gösterge Durumu</h3>
            <p className="text-sm text-gray-600">Performans dağılımı</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={indicatorStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {indicatorStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Müdürlük Performansı</h3>
            <p className="text-sm text-gray-600">Departman bazlı başarı oranları</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="performance" fill="#3b82f6" name="Performans %" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Faaliyet Trendi</h3>
            <p className="text-sm text-gray-600">Son 6 ayın aktivite durumu</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="#10b981" name="Tamamlanan" strokeWidth={2} />
                <Line type="monotone" dataKey="pending" stroke="#f59e0b" name="Devam Eden" strokeWidth={2} />
                <Line type="monotone" dataKey="overdue" stroke="#ef4444" name="Gecikmiş" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {departmentData.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Radar Analizi</h3>
            <p className="text-sm text-gray-600">Çok boyutlu performans görünümü</p>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={departmentData.slice(0, 6)}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Performans" dataKey="performance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
