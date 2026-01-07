import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

interface DashboardStats {
  overall_compliance: number;
  previous_compliance: number;
  active_plan: any;
  delayed_actions: number;
  pending_decisions: number;
}

interface ComponentScore {
  component: string;
  score: number;
  previous: number;
}

interface ActionStatus {
  name: string;
  value: number;
  color: string;
}

interface DelayedAction {
  id: string;
  code: string;
  title: string;
  standard_code: string;
  department_name: string;
  target_date: string;
  progress: number;
  days_delayed: number;
}

interface UpcomingAction {
  id: string;
  code: string;
  title: string;
  target_date: string;
  days_remaining: number;
}

export default function InternalControl() {
  const { profile } = useAuth();
  const navigate = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [componentScores, setComponentScores] = useState<ComponentScore[]>([]);
  const [actionStatuses, setActionStatuses] = useState<ActionStatus[]>([]);
  const [delayedActions, setDelayedActions] = useState<DelayedAction[]>([]);
  const [upcomingActions, setUpcomingActions] = useState<UpcomingAction[]>([]);
  const [nextMeeting, setNextMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllStandards, setShowAllStandards] = useState(false);

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
        loadComponentScores(),
        loadActionStatuses(),
        loadDelayedActions(),
        loadUpcomingActions(),
        loadNextMeeting()
      ]);
    } catch (error) {
      console.error('Dashboard verisi yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const { data: latestAssessment } = await supabase
      .from('ic_assessments')
      .select('id, overall_compliance_percent')
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'APPROVED')
      .order('year', { ascending: false })
      .order('period', { ascending: false })
      .limit(1)
      .single();

    const { data: previousAssessment } = await supabase
      .from('ic_assessments')
      .select('overall_compliance_percent')
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'APPROVED')
      .order('year', { ascending: false })
      .order('period', { ascending: false })
      .limit(1)
      .range(1, 1)
      .single();

    const { data: activePlan } = await supabase
      .from('ic_action_plans')
      .select('*, actions:ic_actions(id, status)')
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'ACTIVE')
      .single();

    const { count: delayedCount } = await supabase
      .from('ic_actions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'DELAYED');

    const { count: pendingDecisions } = await supabase
      .from('ic_meeting_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    setStats({
      overall_compliance: latestAssessment?.overall_compliance_percent || 0,
      previous_compliance: previousAssessment?.overall_compliance_percent || 0,
      active_plan: activePlan,
      delayed_actions: delayedCount || 0,
      pending_decisions: pendingDecisions || 0
    });
  };

  const loadComponentScores = async () => {
    const { data: latestAssessment } = await supabase
      .from('ic_assessments')
      .select('id')
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'APPROVED')
      .order('year', { ascending: false })
      .order('period', { ascending: false })
      .limit(1)
      .single();

    if (!latestAssessment) {
      setComponentScores([]);
      return;
    }

    const { data: details } = await supabase
      .from('ic_assessment_details')
      .select(`
        compliance_level,
        standard:ic_standards(
          code,
          component:ic_components(code, name)
        )
      `)
      .eq('assessment_id', latestAssessment.id);

    const componentMap = new Map<string, { total: number; count: number }>();

    details?.forEach(detail => {
      if (detail.standard?.component) {
        const name = detail.standard.component.name;
        if (!componentMap.has(name)) {
          componentMap.set(name, { total: 0, count: 0 });
        }
        const current = componentMap.get(name)!;
        current.total += detail.compliance_level;
        current.count += 1;
      }
    });

    const scores = Array.from(componentMap.entries()).map(([name, data]) => ({
      component: name,
      score: (data.total / data.count) * 20,
      previous: (data.total / data.count) * 20
    }));

    setComponentScores(scores);
  };

  const loadActionStatuses = async () => {
    if (!stats?.active_plan) return;

    const { data: actions } = await supabase
      .from('ic_actions')
      .select('status')
      .eq('action_plan_id', stats.active_plan.id);

    const statusMap = new Map<string, number>();
    actions?.forEach(action => {
      statusMap.set(action.status, (statusMap.get(action.status) || 0) + 1);
    });

    const statuses: ActionStatus[] = [
      { name: 'Tamamlandı', value: statusMap.get('COMPLETED') || 0, color: '#22C55E' },
      { name: 'Devam Eden', value: statusMap.get('IN_PROGRESS') || 0, color: '#3B82F6' },
      { name: 'Geciken', value: statusMap.get('DELAYED') || 0, color: '#EF4444' },
      { name: 'Başlamadı', value: statusMap.get('NOT_STARTED') || 0, color: '#9CA3AF' }
    ].filter(s => s.value > 0);

    setActionStatuses(statuses);
  };

  const loadDelayedActions = async () => {
    const today = new Date().toISOString();

    const { data } = await supabase
      .from('ic_actions')
      .select(`
        id,
        code,
        title,
        target_date,
        progress,
        standard:ic_standards(code),
        department:departments(name)
      `)
      .or(`status.eq.DELAYED,and(target_date.lt.${today},status.not.in.(COMPLETED,CANCELLED))`)
      .order('target_date', { ascending: true })
      .limit(5);

    const delayed = (data || []).map(action => {
      const targetDate = new Date(action.target_date);
      const daysDelayed = Math.floor((new Date().getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: action.id,
        code: action.code,
        title: action.title,
        standard_code: action.standard?.code || '-',
        department_name: action.department?.name || 'Tüm Birimler',
        target_date: action.target_date,
        progress: action.progress || 0,
        days_delayed: daysDelayed
      };
    });

    setDelayedActions(delayed);
  };

  const loadUpcomingActions = async () => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 30);

    const { data } = await supabase
      .from('ic_actions')
      .select('id, code, title, target_date')
      .gte('target_date', today.toISOString())
      .lte('target_date', futureDate.toISOString())
      .not('status', 'in', '(COMPLETED,CANCELLED)')
      .order('target_date', { ascending: true })
      .limit(3);

    const upcoming = (data || []).map(action => {
      const targetDate = new Date(action.target_date);
      const daysRemaining = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: action.id,
        code: action.code,
        title: action.title,
        target_date: action.target_date,
        days_remaining: daysRemaining
      };
    });

    setUpcomingActions(upcoming);
  };

  const loadNextMeeting = async () => {
    const { data } = await supabase
      .from('ic_meetings')
      .select(`
        id,
        meeting_code,
        meeting_type,
        meeting_date,
        location,
        agenda_items:ic_meeting_agenda_items(count),
        decisions:ic_meeting_decisions(count)
      `)
      .eq('organization_id', profile?.organization_id)
      .gte('meeting_date', new Date().toISOString())
      .eq('status', 'PLANNED')
      .order('meeting_date', { ascending: true })
      .limit(1)
      .single();

    setNextMeeting(data);
  };

  const calculatePlanProgress = () => {
    if (!stats?.active_plan?.actions) return 0;
    const total = stats.active_plan.actions.length;
    const completed = stats.active_plan.actions.filter((a: any) => a.status === 'COMPLETED').length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const complianceChange = stats ? stats.overall_compliance - stats.previous_compliance : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-600" />
            İç Kontrol Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Kamu İç Kontrol Standartları uyumluluk yönetimi</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/internal-control/standards')}
            className="btn-secondary text-sm"
          >
            Standartlar
          </button>
          <button
            onClick={() => navigate('/internal-control/action-plans')}
            className="btn-secondary text-sm"
          >
            Eylem Planı
          </button>
          <button
            onClick={() => navigate('/internal-control/assessments')}
            className="btn-secondary text-sm"
          >
            Değerlendirme
          </button>
          <button
            onClick={() => navigate('/internal-control/meetings')}
            className="btn-secondary text-sm"
          >
            İKİYK
          </button>
          <button
            onClick={() => navigate('/internal-control/assurance')}
            className="btn-primary text-sm"
          >
            Güvence Beyanı
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          onClick={() => navigate('/internal-control/assessments')}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Genel Uyum</span>
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            %{stats?.overall_compliance?.toFixed(0) || 0}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3 mb-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${stats?.overall_compliance || 0}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {complianceChange > 0 ? (
              <>
                <TrendingUp className="w-3 h-3 text-green-600" />
                <span className="text-green-600">+{complianceChange.toFixed(1)}%</span>
              </>
            ) : complianceChange < 0 ? (
              <>
                <TrendingDown className="w-3 h-3 text-red-600" />
                <span className="text-red-600">{complianceChange.toFixed(1)}%</span>
              </>
            ) : (
              <span>önceki dönem</span>
            )}
          </div>
        </div>

        <div
          onClick={() => stats?.active_plan && navigate(`/internal-control/action-plans/${stats.active_plan.id}`)}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Aktif Eylem Planı</span>
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
          </div>
          {stats?.active_plan ? (
            <>
              <div className="text-xl font-bold text-gray-900">
                {stats.active_plan.plan_name}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="text-2xl font-bold text-blue-600">
                  %{calculatePlanProgress()}
                </div>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xs text-gray-500">ilerleme</div>
            </>
          ) : (
            <div className="text-sm text-gray-400">Aktif plan yok</div>
          )}
        </div>

        <div
          onClick={() => navigate('/internal-control/action-plans?status=DELAYED')}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Geciken Eylem</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">
            {stats?.delayed_actions || 0}
          </div>
          {stats?.delayed_actions && stats.delayed_actions > 0 ? (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-2">
              <TrendingUp className="w-3 h-3" />
              <span>Dikkat gerekli</span>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-2">Geciken yok</div>
          )}
        </div>

        <div
          onClick={() => navigate('/internal-control/meetings?tab=decisions&status=PENDING')}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">İKİYK Kararı</span>
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {stats?.pending_decisions || 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">Bekleyen karar</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Bileşen Bazlı Uyum Durumu</h3>
            <button
              onClick={() => navigate('/internal-control/assessments')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Detaylı Değerlendirme
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {componentScores.length > 0 ? (
            <div className="space-y-3">
              {componentScores.map(item => (
                <div key={item.component}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{item.component}</span>
                    <span className="font-semibold text-gray-900">
                      %{item.score.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Henüz onaylı değerlendirme yok
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Eylem Durumu</h3>
            <button
              onClick={() => stats?.active_plan && navigate(`/internal-control/action-plans/${stats.active_plan.id}`)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Eylem Planına Git
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {actionStatuses.length > 0 ? (
            <>
              <div className="flex justify-center mb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={actionStatuses}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {actionStatuses.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {actionStatuses.map(status => (
                  <div key={status.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-sm text-gray-700">
                      {status.name}: <span className="font-semibold">{status.value}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Plan İlerlemesi</span>
                  <span className="font-semibold text-gray-900">
                    %{calculatePlanProgress()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${calculatePlanProgress()}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aktif eylem planı yok
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Geciken Eylemler
              {delayedActions.length > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                  {delayedActions.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => navigate('/internal-control/action-plans?status=DELAYED')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {delayedActions.length > 0 ? (
            <div className="space-y-3">
              {delayedActions.map(action => (
                <div
                  key={action.id}
                  onClick={() => navigate(`/internal-control/actions/${action.id}`)}
                  className="p-3 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {action.code} - {action.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 mt-1 flex-wrap">
                        <span>Standart: {action.standard_code}</span>
                        <span>•</span>
                        <span>Birim: {action.department_name}</span>
                        <span>•</span>
                        <span className="text-red-600 font-medium">
                          {action.days_delayed} gün gecikti
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          Hedef: {new Date(action.target_date).toLocaleDateString('tr-TR')}
                        </span>
                        <span className="text-xs text-gray-700">
                          İlerleme: %{action.progress}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Geciken eylem bulunmuyor
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Yaklaşan Terminler ve İKİYK
          </h3>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Yaklaşan Terminler</h4>
            {upcomingActions.length > 0 ? (
              <div className="space-y-2">
                {upcomingActions.map(action => (
                  <div
                    key={action.id}
                    onClick={() => navigate(`/internal-control/actions/${action.id}`)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 font-medium truncate">
                        {action.code} - {action.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(action.target_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    <span className="text-xs text-blue-600 font-medium flex-shrink-0">
                      {action.days_remaining} gün
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Yaklaşan termin yok</div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Sonraki İKİYK Toplantısı</h4>
            {nextMeeting ? (
              <div
                onClick={() => navigate(`/internal-control/meetings/${nextMeeting.id}`)}
                className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {nextMeeting.meeting_code}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {new Date(nextMeeting.meeting_date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {nextMeeting.location}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span>Gündem: {nextMeeting.agenda_items?.length || 0} madde</span>
                      <span>Bekleyen Karar: {stats?.pending_decisions || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Planlanmış toplantı yok</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
