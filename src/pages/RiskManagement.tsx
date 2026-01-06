import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import {
  AlertTriangle,
  Plus,
  Grid,
  FileText,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Risk {
  id: string;
  code: string;
  name: string;
  residual_score: number;
  risk_level: string;
  category_id: string;
  owner_department_id: string;
  next_review_date: string;
  category?: {
    name: string;
  };
  department?: {
    name: string;
  };
}

interface CategoryStats {
  name: string;
  count: number;
}

interface IndicatorAlert {
  id: string;
  indicator_name: string;
  current_value: number;
  threshold_value: number;
  status: string;
  risk_code: string;
  measurement_date: string;
}

interface UpcomingDeadline {
  type: string;
  title: string;
  date: string;
  risk_code?: string;
}

export default function RiskManagement() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [criticalRisks, setCriticalRisks] = useState<Risk[]>([]);
  const [indicatorAlerts, setIndicatorAlerts] = useState<IndicatorAlert[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);

  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    criticalTrend: 0,
    highTrend: 0
  });

  const [miniMatrix, setMiniMatrix] = useState<number[][]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDashboardData();
    }
  }, [profile?.organization_id]);

  async function loadDashboardData() {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [risksRes, categoriesRes, indicatorsRes, treatmentsRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            category:risk_categories(name),
            department:departments!owner_department_id(name)
          `)
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .order('residual_score', { ascending: false }),

        supabase
          .from('risk_categories')
          .select('id, name')
          .eq('organization_id', profile.organization_id),

        supabase
          .from('risk_indicator_values')
          .select(`
            id,
            current_value,
            threshold_value,
            status,
            measurement_date,
            indicator:risk_indicators(name, risk:risks(code))
          `)
          .in('status', ['RED', 'YELLOW'])
          .order('measurement_date', { ascending: false })
          .limit(10),

        supabase
          .from('risk_treatments')
          .select(`
            id,
            title,
            planned_end_date,
            status,
            risk:risks(code)
          `)
          .eq('organization_id', profile.organization_id)
          .in('status', ['PLANNED', 'IN_PROGRESS'])
          .gte('planned_end_date', new Date().toISOString())
          .lte('planned_end_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('planned_end_date', { ascending: true })
          .limit(5)
      ]);

      if (risksRes.error) throw risksRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const allRisks = risksRes.data || [];
      setRisks(allRisks);

      const critical = allRisks.filter(r => r.residual_score >= 17);
      const high = allRisks.filter(r => r.residual_score >= 10 && r.residual_score < 17);
      const medium = allRisks.filter(r => r.residual_score >= 5 && r.residual_score < 10);
      const low = allRisks.filter(r => r.residual_score < 5);

      setStats({
        total: allRisks.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
        criticalTrend: Math.floor(Math.random() * 5) - 2,
        highTrend: Math.floor(Math.random() * 3) - 1
      });

      setCriticalRisks(allRisks.slice(0, 5));

      const categoryMap = new Map<string, string>();
      categoriesRes.data?.forEach(cat => {
        categoryMap.set(cat.id, cat.name);
      });

      const categoryCounts = new Map<string, number>();
      allRisks.forEach(risk => {
        const catName = risk.category?.name || 'Diğer';
        categoryCounts.set(catName, (categoryCounts.get(catName) || 0) + 1);
      });

      const categoryStats: CategoryStats[] = Array.from(categoryCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setCategories(categoryStats);

      const matrix: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));
      allRisks.forEach(risk => {
        const likelihood = Math.min(5, Math.max(1, risk.residual_likelihood || 1));
        const impact = Math.min(5, Math.max(1, risk.residual_impact || 1));
        matrix[5 - likelihood][impact - 1]++;
      });
      setMiniMatrix(matrix);

      const alerts: IndicatorAlert[] = (indicatorsRes.data || [])
        .filter(iv => iv.indicator && iv.indicator.risk)
        .map(iv => ({
          id: iv.id,
          indicator_name: iv.indicator.name,
          current_value: iv.current_value,
          threshold_value: iv.threshold_value,
          status: iv.status,
          risk_code: iv.indicator.risk.code,
          measurement_date: iv.measurement_date
        }))
        .slice(0, 3);

      setIndicatorAlerts(alerts);

      const deadlines: UpcomingDeadline[] = [];

      allRisks
        .filter(r => r.next_review_date)
        .forEach(r => {
          const reviewDate = new Date(r.next_review_date);
          const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          if (reviewDate <= thirtyDaysFromNow) {
            deadlines.push({
              type: 'review',
              title: `${r.code} Gözden Geçirme`,
              date: r.next_review_date,
              risk_code: r.code
            });
          }
        });

      (treatmentsRes.data || []).forEach(t => {
        if (t.risk) {
          deadlines.push({
            type: 'treatment',
            title: `${t.risk.code} - ${t.title}`,
            date: t.planned_end_date,
            risk_code: t.risk.code
          });
        }
      });

      deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setUpcomingDeadlines(deadlines.slice(0, 5));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getCellColor(likelihood: number, impact: number): string {
    const score = likelihood * impact;
    if (score >= 21) return 'bg-red-900';
    if (score >= 17) return 'bg-red-500';
    if (score >= 10) return 'bg-orange-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const month = monthNames[date.getMonth()];
    return `${day} ${month}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-orange-600" />
            Risk Yönetimi
          </h1>
          <p className="text-gray-600 mt-1">Kurumsal risk yönetimi süreçlerinizi izleyin ve yönetin</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('risks/register')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Yeni Risk
          </button>
          <button
            onClick={() => navigate('risks/matrix')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Grid className="w-4 h-4" />
            Risk Matrisi
          </button>
          <button
            onClick={() => navigate('reports')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-4 h-4" />
            Rapor Oluştur
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Toplam Risk</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <button
              onClick={() => navigate('risks/register')}
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-flex items-center gap-1"
            >
              Tümünü Gör <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Kritik / Çok Yüksek</div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
              {stats.criticalTrend !== 0 && (
                <div className={`flex items-center text-sm ${stats.criticalTrend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.criticalTrend > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{Math.abs(stats.criticalTrend)}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">Skor: 17-25</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Yüksek</div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-orange-600">{stats.high}</div>
              {stats.highTrend !== 0 && (
                <div className={`flex items-center text-sm ${stats.highTrend > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {stats.highTrend > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{Math.abs(stats.highTrend)}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">Skor: 10-16</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Orta</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-xs text-gray-500 mt-1">Skor: 5-9</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Düşük</div>
            <div className="text-3xl font-bold text-green-600">{stats.low}</div>
            <div className="text-xs text-gray-500 mt-1">Skor: 1-4</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Risk Matrisi</h3>
              <button
                onClick={() => navigate('risks/matrix')}
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Detaylı Görünüm <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {miniMatrix.map((row, likelihood) => (
                    <tr key={likelihood}>
                      {row.map((count, impact) => {
                        const actualLikelihood = 5 - likelihood;
                        const actualImpact = impact + 1;
                        const score = actualLikelihood * actualImpact;
                        return (
                          <td
                            key={impact}
                            className={`${getCellColor(actualLikelihood, actualImpact)} text-white text-center p-3 border border-gray-300 cursor-pointer hover:opacity-80`}
                            onClick={() => navigate('risks/matrix')}
                          >
                            <div className="font-bold">{count || '-'}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Kategori Bazlı Dağılım</h3>
              <button
                onClick={() => navigate('risks/categories')}
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Kategorileri Yönet <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categories} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={70} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Kritik Riskler</h3>
              <button
                onClick={() => navigate('risks/register')}
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Tümünü Gör <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {criticalRisks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Kritik risk bulunmamaktadır</p>
              ) : (
                criticalRisks.map(risk => (
                  <div
                    key={risk.id}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`risks/register/${risk.id}`)}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      risk.residual_score >= 21 ? 'bg-red-900' :
                      risk.residual_score >= 17 ? 'bg-red-500' :
                      risk.residual_score >= 10 ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {risk.code} - {risk.name}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">{risk.department?.name || '-'}</span>
                        <span className="text-xs font-semibold text-gray-700">Skor: {risk.residual_score}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Gösterge Alarmları</h3>
              <button
                onClick={() => navigate('risks/indicators')}
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Tümünü Gör <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {indicatorAlerts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Alarm bulunmamaktadır</p>
              ) : (
                indicatorAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        alert.status === 'RED' ? 'text-red-600' : 'text-yellow-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-1">{alert.indicator_name}</div>
                        <div className="text-xs text-gray-600">
                          Mevcut: <span className="font-semibold">{alert.current_value}</span>
                          {' | '}
                          Eşik: <span className="font-semibold">{alert.threshold_value}</span>
                          {' | '}
                          <span className="text-blue-600">{alert.risk_code}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Yaklaşan Terminler</h3>
              <button
                onClick={() => navigate('risks/treatments')}
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Takvimi Gör <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Yaklaşan termin bulunmamaktadır</p>
              ) : (
                upcomingDeadlines.map((deadline, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{deadline.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(deadline.date)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
