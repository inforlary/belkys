import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  AlertTriangle,
  TrendingUp,
  Shield,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Target
} from 'lucide-react';

interface DashboardStats {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  overdueActivities: number;
  redIndicators: number;
  totalActivities: number;
  completedActivities: number;
}

interface RiskMatrixData {
  risk_id: string;
  risk_code: string;
  risk_name: string;
  likelihood: number;
  impact: number;
  score: number;
}

interface OverdueActivity {
  id: string;
  title: string;
  risk_name: string;
  target_date: string;
  responsible_unit: string;
  days_overdue: number;
}

interface RedIndicator {
  id: string;
  name: string;
  current_value: number;
  red_threshold: number;
  unit: string;
}

export default function RiskDashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [matrixData, setMatrixData] = useState<RiskMatrixData[]>([]);
  const [overdueActivities, setOverdueActivities] = useState<OverdueActivity[]>([]);
  const [redIndicators, setRedIndicators] = useState<RedIndicator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDashboardData();
    }
  }, [profile?.organization_id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadMatrixData(),
        loadOverdueActivities(),
        loadRedIndicators()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const orgId = profile?.organization_id;
    if (!orgId) return;

    const { data: risks } = await supabase
      .from('risk_register')
      .select('residual_likelihood, residual_impact')
      .eq('organization_id', orgId)
      .eq('status', 'active');

    const totalRisks = risks?.length || 0;
    let criticalRisks = 0;
    let highRisks = 0;
    let mediumRisks = 0;
    let lowRisks = 0;

    risks?.forEach(risk => {
      const score = (risk.residual_likelihood || 0) * (risk.residual_impact || 0);
      if (score >= 20) criticalRisks++;
      else if (score >= 12) highRisks++;
      else if (score >= 5) mediumRisks++;
      else lowRisks++;
    });

    const { count: overdueCount } = await supabase
      .from('risk_treatments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .lt('target_date', new Date().toISOString().split('T')[0])
      .neq('status', 'completed');

    const { count: totalActivitiesCount } = await supabase
      .from('risk_treatments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    const { count: completedActivitiesCount } = await supabase
      .from('risk_treatments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'completed');

    const { data: indicators } = await supabase
      .from('risk_indicators')
      .select('current_value, red_threshold')
      .eq('organization_id', orgId);

    const redIndicators = indicators?.filter(ind =>
      ind.current_value >= ind.red_threshold
    ).length || 0;

    setStats({
      totalRisks,
      criticalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
      overdueActivities: overdueCount || 0,
      redIndicators,
      totalActivities: totalActivitiesCount || 0,
      completedActivities: completedActivitiesCount || 0
    });
  };

  const loadMatrixData = async () => {
    const orgId = profile?.organization_id;
    if (!orgId) return;

    const { data } = await supabase
      .from('risk_register')
      .select('id, code, risk_name, residual_likelihood, residual_impact')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .limit(15);

    const matrixData = (data || []).map(risk => ({
      risk_id: risk.id,
      risk_code: risk.code,
      risk_name: risk.risk_name,
      likelihood: risk.residual_likelihood || 1,
      impact: risk.residual_impact || 1,
      score: (risk.residual_likelihood || 1) * (risk.residual_impact || 1)
    }));

    setMatrixData(matrixData);
  };

  const loadOverdueActivities = async () => {
    const orgId = profile?.organization_id;
    if (!orgId) return;

    const today = new Date();

    const { data } = await supabase
      .from('risk_treatments')
      .select(`
        id,
        action_plan,
        target_date,
        responsible_department_id,
        departments(name),
        risk_register(risk_name)
      `)
      .eq('organization_id', orgId)
      .lt('target_date', today.toISOString().split('T')[0])
      .neq('status', 'completed')
      .order('target_date', { ascending: true })
      .limit(5);

    const overdue = (data || []).map((activity: any) => {
      const targetDate = new Date(activity.target_date);
      const daysOverdue = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: activity.id,
        title: activity.action_plan,
        risk_name: activity.risk_register?.risk_name || 'Bilinmeyen Risk',
        target_date: activity.target_date,
        responsible_unit: activity.departments?.name || 'Belirtilmemiş',
        days_overdue: daysOverdue
      };
    });

    setOverdueActivities(overdue);
  };

  const loadRedIndicators = async () => {
    const orgId = profile?.organization_id;
    if (!orgId) return;

    const { data } = await supabase
      .from('risk_indicators')
      .select('id, indicator_name, current_value, red_threshold, unit')
      .eq('organization_id', orgId)
      .order('current_value', { ascending: false })
      .limit(5);

    const red = (data || []).filter(ind => ind.current_value >= ind.red_threshold).map(ind => ({
      id: ind.id,
      name: ind.indicator_name,
      current_value: ind.current_value,
      red_threshold: ind.red_threshold,
      unit: ind.unit || ''
    }));

    setRedIndicators(red);
  };

  const getRiskColor = (score: number) => {
    if (score >= 20) return 'bg-red-900';
    if (score >= 12) return 'bg-red-600';
    if (score >= 5) return 'bg-orange-400';
    return 'bg-green-500';
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Risk Yönetimi Dashboard</h1>
        <p className="mt-2 text-gray-600">Risk durum özeti ve kritik göstergeler</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Toplam Risk</span>
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.totalRisks || 0}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-900" />
              <span>Kritik: {stats?.criticalRisks || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-600" />
              <span>Yüksek: {stats?.highRisks || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span>Orta: {stats?.mediumRisks || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Düşük: {stats?.lowRisks || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Gösterge Alarmları</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">{stats?.redIndicators || 0}</div>
          <p className="mt-2 text-xs text-gray-500">Kırmızı eşik aşımı</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Geciken Faaliyetler</span>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-600">{stats?.overdueActivities || 0}</div>
          <p className="mt-2 text-xs text-gray-500">Süre aşımı</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Faaliyet İlerlemesi</span>
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats?.totalActivities ?
              Math.round((stats.completedActivities / stats.totalActivities) * 100) : 0}%
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {stats?.completedActivities || 0} / {stats?.totalActivities || 0} tamamlandı
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Risk Matrisi Özet</h2>
            <button
              onClick={() => navigate('/risk-management/matrix')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Detaylı Görünüm
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-6 gap-1 text-xs font-medium text-gray-600">
              <div />
              <div className="text-center">1</div>
              <div className="text-center">2</div>
              <div className="text-center">3</div>
              <div className="text-center">4</div>
              <div className="text-center">5</div>
            </div>

            {[5, 4, 3, 2, 1].map(likelihood => (
              <div key={likelihood} className="grid grid-cols-6 gap-1">
                <div className="text-xs font-medium text-gray-600 flex items-center">{likelihood}</div>
                {[1, 2, 3, 4, 5].map(impact => {
                  const score = likelihood * impact;
                  const risksInCell = matrixData.filter(
                    r => r.likelihood === likelihood && r.impact === impact
                  );
                  return (
                    <div
                      key={impact}
                      className={`h-12 ${getRiskColor(score)} rounded flex items-center justify-center text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => navigate('/risk-management/matrix')}
                      title={risksInCell.map(r => r.risk_name).join('\n')}
                    >
                      {risksInCell.length > 0 && risksInCell.length}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Olasılık →</span>
              <span className="text-gray-600">← Etki</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Geciken Faaliyetler</h2>
            <button
              onClick={() => navigate('/risk-management/treatments')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {overdueActivities.length > 0 ? (
            <div className="space-y-3">
              {overdueActivities.map(activity => (
                <div
                  key={activity.id}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/risk-management/treatments')}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{activity.title}</div>
                      <div className="text-xs text-gray-600 mt-1">Risk: {activity.risk_name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{activity.responsible_unit}</span>
                        <span>•</span>
                        <span className="text-red-600 font-medium">
                          {activity.days_overdue} gün gecikti
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Geciken faaliyet bulunmuyor
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Gösterge Alarmları</h2>
            <button
              onClick={() => navigate('/risk-management/indicators')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tüm Göstergeler
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {redIndicators.length > 0 ? (
            <div className="space-y-3">
              {redIndicators.map(indicator => (
                <div
                  key={indicator.id}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{indicator.name}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Eşik: {indicator.red_threshold} {indicator.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {indicator.current_value}
                      </div>
                      <div className="text-xs text-gray-500">{indicator.unit}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Alarm durumunda gösterge yok
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Erişim</h2>
          <div className="space-y-2">
            <a
              href="/#/risk-management/risks"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Risk Listesi</div>
              <div className="text-sm text-gray-600">Tüm riskleri görüntüle ve yönet</div>
            </a>
            <a
              href="/#/risk-management/matrix"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Risk Matrisi</div>
              <div className="text-sm text-gray-600">5x5 interaktif risk matrisi</div>
            </a>
            <a
              href="/#/risk-management/treatments"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Risk Faaliyetleri</div>
              <div className="text-sm text-gray-600">Azaltma eylemleri ve takip</div>
            </a>
            <a
              href="/#/risk-management/settings"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Ayarlar</div>
              <div className="text-sm text-gray-600">Risk yönetimi konfigürasyonu</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
