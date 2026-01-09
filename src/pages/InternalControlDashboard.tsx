import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
  Users,
  Target
} from 'lucide-react';

interface DashboardStats {
  totalActions: number;
  completedActions: number;
  inProgressActions: number;
  overdueActions: number;
  complianceScore: number;
  totalStandards: number;
  assessedStandards: number;
  totalPlans: number;
}

export default function InternalControlDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [user, profile]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      const orgId = profile?.organization_id;
      if (!orgId) return;

      const today = new Date().toISOString().split('T')[0];

      const [actionsResult, standardsResult, plansResult] = await Promise.all([
        supabase
          .from('ic_actions')
          .select('id, status, end_date', { count: 'exact' })
          .eq('organization_id', orgId),
        supabase
          .from('ic_kiks_main_standards')
          .select('id', { count: 'exact' }),
        supabase
          .from('ic_action_plans')
          .select('id', { count: 'exact' })
          .eq('organization_id', orgId)
      ]);

      const actions = actionsResult.data || [];
      const totalActions = actions.length;
      const completedActions = actions.filter(a => a.status === 'TAMAMLANDI').length;
      const inProgressActions = actions.filter(a =>
        a.status === 'DEVAM_EDIYOR' || a.status === 'BASLADI'
      ).length;
      const overdueActions = actions.filter(a =>
        a.end_date && a.end_date < today && a.status !== 'TAMAMLANDI'
      ).length;

      const totalStandards = standardsResult.count || 0;
      const totalPlans = plansResult.count || 0;

      const complianceScore = totalActions > 0
        ? Math.round((completedActions / totalActions) * 100)
        : 0;

      setStats({
        totalActions,
        completedActions,
        inProgressActions,
        overdueActions,
        complianceScore,
        totalStandards,
        assessedStandards: 0,
        totalPlans
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Uyum Skoru',
      value: `${stats?.complianceScore || 0}%`,
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Tamamlanan Eylemler',
      value: stats?.completedActions || 0,
      subtitle: `/ ${stats?.totalActions || 0}`,
      icon: CheckCircle2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Devam Eden Eylemler',
      value: stats?.inProgressActions || 0,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Gecikmiş Eylemler',
      value: stats?.overdueActions || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'KIKS Standartları',
      value: stats?.totalStandards || 0,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Eylem Planları',
      value: stats?.totalPlans || 0,
      icon: FileText,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">İç Kontrol Yönetim Sistemi</h1>
        <p className="mt-2 text-gray-600">
          İç kontrol uyum durumu ve eylem takibi özet görünümü
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {card.value}
                  {card.subtitle && (
                    <span className="text-lg text-gray-500 ml-1">{card.subtitle}</span>
                  )}
                </p>
              </div>
              <div className={`${card.bgColor} p-3 rounded-lg`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Eylem Durumu</h2>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Tamamlanma Oranı</span>
                <span className="font-medium">{stats?.complianceScore || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${stats?.complianceScore || 0}%` }}
                />
              </div>
            </div>
            <div className="pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Toplam Eylem</span>
                <span className="font-semibold">{stats?.totalActions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600">Tamamlanan</span>
                <span className="font-semibold text-green-600">{stats?.completedActions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-orange-600">Devam Eden</span>
                <span className="font-semibold text-orange-600">{stats?.inProgressActions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Gecikmiş</span>
                <span className="font-semibold text-red-600">{stats?.overdueActions || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Hızlı Erişim</h2>
          </div>
          <div className="space-y-2">
            <a
              href="/#/internal-control/standards"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Standartlar & Eylemler</div>
              <div className="text-sm text-gray-600">KIKS standartları ve eylem yönetimi</div>
            </a>
            <a
              href="/#/internal-control/action-plans"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Eylem Planları</div>
              <div className="text-sm text-gray-600">Dönemsel eylem planları</div>
            </a>
            <a
              href="/#/internal-control/assessments"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">Öz Değerlendirmeler</div>
              <div className="text-sm text-gray-600">Dönemsel uyum değerlendirmeleri</div>
            </a>
            <a
              href="/#/internal-control/ikyk"
              className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="font-medium text-gray-900">İKİYK Toplantıları</div>
              <div className="text-sm text-gray-600">Toplantı ve karar takibi</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
