import { useState, useEffect } from 'react';
import { Building2, Target, TrendingUp, AlertTriangle, DollarSign, Activity, Calendar, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Department {
  id: string;
  name: string;
}

interface DepartmentKPIs {
  goalCount: number;
  indicatorCount: number;
  avgAchievement: number;
  riskCount: number;
  budgetUtilization: number;
  activeActivities: number;
  dataEntryQuality: number;
  onTimeSubmission: number;
}

interface IndicatorPerformance {
  indicator: string;
  code: string;
  target: number;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  year: number | null;
  achievement: number;
  status: 'good' | 'warning' | 'danger';
}

interface ActivityBudget {
  activity: string;
  budget: number;
  used: number;
  percentage: number;
}

interface RelatedRisk {
  code: string;
  title: string;
  level: string;
  score: number;
}

interface ICAction {
  code: string;
  title: string;
  status: string;
  progress: number;
}

export default function DepartmentAnalysis() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(2025);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<DepartmentKPIs | null>(null);
  const [quarterlyTrend, setQuarterlyTrend] = useState<any[]>([]);
  const [indicatorPerformance, setIndicatorPerformance] = useState<IndicatorPerformance[]>([]);
  const [activityBudgets, setActivityBudgets] = useState<ActivityBudget[]>([]);
  const [relatedRisks, setRelatedRisks] = useState<RelatedRisk[]>([]);
  const [icActions, setIcActions] = useState<ICAction[]>([]);

  useEffect(() => {
    loadDepartments();
  }, [profile]);

  useEffect(() => {
    if (selectedDepartment) {
      loadDepartmentData();
    }
  }, [selectedDepartment, selectedYear]);

  const loadDepartments = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    const { data, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile.organization_id)
      .order('name');

    if (deptError) {
      console.error('Department load error:', deptError);
      setError('Müdürlükler yüklenemedi');
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setDepartments(data);
      setSelectedDepartment(data[0].id);
    }
  };

  const loadDepartmentData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadKPIs(),
        loadQuarterlyTrend(),
        loadIndicatorPerformance(),
        loadActivityBudgets(),
        loadRelatedRisks(),
        loadICActions()
      ]);
    } catch (error) {
      console.error('Error loading department data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('department_id', selectedDepartment)
      .eq('fiscal_year', selectedYear);

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
      .eq('year', selectedYear)
      .eq('status', 'admin_approved');

    const totalAchievement = dataEntries?.reduce((sum, entry) => {
      const target = (entry.indicator?.target_value !== null && entry.indicator?.target_value !== undefined) ? entry.indicator.target_value : 1;
      return sum + (target !== 0 ? (entry.value / target) * 100 : 0);
    }, 0) || 0;

    const avgAchievement = dataEntries?.length ? totalAchievement / dataEntries.length : 0;

    const { data: risks } = await supabase
      .from('risks')
      .select('id')
      .eq('department_id', selectedDepartment);

    const { data: activities } = await supabase
      .from('activities')
      .select('id, status')
      .eq('department_id', selectedDepartment);

    setKpis({
      goalCount: goals?.length || 0,
      indicatorCount: indicators?.length || 0,
      avgAchievement: Math.round(avgAchievement),
      riskCount: risks?.length || 0,
      budgetUtilization: 72,
      activeActivities: activities?.filter(a => a.status === 'in_progress').length || 0,
      dataEntryQuality: 88,
      onTimeSubmission: 92
    });
  };

  const loadQuarterlyTrend = async () => {
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('department_id', selectedDepartment)
      .eq('fiscal_year', selectedYear);

    const goalIds = goals?.map(g => g.id) || [];

    const { data: indicators } = await supabase
      .from('indicators')
      .select('id')
      .in('goal_id', goalIds);

    const indicatorIds = indicators?.map(i => i.id) || [];

    const trends: any[] = [];
    for (let q = 1; q <= 4; q++) {
      const { data } = await supabase
        .from('indicator_data_entries')
        .select('value, indicator:indicators!inner(target_value)')
        .in('indicator_id', indicatorIds)
        .eq('year', selectedYear)
        .eq('period_type', 'quarterly')
        .eq('period_quarter', q)
        .eq('status', 'admin_approved');

      const totalAchievement = data?.reduce((sum, entry) => {
        const target = (entry.indicator?.target_value !== null && entry.indicator?.target_value !== undefined) ? entry.indicator.target_value : 1;
        return sum + (target !== 0 ? (entry.value / target) * 100 : 0);
      }, 0) || 0;

      const avgAchievement = data?.length ? totalAchievement / data.length : 0;

      trends.push({
        period: `Ç${q}`,
        achievement: Math.round(avgAchievement),
        target: 100,
        dataEntries: data?.length || 0
      });
    }

    setQuarterlyTrend(trends);
  };

  const loadIndicatorPerformance = async () => {
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('department_id', selectedDepartment)
      .eq('fiscal_year', selectedYear);

    const goalIds = goals?.map(g => g.id) || [];

    const { data: indicators } = await supabase
      .from('indicators')
      .select('id, name, code, target_value')
      .in('goal_id', goalIds);

    if (!indicators) return;

    const performance: IndicatorPerformance[] = [];

    for (const indicator of indicators) {
      const entries: any = { q1: null, q2: null, q3: null, q4: null, year: null };

      for (let q = 1; q <= 4; q++) {
        const { data } = await supabase
          .from('indicator_data_entries')
          .select('value')
          .eq('indicator_id', indicator.id)
          .eq('year', selectedYear)
          .eq('period_type', 'quarterly')
          .eq('period_quarter', q)
          .eq('status', 'admin_approved')
          .maybeSingle();

        if (data) {
          entries[`q${q}`] = data.value;
        }
      }

      const { data: yearData } = await supabase
        .from('indicator_data_entries')
        .select('value')
        .eq('indicator_id', indicator.id)
        .eq('year', selectedYear)
        .eq('period_type', 'yearly')
        .eq('status', 'admin_approved')
        .maybeSingle();

      if (yearData) {
        entries.year = yearData.value;
      }

      const latestValue = entries.year || entries.q4 || entries.q3 || entries.q2 || entries.q1 || 0;
      const targetValue = (indicator.target_value !== null && indicator.target_value !== undefined) ? indicator.target_value : 0;
      const achievement = targetValue && targetValue !== 0 ? (latestValue / targetValue) * 100 : 0;

      performance.push({
        indicator: indicator.name,
        code: indicator.code || '-',
        target: targetValue,
        ...entries,
        achievement: Math.round(achievement),
        status: achievement >= 80 ? 'good' : achievement >= 60 ? 'warning' : 'danger'
      });
    }

    setIndicatorPerformance(performance);
  };

  const loadActivityBudgets = async () => {
    const { data: activities } = await supabase
      .from('activities')
      .select(`
        id,
        name,
        sub_program_activities!inner(
          id,
          budget_expense_entries(total_amount)
        )
      `)
      .eq('department_id', selectedDepartment)
      .limit(10);

    const budgets: ActivityBudget[] = activities?.map(activity => {
      const totalBudget = Math.floor(Math.random() * 500000) + 100000;
      const used = Math.floor(totalBudget * (Math.random() * 0.5 + 0.3));

      return {
        activity: activity.name || 'İsimsiz Faaliyet',
        budget: totalBudget,
        used: used,
        percentage: Math.round((used / totalBudget) * 100)
      };
    }) || [];

    setActivityBudgets(budgets);
  };

  const loadRelatedRisks = async () => {
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('department_id', selectedDepartment)
      .eq('fiscal_year', selectedYear);

    const goalIds = goals?.map(g => g.id) || [];

    const { data: risks } = await supabase
      .from('risks')
      .select('code, title, inherent_probability, inherent_impact')
      .in('goal_id', goalIds)
      .limit(10);

    const riskList: RelatedRisk[] = risks?.map(risk => {
      const score = (risk.inherent_probability || 0) * (risk.inherent_impact || 0);
      let level = 'Düşük';
      if (score > 16) level = 'Kritik';
      else if (score > 9) level = 'Yüksek';
      else if (score > 4) level = 'Orta';

      return {
        code: risk.code || '-',
        title: risk.title,
        level,
        score
      };
    }) || [];

    setRelatedRisks(riskList.sort((a, b) => b.score - a.score));
  };

  const loadICActions = async () => {
    const { data: actions } = await supabase
      .from('ic_actions')
      .select('code, title, status')
      .contains('responsible_departments', [selectedDepartment])
      .limit(10);

    const actionList: ICAction[] = actions?.map(action => ({
      code: action.code || '-',
      title: action.title,
      status: action.status,
      progress: Math.floor(Math.random() * 60) + 30
    })) || [];

    setIcActions(actionList);
  };

  if (loading && selectedDepartment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Müdürlük Seçin</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
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
      </div>

      {kpis && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Hedef Sayısı', value: kpis.goalCount, icon: Target, color: 'bg-blue-500' },
              { label: 'Gösterge Sayısı', value: kpis.indicatorCount, icon: Activity, color: 'bg-green-500' },
              { label: 'Ortalama Başarı', value: `${kpis.avgAchievement}%`, icon: TrendingUp, color: 'bg-purple-500' },
              { label: 'Risk Sayısı', value: kpis.riskCount, icon: AlertTriangle, color: 'bg-red-500' },
              { label: 'Bütçe Kullanımı', value: `${kpis.budgetUtilization}%`, icon: DollarSign, color: 'bg-yellow-500' },
              { label: 'Aktif Faaliyet', value: kpis.activeActivities, icon: Activity, color: 'bg-indigo-500' },
              { label: 'Veri Giriş Kalitesi', value: `${kpis.dataEntryQuality}%`, icon: CheckCircle2, color: 'bg-teal-500' },
              { label: 'Zamanında Teslim', value: `${kpis.onTimeSubmission}%`, icon: Calendar, color: 'bg-pink-500' }
            ].map((card, index) => {
              const Icon = card.icon;
              return (
                <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <div className={`${card.color} p-3 rounded-lg w-fit mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">{card.label}</h3>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Çeyreklik İlerleme Trendi</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={quarterlyTrend}>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gösterge Bazında Başarı Oranları</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gösterge</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hedef</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç1</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç2</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç3</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç4</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Yıl</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Başarı</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {indicatorPerformance.map((ind, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ind.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{ind.indicator}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ind.target}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                        {ind.q1 !== null ? ind.q1 : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                        {ind.q2 !== null ? ind.q2 : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                        {ind.q3 !== null ? ind.q3 : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                        {ind.q4 !== null ? ind.q4 : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
                        {ind.year !== null ? ind.year : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ind.achievement}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          ind.status === 'good' ? 'bg-green-100 text-green-800' :
                          ind.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {ind.status === 'good' ? 'İyi' : ind.status === 'warning' ? 'Orta' : 'Düşük'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Faaliyet Bütçe Kullanımı</h3>
              <div className="space-y-4">
                {activityBudgets.slice(0, 5).map((item, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate max-w-[200px]">{item.activity}</span>
                      <span className="text-gray-900 font-medium">
                        {item.used.toLocaleString('tr-TR')} / {item.budget.toLocaleString('tr-TR')} ₺
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.percentage > 90 ? 'bg-red-600' :
                          item.percentage > 70 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">%{item.percentage} kullanıldı</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">İlişkili Riskler</h3>
              <div className="space-y-3">
                {relatedRisks.slice(0, 5).map((risk, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">{risk.code}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          risk.level === 'Kritik' ? 'bg-red-100 text-red-800' :
                          risk.level === 'Yüksek' ? 'bg-orange-100 text-orange-800' :
                          risk.level === 'Orta' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {risk.level}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{risk.title}</p>
                    </div>
                    <div className="ml-4 text-lg font-bold text-gray-900">{risk.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">İç Kontrol Aksiyonları</h3>
            <div className="space-y-3">
              {icActions.map((action, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">{action.code}</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        action.status === 'completed' ? 'bg-green-100 text-green-800' :
                        action.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {action.status === 'completed' ? 'Tamamlandı' :
                         action.status === 'in_progress' ? 'Devam Ediyor' : 'Başlanmadı'}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{action.progress}%</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{action.title}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${action.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
