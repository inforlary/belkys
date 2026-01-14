import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Award,
  ArrowRight,
  BarChart3,
  FileText,
  ClipboardCheck,
  Star
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

interface DashboardStats {
  complianceScore: number;
  totalActions: number;
  completedActions: number;
  overdueActions: number;
  complianceLevel: 'İyi' | 'Orta' | 'Düşük';
  activePlanName: string | null;
}

interface ComponentCompliance {
  name: string;
  compliance: number;
}

interface ActionStatusData {
  status: string;
  count: number;
  color: string;
}

interface StandardCompliance {
  code: string;
  name: string;
  compliance: number;
  completedActions: number;
  totalActions: number;
  status: 'good' | 'medium' | 'low';
}

interface IKYKDecision {
  id: string;
  decision_number: string;
  title: string;
  responsible_department: string;
  deadline: string;
  status: string;
}

interface MeetingInfo {
  meeting_date: string;
  year: number;
  meeting_number: number;
  next_meeting?: string;
}

interface AssuranceStats {
  total_departments: number;
  completed_statements: number;
  pending_departments: string[];
  executive_status: string;
}

interface QualityDashboardStats {
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

export default function InternalControlDashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [componentData, setComponentData] = useState<ComponentCompliance[]>([]);
  const [actionStatusData, setActionStatusData] = useState<ActionStatusData[]>([]);
  const [standardsData, setStandardsData] = useState<StandardCompliance[]>([]);
  const [ikykDecisions, setIkykDecisions] = useState<IKYKDecision[]>([]);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [assuranceStats, setAssuranceStats] = useState<AssuranceStats | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [qualityStats, setQualityStats] = useState<QualityDashboardStats | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      const orgId = profile.organization_id;

      const activePlan = await supabase
        .from('ic_action_plans')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('status', 'ACTIVE')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activePlan.data) {
        setLoading(false);
        return;
      }

      const planId = activePlan.data.id;
      setActivePlanId(planId);

      await Promise.all([
        fetchStats(orgId, planId, activePlan.data.name),
        fetchComponentCompliance(orgId, planId),
        fetchActionStatus(orgId, planId),
        fetchStandardsCompliance(orgId, planId),
        fetchIKYKDecisions(orgId),
        fetchAssuranceStats(orgId),
        fetchQualityStats(orgId)
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (orgId: string, planId: string, planName: string) => {
    const { data: assessments } = await supabase
      .from('ic_condition_assessments')
      .select('compliance_score')
      .eq('organization_id', orgId)
      .eq('action_plan_id', planId)
      .not('compliance_score', 'is', null);

    const avgScore = assessments && assessments.length > 0
      ? assessments.reduce((sum, a) => sum + (a.compliance_score || 0), 0) / assessments.length
      : 0;

    const complianceScore = Math.round(avgScore * 20);

    const { data: actions } = await supabase
      .from('ic_actions')
      .select('id, status, target_date')
      .eq('organization_id', orgId)
      .eq('action_plan_id', planId);

    const totalActions = actions?.length || 0;
    const completedActions = actions?.filter(a => a.status === 'COMPLETED').length || 0;
    const today = new Date().toISOString().split('T')[0];
    const overdueActions = actions?.filter(a =>
      a.target_date &&
      a.target_date < today &&
      a.status !== 'COMPLETED'
    ).length || 0;

    let complianceLevel: 'İyi' | 'Orta' | 'Düşük' = 'Düşük';
    if (complianceScore >= 80) complianceLevel = 'İyi';
    else if (complianceScore >= 60) complianceLevel = 'Orta';

    setStats({
      complianceScore,
      totalActions,
      completedActions,
      overdueActions,
      complianceLevel,
      activePlanName: planName
    });
  };

  const fetchComponentCompliance = async (orgId: string, planId: string) => {
    const { data } = await supabase
      .from('ic_components')
      .select(`
        id,
        name,
        ic_standards!inner (
          id,
          ic_general_conditions!inner (
            id,
            ic_condition_assessments!inner (
              compliance_score
            )
          )
        )
      `)
      .eq('ic_standards.ic_general_conditions.ic_condition_assessments.organization_id', orgId)
      .eq('ic_standards.ic_general_conditions.ic_condition_assessments.action_plan_id', planId)
      .is('organization_id', null);

    const componentScores: { [key: string]: number[] } = {};

    data?.forEach((component: any) => {
      const scores: number[] = [];
      component.ic_standards?.forEach((standard: any) => {
        standard.ic_general_conditions?.forEach((condition: any) => {
          condition.ic_condition_assessments?.forEach((assessment: any) => {
            if (assessment.compliance_score) {
              scores.push(assessment.compliance_score);
            }
          });
        });
      });
      if (scores.length > 0) {
        componentScores[component.name] = scores;
      }
    });

    const componentData = Object.entries(componentScores).map(([name, scores]) => ({
      name,
      compliance: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20)
    }));

    setComponentData(componentData);
  };

  const fetchActionStatus = async (orgId: string, planId: string) => {
    const { data } = await supabase
      .from('ic_actions')
      .select('status')
      .eq('organization_id', orgId)
      .eq('action_plan_id', planId);

    const statusCounts: { [key: string]: number } = {};
    data?.forEach(action => {
      statusCounts[action.status] = (statusCounts[action.status] || 0) + 1;
    });

    const statusMap = {
      'COMPLETED': { label: 'Tamamlandı', color: '#10b981' },
      'IN_PROGRESS': { label: 'Devam Eden', color: '#3b82f6' },
      'NOT_STARTED': { label: 'Başlamadı', color: '#94a3b8' },
      'DELAYED': { label: 'Gecikmiş', color: '#ef4444' },
      'ONGOING': { label: 'Sürekli', color: '#8b5cf6' }
    };

    const actionData = Object.entries(statusCounts).map(([status, count]) => ({
      status: statusMap[status as keyof typeof statusMap]?.label || status,
      count,
      color: statusMap[status as keyof typeof statusMap]?.color || '#64748b'
    }));

    setActionStatusData(actionData);
  };

  const fetchStandardsCompliance = async (orgId: string, planId: string) => {
    const { data } = await supabase
      .from('ic_standards')
      .select(`
        id,
        code,
        name,
        ic_general_conditions!inner (
          id,
          ic_condition_assessments (
            compliance_score,
            organization_id,
            action_plan_id
          ),
          ic_actions (
            status,
            organization_id,
            action_plan_id
          )
        )
      `)
      .is('organization_id', null)
      .limit(10);

    const standardsCompliance: StandardCompliance[] = [];

    data?.forEach((standard: any) => {
      let totalScore = 0;
      let scoreCount = 0;
      let completedActions = 0;
      let totalActions = 0;

      standard.ic_general_conditions?.forEach((condition: any) => {
        condition.ic_condition_assessments
          ?.filter((a: any) => a.organization_id === orgId && a.action_plan_id === planId)
          .forEach((assessment: any) => {
            if (assessment.compliance_score) {
              totalScore += assessment.compliance_score;
              scoreCount++;
            }
          });

        const conditionActions = condition.ic_actions?.filter(
          (a: any) => a.organization_id === orgId && a.action_plan_id === planId
        );
        totalActions += conditionActions?.length || 0;
        completedActions += conditionActions?.filter((a: any) => a.status === 'COMPLETED').length || 0;
      });

      if (scoreCount > 0) {
        const compliance = Math.round((totalScore / scoreCount) * 20);
        let status: 'good' | 'medium' | 'low' = 'low';
        if (compliance >= 80) status = 'good';
        else if (compliance >= 60) status = 'medium';

        standardsCompliance.push({
          code: standard.code,
          name: standard.name,
          compliance,
          completedActions,
          totalActions,
          status
        });
      }
    });

    setStandardsData(standardsCompliance);
  };

  const fetchIKYKDecisions = async (orgId: string) => {
    const { data: latestMeeting } = await supabase
      .from('ic_meetings')
      .select('id, meeting_date, year, meeting_number')
      .eq('organization_id', orgId)
      .eq('status', 'COMPLETED')
      .order('meeting_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMeeting) {
      setMeetingInfo({
        meeting_date: latestMeeting.meeting_date,
        year: latestMeeting.year,
        meeting_number: latestMeeting.meeting_number
      });

      const { data: decisions } = await supabase
        .from('ic_meeting_decisions')
        .select('id, decision_number, title, responsible_department, deadline, status')
        .eq('meeting_id', latestMeeting.id)
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .order('deadline', { ascending: true })
        .limit(3);

      setIkykDecisions(decisions || []);
    }
  };

  const fetchAssuranceStats = async (orgId: string) => {
    const currentYear = new Date().getFullYear();

    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', orgId);

    const { data: statements } = await supabase
      .from('ic_assurance_statements')
      .select('id, department_id, status')
      .eq('organization_id', orgId)
      .eq('statement_year', currentYear)
      .eq('statement_type', 'DEPARTMENT');

    const completedDeptIds = statements
      ?.filter(s => s.status === 'APPROVED')
      .map(s => s.department_id) || [];

    const pendingDepts = departments
      ?.filter(d => !completedDeptIds.includes(d.id))
      .map(d => d.name) || [];

    const { data: executiveStatement } = await supabase
      .from('ic_assurance_statements')
      .select('status')
      .eq('organization_id', orgId)
      .eq('statement_year', currentYear)
      .eq('statement_type', 'EXECUTIVE')
      .maybeSingle();

    setAssuranceStats({
      total_departments: departments?.length || 0,
      completed_statements: completedDeptIds.length,
      pending_departments: pendingDepts,
      executive_status: executiveStatement?.status || 'Beklemede'
    });
  };

  const fetchQualityStats = async (orgId: string) => {
    try {
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

      setQualityStats({
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
      console.error('Error loading quality stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!activePlanId) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Aktif Eylem Planı Bulunamadı</h3>
        <p className="text-gray-600 mb-4">Dashboard verilerini görmek için bir eylem planı oluşturun ve aktif edin.</p>
        <button
          onClick={() => navigate('/internal-control/action-plans')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Eylem Planları
        </button>
      </div>
    );
  }

  const getComplianceIcon = () => {
    if (stats!.complianceLevel === 'İyi') return '🟢';
    if (stats!.complianceLevel === 'Orta') return '🟡';
    return '🔴';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">İç Kontrol</h1>
        <p className="mt-2 text-gray-600">İç kontrol sistemi özet durumu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">UYUM SKORU</p>
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            %{stats?.complianceScore || 0}
          </p>
          <p className="text-sm text-gray-600">
            {getComplianceIcon()} {stats?.complianceLevel}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">TOPLAM EYLEM</p>
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {stats?.totalActions || 0}
          </p>
          <p className="text-sm text-gray-600">Aktif plandaki</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">TAMAMLANAN</p>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {stats?.completedActions || 0}
          </p>
          <p className="text-sm text-gray-600">
            ✅ %{stats?.totalActions ? Math.round((stats.completedActions / stats.totalActions) * 100) : 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">GECİKEN</p>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {stats?.overdueActions || 0}
          </p>
          <p className="text-sm text-gray-600">⚠️ Gecikmiş</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">BİLEŞEN UYUM DURUMU</h3>
          {componentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={componentData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Radar
                  name="Uyum %"
                  dataKey="compliance"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.5}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Değerlendirme verisi bulunamadı
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">EYLEM DURUMU</h3>
          {actionStatusData.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={actionStatusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    dataKey="status"
                    type="category"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {actionStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Aktif Plan:</span> {stats?.activePlanName}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Eylem verisi bulunamadı
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">STANDART UYUM DURUMU</h3>
            <button
              onClick={() => navigate('/internal-control/standards')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">Standart</th>
                  <th className="text-center py-2 font-medium text-gray-600">Uyum</th>
                  <th className="text-center py-2 font-medium text-gray-600">Eylem</th>
                  <th className="text-center py-2 font-medium text-gray-600">Durum</th>
                </tr>
              </thead>
              <tbody>
                {standardsData.slice(0, 8).map((standard, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      <span className="font-medium">{standard.code}</span> - {standard.name.substring(0, 30)}...
                    </td>
                    <td className="text-center py-2 font-semibold">{standard.compliance}%</td>
                    <td className="text-center py-2 text-gray-600">
                      {standard.completedActions}/{standard.totalActions}
                    </td>
                    <td className="text-center py-2">
                      {standard.status === 'good' && '🟢'}
                      {standard.status === 'medium' && '🟡'}
                      {standard.status === 'low' && '🔴'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {standardsData.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                Standart değerlendirmesi bulunamadı
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">İKİYK KARAR TAKİBİ</h3>
            <button
              onClick={() => navigate('/internal-control/ikyk')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {meetingInfo ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Son Toplantı:</span>{' '}
                  {new Date(meetingInfo.meeting_date).toLocaleDateString('tr-TR')} -
                  Toplantı No: {meetingInfo.year}/{meetingInfo.meeting_number}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Açık Kararlar:</p>
                <div className="space-y-2">
                  {ikykDecisions.length > 0 ? (
                    ikykDecisions.map((decision) => (
                      <div key={decision.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">
                              {decision.decision_number} - {decision.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Sorumlu: {decision.responsible_department || 'Belirtilmemiş'}
                            </p>
                            <p className="text-xs text-gray-600">
                              Termin: {new Date(decision.deadline).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            decision.status === 'IN_PROGRESS'
                              ? 'bg-yellow-100 text-yellow-800'
                              : new Date(decision.deadline) < new Date()
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {decision.status === 'IN_PROGRESS' ? '🟡 Devam Ediyor' :
                             new Date(decision.deadline) < new Date() ? '⚠️ Gecikmiş' : '🔵 Açık'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Açık karar bulunamadı
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              Toplantı kaydı bulunamadı
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">
              GÜVENCE BEYANLARI - {new Date().getFullYear()}
            </h3>
          </div>
          <button
            onClick={() => navigate('/internal-control/assurance-statements')}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Detay <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {assuranceStats ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Birim Beyanları:</span>
                <span className="font-medium">
                  {assuranceStats.completed_statements}/{assuranceStats.total_departments} tamamlandı
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all flex items-center justify-end px-2"
                  style={{
                    width: `${assuranceStats.total_departments > 0
                      ? (assuranceStats.completed_statements / assuranceStats.total_departments) * 100
                      : 0}%`
                  }}
                >
                  <span className="text-xs text-white font-medium">
                    {assuranceStats.total_departments > 0
                      ? Math.round((assuranceStats.completed_statements / assuranceStats.total_departments) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Üst Yönetici:</span>
              <span className={`text-sm font-medium ${
                assuranceStats.executive_status === 'APPROVED'
                  ? 'text-green-600'
                  : 'text-gray-600'
              }`}>
                {assuranceStats.executive_status === 'APPROVED' ? '✅ Onaylandı' : 'Beklemede'}
              </span>
            </div>

            {assuranceStats.pending_departments.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Eksik Beyanlar:</span>
                </p>
                <p className="text-sm text-gray-900">
                  {assuranceStats.pending_departments.join(', ')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-gray-500">
            Güvence beyanı verisi bulunamadı
          </div>
        )}
      </div>

      <div className="border-t-4 border-blue-100 pt-6 mt-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Süreç Yönetimi</h2>
          <p className="text-gray-600">Kalite yönetim sistemi durum özeti</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Açık DÖF</span>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{qualityStats?.openDOF || 0}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>Devam: {qualityStats?.inProgressDOF || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Kapalı: {qualityStats?.closedDOF || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tetkikler</span>
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {qualityStats?.completedAudits || 0} / {(qualityStats?.plannedAudits || 0) + (qualityStats?.inProgressAudits || 0) + (qualityStats?.completedAudits || 0)}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Tamamlanan / Toplam
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Aktif Süreçler</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{qualityStats?.totalProcesses || 0}</div>
            <p className="mt-2 text-xs text-gray-500">Tanımlı süreç</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Memnuniyet Skoru</span>
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{qualityStats?.averageSatisfaction || 0}</div>
            <p className="mt-2 text-xs text-gray-500">5 üzerinden ortalama</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">DÖF Durum Özeti</h2>
              <button
                onClick={() => navigate('/internal-control/dof')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Tümünü Gör
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-gray-900">Açık</span>
                </div>
                <span className="text-2xl font-bold text-red-600">{qualityStats?.openDOF || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-gray-900">Devam Ediyor</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">{qualityStats?.inProgressDOF || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Kapatıldı</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{qualityStats?.closedDOF || 0}</span>
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
                <span className="text-2xl font-bold text-blue-600">{qualityStats?.plannedAudits || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-gray-900">Devam Ediyor</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">{qualityStats?.inProgressAudits || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Tamamlandı</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{qualityStats?.completedAudits || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Erişim</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/internal-control/processes')}
              className="text-left p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Süreç Yönetimi</div>
                  <div className="text-sm text-gray-600">{qualityStats?.totalProcesses || 0} aktif süreç</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/quality-management/documents')}
              className="text-left p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Doküman Yönetimi</div>
                  <div className="text-sm text-gray-600">Prosedür ve talimatlar</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/quality-management/customer-satisfaction')}
              className="text-left p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-yellow-600" />
                <div>
                  <div className="font-medium text-gray-900">Müşteri Memnuniyeti</div>
                  <div className="text-sm text-gray-600">{qualityStats?.totalFeedback || 0} geri bildirim</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
