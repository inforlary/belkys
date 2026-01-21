import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import { TrendingUp, TrendingDown, Target, AlertCircle, Filter, Search, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { calculateIndicatorProgress } from '../utils/progressCalculations';

interface Department {
  id: string;
  name: string;
}

interface Goal {
  id: string;
  code: string;
  title: string;
}

interface IndicatorData {
  id: string;
  code: string;
  name: string;
  measurement_unit: string;
  target_value: number | null;
  baseline_value: number | null;
  calculation_method: string;
  goal_id: string;
  department_id: string;
  goal?: Goal;
  department?: Department;
  latest_value?: number | null;
  achievement_rate?: number;
  status?: 'excellent' | 'good' | 'warning' | 'critical';
}

export default function PerformanceKPIDashboard() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    department_id: '',
    goal_id: '',
    search: ''
  });

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
      } else if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        indicatorsQuery = indicatorsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const [indicatorsRes, departmentsRes, goalsRes, targetsRes] = await Promise.all([
        indicatorsQuery,
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name'),
        supabase
          .from('goals')
          .select('id, code, title')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        supabase
          .from('indicator_targets')
          .select('indicator_id, target_value')
          .eq('year', currentYear)
      ]);

      const targetsByIndicator: Record<string, number> = {};
      targetsRes.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      if (indicatorsRes.data) {
        const indicatorIds = indicatorsRes.data.map(i => i.id);

        const { data: entriesData } = await supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status, period_quarter')
          .eq('period_year', currentYear)
          .in('status', ['approved', 'submitted'])
          .in('indicator_id', indicatorIds);

        const enrichedIndicators = indicatorsRes.data.map((indicator) => {
          const goal = indicator.goals as any;
          const department = goal?.departments as any;

          const yearlyTarget = targetsByIndicator[indicator.id] || indicator.target_value || 0;

          const progress = calculateIndicatorProgress({
            id: indicator.id,
            goal_id: indicator.goal_id,
            baseline_value: indicator.baseline_value,
            target_value: indicator.target_value,
            yearly_target: yearlyTarget,
            calculation_method: indicator.calculation_method
          }, entriesData || []);

          const indicatorEntries = (entriesData || []).filter(e => e.indicator_id === indicator.id);
          const latestValue = indicatorEntries.reduce((sum, e) => sum + e.value, 0);

          let status: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
          if (progress >= 85) status = 'excellent';
          else if (progress >= 70) status = 'good';
          else if (progress >= 50) status = 'warning';
          else status = 'critical';

          return {
            id: indicator.id,
            code: indicator.code,
            name: indicator.name,
            measurement_unit: indicator.unit,
            target_value: yearlyTarget,
            baseline_value: indicator.baseline_value,
            calculation_method: indicator.calculation_method || 'cumulative',
            goal_id: indicator.goal_id,
            department_id: goal?.department_id || null,
            goal: goal ? {
              id: goal.id,
              code: goal.code,
              title: goal.title
            } : undefined,
            department: department ? {
              id: department.id,
              name: department.name
            } : undefined,
            latest_value: latestValue,
            achievement_rate: progress,
            status
          };
        });

        setIndicators(enrichedIndicators);
      }

      if (departmentsRes.data) setDepartments(departmentsRes.data);
      if (goalsRes.data) setGoals(goalsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredIndicators = indicators.filter(indicator => {
    if (filters.department_id && indicator.department_id !== filters.department_id) return false;
    if (filters.goal_id && indicator.goal_id !== filters.goal_id) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        indicator.name.toLowerCase().includes(searchLower) ||
        indicator.code.toLowerCase().includes(searchLower) ||
        indicator.goal?.title.toLowerCase().includes(searchLower) ||
        false
      );
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      excellent: 'bg-green-500',
      good: 'bg-blue-500',
      warning: 'bg-yellow-500',
      critical: 'bg-red-500'
    };
    return colors[status as keyof typeof colors] || colors.critical;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      excellent: { text: 'Mükemmel', className: 'bg-green-100 text-green-800' },
      good: { text: 'İyi', className: 'bg-blue-100 text-blue-800' },
      warning: { text: 'Dikkat', className: 'bg-yellow-100 text-yellow-800' },
      critical: { text: 'Kritik', className: 'bg-red-100 text-red-800' }
    };
    const badge = badges[status as keyof typeof badges] || badges.critical;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.text}
      </span>
    );
  };

  const getSummaryStats = () => {
    const total = filteredIndicators.length;
    const onTarget = filteredIndicators.filter(i => (i.achievement_rate || 0) >= 85).length;
    const atRisk = filteredIndicators.filter(i => (i.achievement_rate || 0) >= 50 && (i.achievement_rate || 0) < 85).length;
    const behind = filteredIndicators.filter(i => (i.achievement_rate || 0) < 50).length;
    const avgAchievement = total > 0
      ? filteredIndicators.reduce((sum, i) => sum + (i.achievement_rate || 0), 0) / total
      : 0;

    return { total, onTarget, atRisk, behind, avgAchievement };
  };

  const getCategorizedIndicators = () => {
    const onTarget = filteredIndicators.filter(i => (i.achievement_rate || 0) >= 85);
    const atRisk = filteredIndicators.filter(i => (i.achievement_rate || 0) >= 50 && (i.achievement_rate || 0) < 85);
    const behind = filteredIndicators.filter(i => (i.achievement_rate || 0) < 50);

    return { onTarget, atRisk, behind };
  };

  const getGroupedByGoal = () => {
    const grouped: Record<string, {
      goal: Goal;
      department?: Department;
      indicators: IndicatorData[];
      onTarget: IndicatorData[];
      atRisk: IndicatorData[];
      behind: IndicatorData[];
      avgProgress: number;
    }> = {};

    filteredIndicators.forEach(indicator => {
      const goalId = indicator.goal_id;
      if (!grouped[goalId]) {
        grouped[goalId] = {
          goal: indicator.goal!,
          department: indicator.department,
          indicators: [],
          onTarget: [],
          atRisk: [],
          behind: [],
          avgProgress: 0
        };
      }

      grouped[goalId].indicators.push(indicator);

      const achievementRate = indicator.achievement_rate || 0;
      if (achievementRate >= 85) {
        grouped[goalId].onTarget.push(indicator);
      } else if (achievementRate >= 50) {
        grouped[goalId].atRisk.push(indicator);
      } else {
        grouped[goalId].behind.push(indicator);
      }
    });

    Object.values(grouped).forEach(group => {
      const total = group.indicators.length;
      const sum = group.indicators.reduce((acc, i) => acc + (i.achievement_rate || 0), 0);
      group.avgProgress = total > 0 ? sum / total : 0;
    });

    return Object.values(grouped).sort((a, b) => b.avgProgress - a.avgProgress);
  };

  const stats = getSummaryStats();
  const categorizedIndicators = getCategorizedIndicators();
  const groupedByGoal = getGroupedByGoal();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performans KPI Dashboard</h1>
        <p className="text-gray-600 mt-1">Gösterge performanslarını izleyin ve analiz edin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 mb-1">Toplam Gösterge</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">
              Ortalama: %{stats.avgAchievement.toFixed(1)}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <div className="text-sm text-gray-600">Hedefte</div>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.onTarget}</div>
            <div className="text-xs text-gray-500 mt-1">≥85%</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <div className="text-sm text-gray-600">Risk Altında</div>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.atRisk}</div>
            <div className="text-xs text-gray-500 mt-1">50-84%</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <div className="text-sm text-gray-600">Geride</div>
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.behind}</div>
            <div className="text-xs text-gray-500 mt-1">&lt;50%</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Filtrele</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ara</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Gösterge ara..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {profile?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Müdürlük</label>
                <select
                  value={filters.department_id}
                  onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tümü</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hedef</label>
              <select
                value={filters.goal_id}
                onChange={(e) => setFilters({ ...filters, goal_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>{goal.code} - {goal.title}</option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {filteredIndicators.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Gösterge bulunamadı</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByGoal.map((group, index) => (
            <Card key={group.goal.id} className="overflow-hidden">
              <CardBody className="p-0">
                <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{index + 1}</span>
                        <h2 className="text-lg font-bold text-gray-900">
                          {group.goal.code} - {group.goal.title}
                        </h2>
                      </div>
                      <div className="text-sm text-gray-600">
                        {group.indicators.length} gösterge
                        {group.department && ` • ${group.department.name}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-amber-700">
                        {Math.round(group.avgProgress)}%
                      </div>
                      <div className="text-xs text-gray-600">Ortalama İlerleme</div>
                    </div>
                  </div>

                  <div className="mt-4 w-full bg-gray-300 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                      style={{ width: `${Math.min(group.avgProgress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Hedefte</span>
                      </div>
                      <div className="text-2xl font-bold text-green-700">{group.onTarget?.length || 0}</div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-gray-700">Risk Altında</span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-700">{group.atRisk?.length || 0}</div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-gray-700">Geride</span>
                      </div>
                      <div className="text-2xl font-bold text-red-700">{group.behind?.length || 0}</div>
                    </div>
                  </div>

                  {group.onTarget.length > 0 ? (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Hedefte Olan Göstergeler ({group.onTarget.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.onTarget.map((indicator, idx) => (
                          <div key={`${indicator.id}-${idx}`} className="bg-white border border-gray-200 border-l-4 border-l-green-500 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-blue-600 mb-1">{indicator.code || 'N/A'}</div>
                                <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{indicator.name || 'İsimsiz Gösterge'}</h4>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2 flex-shrink-0">
                                %{(indicator.achievement_rate || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Hedef:</span>
                                <span className="font-medium">{indicator.target_value?.toLocaleString('tr-TR') || '0'} {indicator.measurement_unit || ''}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Gerçekleşen:</span>
                                <span className="font-medium">{indicator.latest_value?.toLocaleString('tr-TR') || '0'} {indicator.measurement_unit || ''}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${Math.min(indicator.achievement_rate || 0, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {group.atRisk.length > 0 ? (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Risk Altında Olan Göstergeler ({group.atRisk.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.atRisk.map((indicator, idx) => (
                          <div key={`${indicator.id}-${idx}`} className="bg-white border border-gray-200 border-l-4 border-l-yellow-500 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-blue-600 mb-1">{indicator.code || 'N/A'}</div>
                                <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{indicator.name || 'İsimsiz Gösterge'}</h4>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2 flex-shrink-0">
                                %{(indicator.achievement_rate || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Hedef:</span>
                                <span className="font-medium">{indicator.target_value?.toLocaleString('tr-TR') || '0'} {indicator.measurement_unit || ''}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Gerçekleşen:</span>
                                <span className="font-medium">{indicator.latest_value?.toLocaleString('tr-TR') || '0'} {indicator.measurement_unit || ''}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: `${Math.min(indicator.achievement_rate || 0, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {group.behind.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Geride Olan Göstergeler ({group.behind.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.behind.map((indicator, idx) => (
                          <div key={`${indicator.id}-${idx}`} className="bg-white border border-gray-200 border-l-4 border-l-red-500 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-blue-600 mb-1">{indicator.code || 'N/A'}</div>
                                <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{indicator.name || 'İsimsiz Gösterge'}</h4>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 ml-2 flex-shrink-0">
                                %{(indicator.achievement_rate || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Hedef:</span>
                                <span className="font-medium">{indicator.target_value?.toLocaleString('tr-TR') || '0'} {indicator.measurement_unit || ''}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Gerçekleşen:</span>
                                <span className="font-medium">{indicator.latest_value?.toLocaleString('tr-TR') || '0'} {indicator.measurement_unit || ''}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${Math.min(indicator.achievement_rate || 0, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <div className="font-semibold mb-2">Performans Değerlendirme Kriterleri</div>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-green-600">Hedefte (≥85%):</span> Göstergeler hedeflerine ulaşmış veya hedefe çok yakın, performans mükemmel seviyede
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-yellow-600">Risk Altında (50-84%):</span> Göstergeler kısmen hedefe ulaşmış, iyileştirme çalışmaları yapılmalı, takip edilmeli
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-red-600">Geride (&lt;50%):</span> Göstergeler hedefin çok gerisinde, acil aksiyon planı gerekli, öncelikli müdahale edilmeli
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
