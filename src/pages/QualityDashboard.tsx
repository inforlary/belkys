import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  FileText,
  ClipboardCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Star,
  ArrowRight
} from 'lucide-react';

interface DashboardStats {
  openDOF: number;
  inProgressDOF: number;
  closedDOF: number;
  plannedAudits: number;
  completedAudits: number;
  inProgressAudits: number;
  totalProcesses: number;
  overdueActions: number;
  averageSatisfaction: number;
  totalFeedback: number;
}

export default function QualityDashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

      const [dofCounts, auditCounts, processCount, feedbackData] = await Promise.all([
        supabase
          .from('qm_nonconformities')
          .select('status')
          .eq('organization_id', orgId),
        supabase
          .from('qm_audits')
          .select('status')
          .eq('organization_id', orgId)
          .then(res => res.error ? { data: [] } : res),
        supabase
          .from('qm_processes')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'ACTIVE')
          .then(res => res.error ? { count: 0 } : res),
        supabase
          .from('qm_customer_feedback')
          .select('satisfaction_score')
          .eq('organization_id', orgId)
          .then(res => res.error ? { data: [] } : res)
      ]);

      const openDOF = dofCounts.data?.filter(d => d.status === 'OPEN' || d.status === 'ANALYSIS').length || 0;
      const inProgressDOF = dofCounts.data?.filter(d =>
        d.status === 'IN_PROGRESS' ||
        d.status === 'ACTION_PLANNED' ||
        d.status === 'VERIFICATION' ||
        d.status === 'EFFECTIVENESS'
      ).length || 0;
      const closedDOF = dofCounts.data?.filter(d => d.status === 'CLOSED').length || 0;

      const plannedAudits = auditCounts.data?.filter(a => a.status === 'PLANNED').length || 0;
      const inProgressAudits = auditCounts.data?.filter(a => a.status === 'IN_PROGRESS').length || 0;
      const completedAudits = auditCounts.data?.filter(a => a.status === 'COMPLETED').length || 0;

      const scores = feedbackData.data?.filter(f => f.satisfaction_score).map(f => f.satisfaction_score) || [];
      const averageSatisfaction = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      setStats({
        openDOF,
        inProgressDOF,
        closedDOF,
        plannedAudits,
        completedAudits,
        inProgressAudits,
        totalProcesses: processCount.count || 0,
        overdueActions: 0,
        averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
        totalFeedback: feedbackData.data?.length || 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Kalite Yönetimi Dashboard</h1>
        <p className="mt-2 text-gray-600">Kalite sistem durum özeti ve kritik göstergeler</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Açık DÖF</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.openDOF || 0}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Devam: {stats?.inProgressDOF || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Kapalı: {stats?.closedDOF || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Tetkikler</span>
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats?.completedAudits || 0} / {(stats?.plannedAudits || 0) + (stats?.inProgressAudits || 0) + (stats?.completedAudits || 0)}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Tamamlanan / Toplam
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Geciken Aksiyonlar</span>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-600">{stats?.overdueActions || 0}</div>
          <p className="mt-2 text-xs text-gray-500">Süre aşımı</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Memnuniyet Skoru</span>
            <Star className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.averageSatisfaction || 0}</div>
          <p className="mt-2 text-xs text-gray-500">5 üzerinden ortalama</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">DÖF Durum Özeti</h2>
            <button
              onClick={() => navigate('/quality-management/dof')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-gray-900">Açık</span>
              </div>
              <span className="text-2xl font-bold text-red-600">{stats?.openDOF || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-gray-900">Devam Ediyor</span>
              </div>
              <span className="text-2xl font-bold text-yellow-600">{stats?.inProgressDOF || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900">Kapatıldı</span>
              </div>
              <span className="text-2xl font-bold text-green-600">{stats?.closedDOF || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Tetkik Durumu</h2>
            <button
              onClick={() => navigate('/quality-management/audits')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Planlanan</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">{stats?.plannedAudits || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-gray-900">Devam Ediyor</span>
              </div>
              <span className="text-2xl font-bold text-yellow-600">{stats?.inProgressAudits || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900">Tamamlandı</span>
              </div>
              <span className="text-2xl font-bold text-green-600">{stats?.completedAudits || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Erişim</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/#/quality-management/processes"
            className="block p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Süreç Yönetimi</div>
                <div className="text-sm text-gray-600">{stats?.totalProcesses || 0} aktif süreç</div>
              </div>
            </div>
          </a>
          <a
            href="/#/quality-management/documents"
            className="block p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Doküman Yönetimi</div>
                <div className="text-sm text-gray-600">Prosedür ve talimatlar</div>
              </div>
            </div>
          </a>
          <a
            href="/#/quality-management/customer-satisfaction"
            className="block p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <Star className="w-6 h-6 text-yellow-600" />
              <div>
                <div className="font-medium text-gray-900">Müşteri Memnuniyeti</div>
                <div className="text-sm text-gray-600">{stats?.totalFeedback || 0} geri bildirim</div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
