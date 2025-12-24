import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface BudgetMetrics {
  allocated: number;
  revised: number;
  committed: number;
  realized: number;
  available: number;
  realizationRate: number;
  utilizationRate: number;
}

interface Alert {
  id: string;
  type: 'overrun' | 'warning' | 'delayed';
  severity: 'high' | 'medium' | 'low';
  message: string;
  entity: string;
}

export default function BudgetPerformanceDashboard() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<BudgetMetrics>({
    allocated: 0,
    revised: 0,
    committed: 0,
    realized: 0,
    available: 0,
    realizationRate: 0,
    utilizationRate: 0
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadDashboardData();
    }
  }, [profile]);

  const loadDashboardData = async () => {
    if (!profile) return;

    try {
      const { data: fiscalYear } = await supabase
        .from('fiscal_years')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('is_current', true)
        .maybeSingle();

      if (!fiscalYear) {
        setLoading(false);
        return;
      }

      const { data: summaries } = await supabase
        .from('budget_control_summary')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('fiscal_year_id', fiscalYear.id);

      if (summaries && summaries.length > 0) {
        const totals = summaries.reduce((acc, s) => ({
          allocated: acc.allocated + parseFloat(s.allocated_amount || 0),
          revised: acc.revised + parseFloat(s.revised_amount || 0),
          committed: acc.committed + parseFloat(s.committed_amount || 0),
          realized: acc.realized + parseFloat(s.realized_amount || 0)
        }), { allocated: 0, revised: 0, committed: 0, realized: 0 });

        const available = totals.revised - totals.committed - totals.realized;
        const realizationRate = totals.revised > 0 ? (totals.realized / totals.revised) * 100 : 0;
        const utilizationRate = totals.revised > 0 ? ((totals.committed + totals.realized) / totals.revised) * 100 : 0;

        setMetrics({
          ...totals,
          available,
          realizationRate,
          utilizationRate
        });

        const alertsList: Alert[] = summaries
          .filter(s => parseFloat(s.available_amount || 0) < 0)
          .map(s => ({
            id: s.id,
            type: 'overrun' as const,
            severity: 'high' as const,
            message: `Bütçe aşımı riski`,
            entity: s.allocation_id
          }));

        setAlerts(alertsList.slice(0, 5));
      }

      const [expenseCount, revenueCount] = await Promise.all([
        supabase
          .from('expense_budget_entries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('status', 'pending_approval'),
        supabase
          .from('revenue_budget_entries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('status', 'pending_approval')
      ]);

      setPendingApprovals((expenseCount.count || 0) + (revenueCount.count || 0));

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bütçe - Performans Dashboard</h1>
        <p className="text-gray-600 mt-1">Mali durum özeti ve performans göstergeleri</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tahsis Edilen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₺ {formatCurrency(metrics.allocated)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">₺</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revize Bütçe</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₺ {formatCurrency(metrics.revised)}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taahhüt</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₺ {formatCurrency(metrics.committed)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gerçekleşen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₺ {formatCurrency(metrics.realized)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kalan Bütçe</p>
                <p className={`text-2xl font-bold mt-1 ${metrics.available < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  ₺ {formatCurrency(metrics.available)}
                </p>
              </div>
              <div className={`p-3 rounded-lg flex items-center justify-center ${metrics.available < 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <span className={`text-2xl font-bold ${metrics.available < 0 ? 'text-red-600' : 'text-gray-600'}`}>₺</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gerçekleşme Oranı</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">%{metrics.realizationRate.toFixed(1)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(metrics.realizationRate, 100)}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kullanım Oranı</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">%{metrics.utilizationRate.toFixed(1)}</p>
              </div>
              <div className={`p-3 rounded-lg ${metrics.utilizationRate > 90 ? 'bg-red-100' : 'bg-blue-100'}`}>
                <TrendingUp className={`w-6 h-6 ${metrics.utilizationRate > 90 ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${metrics.utilizationRate > 90 ? 'bg-red-600' : 'bg-blue-600'}`}
                  style={{ width: `${Math.min(metrics.utilizationRate, 100)}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Onay Bekleyen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pendingApprovals}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Uyarılar ve Riskler</h2>
            </div>

            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">{alert.message}</p>
                    <p className="text-sm text-red-700 mt-1">Kod: {alert.entity}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                    {alert.severity === 'high' ? 'Yüksek' : alert.severity === 'medium' ? 'Orta' : 'Düşük'}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bütçe Dağılımı</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Gerçekleşen</span>
                  <span className="text-sm font-medium">₺ {formatCurrency(metrics.realized)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${metrics.revised > 0 ? (metrics.realized / metrics.revised) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Taahhüt</span>
                  <span className="text-sm font-medium">₺ {formatCurrency(metrics.committed)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full"
                    style={{ width: `${metrics.revised > 0 ? (metrics.committed / metrics.revised) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Kalan</span>
                  <span className={`text-sm font-medium ${metrics.available < 0 ? 'text-red-600' : ''}`}>
                    ₺ {formatCurrency(metrics.available)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${metrics.available < 0 ? 'bg-red-600' : 'bg-blue-600'}`}
                    style={{ width: `${Math.max(0, metrics.revised > 0 ? (metrics.available / metrics.revised) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Özet</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Toplam Bütçe</span>
                <span className="font-medium">₺ {formatCurrency(metrics.revised)}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Kullanılan (Taahhüt + Gerçekleşen)</span>
                <span className="font-medium">₺ {formatCurrency(metrics.committed + metrics.realized)}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Kullanılabilir</span>
                <span className={`font-medium ${metrics.available < 0 ? 'text-red-600' : ''}`}>
                  ₺ {formatCurrency(metrics.available)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <span className="text-gray-600">Gerçekleşme Yüzdesi</span>
                <span className="font-medium text-blue-900">%{metrics.realizationRate.toFixed(1)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
