import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import { TrendingUp, TrendingDown, Target, AlertCircle, Filter, Search } from 'lucide-react';

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
      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          *,
          goals(id, code, title),
          departments(id, name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (profile.role !== 'admin' && profile.role !== 'super_admin' && profile.department_id) {
        indicatorsQuery = indicatorsQuery.eq('department_id', profile.department_id);
      }

      const [indicatorsRes, departmentsRes, goalsRes] = await Promise.all([
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
          .order('code')
      ]);

      if (indicatorsRes.data) {
        const enrichedIndicators = await Promise.all(
          indicatorsRes.data.map(async (indicator) => {
            const { data: entries } = await supabase
              .from('indicator_data_entries')
              .select('actual_value')
              .eq('indicator_id', indicator.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const latestValue = entries?.actual_value || null;
            const targetValue = indicator.target_value || 0;
            const baselineValue = indicator.baseline_value || 0;

            let achievementRate = 0;
            let status: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';

            if (latestValue !== null && targetValue > 0) {
              if (indicator.calculation_method === 'increase') {
                achievementRate = (latestValue / targetValue) * 100;
              } else if (indicator.calculation_method === 'decrease') {
                achievementRate = targetValue > 0 ? ((targetValue - latestValue + targetValue) / targetValue) * 100 : 0;
              } else if (indicator.calculation_method === 'maintain') {
                const tolerance = targetValue * 0.1;
                achievementRate = Math.abs(latestValue - targetValue) <= tolerance ? 100 :
                  (1 - Math.abs(latestValue - targetValue) / targetValue) * 100;
              }

              if (achievementRate >= 100) status = 'excellent';
              else if (achievementRate >= 80) status = 'good';
              else if (achievementRate >= 60) status = 'warning';
              else status = 'critical';
            }

            return {
              ...indicator,
              latest_value: latestValue,
              achievement_rate: achievementRate,
              status
            };
          })
        );

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
    const excellent = filteredIndicators.filter(i => i.status === 'excellent').length;
    const good = filteredIndicators.filter(i => i.status === 'good').length;
    const warning = filteredIndicators.filter(i => i.status === 'warning').length;
    const critical = filteredIndicators.filter(i => i.status === 'critical').length;
    const avgAchievement = total > 0
      ? filteredIndicators.reduce((sum, i) => sum + (i.achievement_rate || 0), 0) / total
      : 0;

    return { total, excellent, good, warning, critical, avgAchievement };
  };

  const stats = getSummaryStats();

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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 mb-1">Toplam Gösterge</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 mb-1">Mükemmel</div>
            <div className="text-2xl font-bold text-green-600">{stats.excellent}</div>
            <div className="text-xs text-gray-500 mt-1">≥100%</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 mb-1">İyi</div>
            <div className="text-2xl font-bold text-blue-600">{stats.good}</div>
            <div className="text-xs text-gray-500 mt-1">80-99%</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 mb-1">Dikkat</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
            <div className="text-xs text-gray-500 mt-1">60-79%</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 mb-1">Kritik</div>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-xs text-gray-500 mt-1">&lt;60%</div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIndicators.map((indicator) => (
            <Card key={indicator.id} className="hover:shadow-lg transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-blue-600 mb-1">{indicator.code}</div>
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{indicator.name}</h3>
                  </div>
                  {getStatusBadge(indicator.status || 'critical')}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Hedef</span>
                    <span className="font-semibold text-gray-900">
                      {indicator.target_value?.toLocaleString('tr-TR') || '-'} {indicator.measurement_unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Gerçekleşen</span>
                    <span className="font-semibold text-gray-900">
                      {indicator.latest_value?.toLocaleString('tr-TR') || '-'} {indicator.measurement_unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Başarı Oranı</span>
                    <div className="flex items-center gap-1">
                      {indicator.achievement_rate && indicator.achievement_rate >= 100 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-semibold text-gray-900">
                        %{indicator.achievement_rate?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getStatusColor(indicator.status || 'critical')}`}
                        style={{ width: `${Math.min(indicator.achievement_rate || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      {indicator.goal?.code} - {indicator.goal?.title}
                    </div>
                    {indicator.department && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {indicator.department.name}
                      </div>
                    )}
                  </div>
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
              <div className="font-semibold mb-1">Performans Değerlendirme Kriterleri</div>
              <ul className="space-y-1 text-gray-600">
                <li><span className="font-medium text-green-600">Mükemmel (≥100%):</span> Hedef karşılandı veya aşıldı</li>
                <li><span className="font-medium text-blue-600">İyi (80-99%):</span> Hedefe yakın, olumlu performans</li>
                <li><span className="font-medium text-yellow-600">Dikkat (60-79%):</span> İyileştirme gerekli</li>
                <li><span className="font-medium text-red-600">Kritik (&lt;60%):</span> Acil önlem gerekli</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
