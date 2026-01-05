import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  FileText,
  Users,
  Plus
} from 'lucide-react';
import Button from '../components/ui/Button';

interface DashboardStats {
  activeActionPlans: number;
  completedActions: number;
  totalActions: number;
  delayedActions: number;
  complianceScore: number;
  upcomingDeadlines: {
    id: string;
    title: string;
    due_date: string;
    type: string;
  }[];
  componentScores: {
    code: string;
    name: string;
    color: string;
    score: number;
  }[];
  actionStatusDistribution: {
    not_started: number;
    in_progress: number;
    completed: number;
    delayed: number;
    cancelled: number;
  };
  delayedActionsList: {
    id: string;
    code: string;
    title: string;
    responsible_unit: string;
    days_delayed: number;
  }[];
}

export default function ICModuleDashboard() {
  const { user } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.organizationId) return;

    try {
      const { data: actionPlans } = await supabase
        .from('ic_action_plans')
        .select('*')
        .eq('organization_id', user.organizationId)
        .eq('status', 'active');

      const { data: actions } = await supabase
        .from('ic_actions')
        .select(`
          *,
          action_plan:ic_action_plans!inner(organization_id),
          responsible_unit:departments!responsible_unit_id(name)
        `)
        .eq('action_plan.organization_id', user.organizationId);

      const { data: assessments } = await supabase
        .from('ic_standard_assessments')
        .select(`
          *,
          standard:ic_standards!inner(
            component:ic_components!inner(code, name, color)
          )
        `)
        .eq('organization_id', user.organizationId)
        .eq('status', 'approved')
        .order('assessment_date', { ascending: false });

      const componentScores: any = {};
      assessments?.forEach((assessment: any) => {
        const compCode = assessment.standard.component.code;
        if (!componentScores[compCode]) {
          componentScores[compCode] = {
            code: compCode,
            name: assessment.standard.component.name,
            color: assessment.standard.component.color,
            scores: []
          };
        }
        componentScores[compCode].scores.push(assessment.compliance_level);
      });

      const componentScoresArray = Object.values(componentScores).map((comp: any) => ({
        ...comp,
        score: comp.scores.length > 0
          ? Math.round(comp.scores.reduce((a: number, b: number) => a + b, 0) / comp.scores.length * 20)
          : 0
      }));

      const allScores = Object.values(componentScores).flatMap((c: any) => c.scores);
      const overallCompliance = allScores.length > 0
        ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length * 20)
        : 0;

      const actionsByStatus = {
        not_started: actions?.filter(a => a.status === 'not_started').length || 0,
        in_progress: actions?.filter(a => a.status === 'in_progress').length || 0,
        completed: actions?.filter(a => a.status === 'completed').length || 0,
        delayed: actions?.filter(a => a.status === 'delayed').length || 0,
        cancelled: actions?.filter(a => a.status === 'cancelled').length || 0,
      };

      const today = new Date();
      const delayedActionsList = actions
        ?.filter(a => a.status === 'delayed')
        .map(a => ({
          id: a.id,
          code: a.code,
          title: a.title,
          responsible_unit: a.responsible_unit?.name || 'N/A',
          days_delayed: Math.floor((today.getTime() - new Date(a.target_date).getTime()) / (1000 * 60 * 60 * 24))
        }))
        .slice(0, 5) || [];

      const upcomingActions = actions
        ?.filter(a => a.status !== 'completed' && a.status !== 'cancelled')
        .filter(a => {
          const daysUntil = Math.floor((new Date(a.target_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntil >= 0 && daysUntil <= 30;
        })
        .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
        .slice(0, 4)
        .map(a => ({
          id: a.id,
          title: a.title,
          due_date: a.target_date,
          type: 'action'
        })) || [];

      const { data: upcomingMeetings } = await supabase
        .from('ic_ikyk_meetings')
        .select('id, meeting_date')
        .eq('organization_id', user.organizationId)
        .eq('status', 'planned')
        .gte('meeting_date', new Date().toISOString().split('T')[0])
        .lte('meeting_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('meeting_date', { ascending: true })
        .limit(2);

      const upcomingMeetingItems = upcomingMeetings?.map(m => ({
        id: m.id,
        title: 'İKİYK Toplantısı',
        due_date: m.meeting_date,
        type: 'meeting'
      })) || [];

      setStats({
        activeActionPlans: actionPlans?.length || 0,
        completedActions: actionsByStatus.completed,
        totalActions: actions?.length || 0,
        delayedActions: actionsByStatus.delayed,
        complianceScore: overallCompliance,
        componentScores: componentScoresArray,
        actionStatusDistribution: actionsByStatus,
        delayedActionsList,
        upcomingDeadlines: [...upcomingActions, ...upcomingMeetingItems]
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          .slice(0, 4)
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return <div>Veri yüklenemedi</div>;
  }

  const completionRate = stats.totalActions > 0
    ? Math.round((stats.completedActions / stats.totalActions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            İç Kontrol Yönetimi
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kamu İç Kontrol Standartları Tebliği Uyum Yönetimi
          </p>
        </div>
        <Button
          onClick={() => navigate('/internal-control/action-plans/new')}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Eylem Planı
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Aktif Eylem Planı</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeActionPlans}</p>
              <p className="text-xs text-gray-500 mt-1">2024-2026</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tamamlanan Eylemler</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.completedActions}/{stats.totalActions}
              </p>
              <p className="text-xs text-gray-500 mt-1">%{completionRate}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Geciken Eylemler</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.delayedActions}</p>
              {stats.delayedActions > 0 && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Dikkat Gerekli
                </p>
              )}
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Genel Uyum Skoru</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">%{stats.complianceScore}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${stats.complianceScore}%` }}
                />
              </div>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bileşen Bazlı Uyum</h2>
          <div className="space-y-4">
            {stats.componentScores.length > 0 ? (
              stats.componentScores.map((comp) => (
                <div key={comp.code}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{comp.name}</span>
                    <span className="text-sm font-semibold text-gray-900">%{comp.score}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{
                        width: `${comp.score}%`,
                        backgroundColor: comp.color
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Henüz değerlendirme yapılmamış
              </p>
            )}
          </div>
          {stats.componentScores.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/internal-control/assessments')}
              className="w-full mt-4"
            >
              Değerlendirmeye Git
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Eylem Durumu Dağılımı</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-700">Tamamlandı</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats.actionStatusDistribution.completed} (%{stats.totalActions > 0 ? Math.round((stats.actionStatusDistribution.completed / stats.totalActions) * 100) : 0})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-700">Devam Ediyor</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats.actionStatusDistribution.in_progress} (%{stats.totalActions > 0 ? Math.round((stats.actionStatusDistribution.in_progress / stats.totalActions) * 100) : 0})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-700">Gecikmiş</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats.actionStatusDistribution.delayed} (%{stats.totalActions > 0 ? Math.round((stats.actionStatusDistribution.delayed / stats.totalActions) * 100) : 0})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                <span className="text-sm text-gray-700">Başlamadı</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats.actionStatusDistribution.not_started} (%{stats.totalActions > 0 ? Math.round((stats.actionStatusDistribution.not_started / stats.totalActions) * 100) : 0})
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/internal-control/action-plans')}
            className="w-full mt-4"
          >
            Detaylı Rapor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.delayedActionsList.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Geciken Eylemler
            </h2>
            <div className="space-y-3">
              {stats.delayedActionsList.map((action) => (
                <div
                  key={action.id}
                  className="border border-red-200 rounded-lg p-3 hover:bg-red-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/internal-control/actions/${action.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{action.code} - {action.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{action.responsible_unit}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-600">
                      {action.days_delayed} gün gecikme
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/internal-control/action-plans?filter=delayed')}
              className="w-full mt-4"
            >
              Tümünü Gör
            </Button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Yaklaşan Terminler
          </h2>
          <div className="space-y-3">
            {stats.upcomingDeadlines.length > 0 ? (
              stats.upcomingDeadlines.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (item.type === 'meeting') {
                      navigate(`/internal-control/ikyk/${item.id}`);
                    } else {
                      navigate(`/internal-control/actions/${item.id}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {item.type === 'meeting' ? (
                      <Users className="w-4 h-4 text-purple-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-600" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.due_date).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Önümüzdeki 30 günde termin yok
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/internal-control/calendar')}
            className="w-full mt-4"
          >
            Tüm Takvim
          </Button>
        </div>
      </div>
    </div>
  );
}
