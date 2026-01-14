import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { AlertTriangle, TrendingUp, Clock, Bell, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DashboardStats {
  totalRisks: number;
  criticalRisks: number;
  openTreatments: number;
  alarmIndicators: number;
  reviewPendingRisks: number;
}

interface MatrixCell {
  likelihood: number;
  impact: number;
  count: number;
}

interface CategoryData {
  name: string;
  count: number;
}

interface CriticalRisk {
  id: string;
  code: string;
  name: string;
  residual_score: number;
}

interface DelayedTreatment {
  id: string;
  code: string;
  title: string;
  planned_end_date: string;
  risk: { code: string };
  delay_days: number;
}

interface AlarmIndicator {
  id: string;
  indicator_id: string;
  code: string;
  name: string;
  value: number;
  status: string;
  unit_of_measure: string;
  threshold: string;
}

export default function RiskDashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixCell[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [criticalRisks, setCriticalRisks] = useState<CriticalRisk[]>([]);
  const [delayedTreatments, setDelayedTreatments] = useState<DelayedTreatment[]>([]);
  const [alarmIndicators, setAlarmIndicators] = useState<AlarmIndicator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDashboardData();
    }
  }, [profile?.organization_id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const risksData = await supabase
        .from('risks')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      const riskIds = risksData.data?.map(r => r.id) || [];

      const [treatmentsData, indicatorsData] = await Promise.all([
        riskIds.length > 0
          ? supabase.from('risk_treatments').select('*').in('risk_id', riskIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('risk_indicator_values')
          .select('*, risk_indicators!inner(organization_id, code, name, unit_of_measure, red_threshold)')
          .eq('risk_indicators.organization_id', orgId)
          .order('measurement_date', { ascending: false })
      ]);

      const totalRisks = risksData.data?.length || 0;
      const criticalRisks = risksData.data?.filter(r => r.residual_score && r.residual_score >= 17).length || 0;
      const openTreatments = treatmentsData.data?.filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status || '')).length || 0;

      const indicatorsByIndicator = new Map<string, any>();
      indicatorsData.data?.forEach(val => {
        const indId = val.indicator_id;
        if (!indicatorsByIndicator.has(indId) || new Date(val.measurement_date) > new Date(indicatorsByIndicator.get(indId).measurement_date)) {
          indicatorsByIndicator.set(indId, val);
        }
      });

      const alarmIndicators = Array.from(indicatorsByIndicator.values()).filter(v => v.status === 'RED').length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reviewPendingRisks = risksData.data?.filter(r => {
        if (!r.next_review_date) return false;
        const reviewDate = new Date(r.next_review_date);
        reviewDate.setHours(0, 0, 0, 0);
        return reviewDate <= today;
      }).length || 0;

      setStats({ totalRisks, criticalRisks, openTreatments, alarmIndicators, reviewPendingRisks });

      const matrix: MatrixCell[] = [];
      const matrixMap = new Map<string, number>();
      risksData.data?.forEach(r => {
        if (r.residual_likelihood && r.residual_impact) {
          const key = `${r.residual_likelihood}-${r.residual_impact}`;
          matrixMap.set(key, (matrixMap.get(key) || 0) + 1);
        }
      });
      matrixMap.forEach((count, key) => {
        const [likelihood, impact] = key.split('-').map(Number);
        matrix.push({ likelihood, impact, count });
      });
      setMatrixData(matrix);

      const categoriesResult = await supabase
        .from('risks')
        .select('category_id, risk_categories(name)')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      const catMap = new Map<string, number>();
      categoriesResult.data?.forEach(r => {
        const catName = (r as any).risk_categories?.name || 'Diğer';
        catMap.set(catName, (catMap.get(catName) || 0) + 1);
      });
      const categories: CategoryData[] = [];
      catMap.forEach((count, name) => {
        categories.push({ name, count });
      });
      setCategoryData(categories.sort((a, b) => b.count - a.count));

      const criticalResult = await supabase
        .from('risks')
        .select('id, code, name, residual_score')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('residual_score', { ascending: false })
        .limit(5);
      setCriticalRisks(criticalResult.data || []);

      const delayedResult = await supabase
        .from('risk_treatments')
        .select('id, code, title, planned_end_date, status, risk_id, risks!inner(code, organization_id)')
        .eq('risks.organization_id', orgId)
        .lt('planned_end_date', new Date().toISOString().split('T')[0]);

      const delayed = delayedResult.data
        ?.filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status || ''))
        .map(t => {
          const targetDate = new Date(t.planned_end_date);
          const today = new Date();
          const delayDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: t.id,
            code: t.code || '',
            title: t.title,
            planned_end_date: t.planned_end_date,
            risk: { code: (t as any).risks?.code || '' },
            delay_days: delayDays
          };
        }) || [];
      setDelayedTreatments(delayed.slice(0, 5));

      const alarms = Array.from(indicatorsByIndicator.values())
        .filter(v => ['RED', 'YELLOW'].includes(v.status))
        .map(a => ({
          id: a.id,
          indicator_id: a.indicator_id,
          code: (a as any).risk_indicators?.code || '',
          name: (a as any).risk_indicators?.name || '',
          value: a.value || 0,
          status: a.status || '',
          unit_of_measure: (a as any).risk_indicators?.unit_of_measure || '',
          threshold: (a as any).risk_indicators?.red_threshold || ''
        }))
        .sort((a, b) => (a.status === 'RED' ? -1 : 1));
      setAlarmIndicators(alarms.slice(0, 5));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMatrixColor = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score <= 4) return '#22c55e';
    if (score <= 9) return '#eab308';
    if (score <= 14) return '#f97316';
    if (score <= 19) return '#ef4444';
    return '#991b1b';
  };

  const getCellCount = (likelihood: number, impact: number) => {
    const cell = matrixData.find(m => m.likelihood === likelihood && m.impact === impact);
    return cell?.count || 0;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
        <h1 className="text-3xl font-bold text-gray-900">Risk Yönetimi</h1>
        <p className="mt-2 text-gray-600">Kurumsal risk durumu özeti</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          onClick={() => navigate('/risk-management/risks')}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">TOPLAM RİSK</span>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.totalRisks || 0}</div>
          <div className="mt-2 flex items-center text-sm text-blue-600">
            <span className="mr-1">🔵</span> Aktif
          </div>
        </div>

        <div
          onClick={() => navigate('/risk-management/risks?level=critical')}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">KRİTİK RİSK</span>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.criticalRisks || 0}</div>
          <div className="mt-2 text-xs text-gray-500">(skor 17-25)</div>
          <div className="mt-1 flex items-center text-sm text-red-600">
            <span className="mr-1">🔴</span> Kritik
          </div>
        </div>

        <div
          onClick={() => navigate('/risk-management/treatments?status=open')}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">AÇIK FALİYET</span>
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.openTreatments || 0}</div>
          <div className="mt-2 text-xs text-gray-500">(tamamlanmamış)</div>
          <div className="mt-1 flex items-center text-sm text-yellow-600">
            <span className="mr-1">🟡</span> Bekleyen
          </div>
        </div>

        <div
          onClick={() => navigate('/risk-management/indicators?status=red')}
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">ALARM VEREN GÖSTERGE</span>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.alarmIndicators || 0}</div>
          <div className="mt-2 text-xs text-gray-500">(kırmızı)</div>
          <div className="mt-1 flex items-center text-sm text-red-600">
            <span className="mr-1">🔴</span> Alarm
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Gözden Geçirme Bekleyen Riskler</h2>
          <button
            onClick={() => navigate('/risk-management/risks?reviewStatus=overdue')}
            className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            Tümünü Gör <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {stats && stats.reviewPendingRisks > 0 ? (
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.reviewPendingRisks}</div>
                <div className="text-sm text-gray-600">Risk gözden geçirme tarihini geçmiş</div>
              </div>
            </div>
            <button
              onClick={() => navigate('/risk-management/risks?reviewStatus=overdue')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Gözden Geçir
            </button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Gözden geçirme bekleyen risk bulunmuyor</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Risk Matrisi (5x5)</h2>
            <button
              onClick={() => navigate('/risk-management/matrix')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Matrise Git <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-12 h-12 text-xs font-medium text-gray-600"></th>
                  <th className="w-12 h-12 text-xs font-medium text-gray-600">1</th>
                  <th className="w-12 h-12 text-xs font-medium text-gray-600">2</th>
                  <th className="w-12 h-12 text-xs font-medium text-gray-600">3</th>
                  <th className="w-12 h-12 text-xs font-medium text-gray-600">4</th>
                  <th className="w-12 h-12 text-xs font-medium text-gray-600">5</th>
                </tr>
              </thead>
              <tbody>
                {[5, 4, 3, 2, 1].map(likelihood => (
                  <tr key={likelihood}>
                    <td className="w-12 h-12 text-xs font-medium text-gray-600 text-center">{likelihood}</td>
                    {[1, 2, 3, 4, 5].map(impact => {
                      const count = getCellCount(likelihood, impact);
                      const color = getMatrixColor(likelihood, impact);
                      return (
                        <td
                          key={impact}
                          className="w-12 h-12 border border-gray-200 text-center cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: color }}
                          onClick={() => navigate(`/risk-management/risks?likelihood=${likelihood}&impact=${impact}`)}
                        >
                          <span className="text-white font-bold text-sm">{count || ''}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                <span>Düşük (1-4)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }}></div>
                <span>Orta (5-9)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></div>
                <span>Yüksek (10-14)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                <span>Çok Yüksek (15-19)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#991b1b' }}></div>
                <span>Kritik (20-25)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Dağılımı</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => `${name} (${count})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Henüz risk verisi yok
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Kritik Riskler (Top 5)</h2>
            <button
              onClick={() => navigate('/risk-management/risks?sort=score')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {criticalRisks.length > 0 ? (
              criticalRisks.map((risk, index) => (
                <div
                  key={risk.id}
                  onClick={() => navigate(`/risk-management/risks/${risk.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">{index + 1}.</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{risk.code}</span>
                      <div className="text-sm text-gray-600">{risk.name}</div>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-600">[{risk.residual_score}]</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">Henüz risk kaydı yok</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Geciken Faaliyetler</h2>
            <button
              onClick={() => navigate('/risk-management/treatments?status=delayed')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {delayedTreatments.length > 0 ? (
              delayedTreatments.map((treatment, index) => (
                <div
                  key={treatment.id}
                  onClick={() => navigate(`/risk-management/treatments/${treatment.id}`)}
                  className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-gray-900">{treatment.code}</span>
                    </div>
                    <span className="text-xs font-medium text-orange-600">Gecikme: {treatment.delay_days} gün</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{treatment.title}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">Geciken faaliyet yok</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Gösterge Alarmları</h2>
          <button
            onClick={() => navigate('/risk-management/indicators')}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Tüm Göstergeler <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {alarmIndicators.length > 0 ? (
            alarmIndicators.map(indicator => (
              <div
                key={indicator.id}
                onClick={() => navigate('/risk-management/indicators')}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{indicator.status === 'RED' ? '🔴' : '🟡'}</span>
                  <div>
                    <div className="font-medium text-gray-900">{indicator.code} {indicator.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Değer: {indicator.value} {indicator.unit_of_measure} | Eşik: {indicator.threshold}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">Alarm durumu yok</div>
          )}
        </div>
      </div>
    </div>
  );
}
