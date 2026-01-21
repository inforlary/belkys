import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import { Target, Flag, BarChart3, Briefcase, TrendingUp, Users, AlertTriangle, Bell, Zap, FileText } from 'lucide-react';
import KPICard from '../components/dashboard/KPICard';
import RiskAlertWidget from '../components/dashboard/RiskAlertWidget';
import RiskAppetiteWidget from '../components/dashboard/RiskAppetiteWidget';
import PerformanceTrendChart from '../components/dashboard/PerformanceTrendChart';
import NotificationWidget from '../components/dashboard/NotificationWidget';
import Button from '../components/ui/Button';
import { useLocation } from '../hooks/useLocation';
import { calculateGoalProgress } from '../utils/progressCalculations';

interface Stats {
  totalObjectives: number;
  totalIndicators: number;
  totalActivities: number;
  avgAchievement: number;
  activeUsers: number;
  pendingApprovals: number;
  pendingActionPlans: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<Stats>({
    totalObjectives: 0,
    totalIndicators: 0,
    totalActivities: 0,
    avgAchievement: 0,
    activeUsers: 0,
    pendingApprovals: 0,
    pendingActionPlans: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadStats();
  }, [profile]);

  const loadStats = async () => {
    if (!profile?.organization_id) return;

    try {
      const currentYear = new Date().getFullYear();

      const [objectivesRes, indicatorsRes, activitiesRes, usersRes, approvalsRes, actionPlansRes] = await Promise.all([
        supabase
          .from('objectives')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicators')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicator_data_entries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('status', 'submitted'),
        supabase
          .from('ic_action_plans')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('status', 'DRAFT')
      ]);

      const [goalsDataRes, indicatorsDataRes, targetsRes, entriesRes] = await Promise.all([
        supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicators')
          .select('id, goal_id, baseline_value, target_value, calculation_method, goal_impact_percentage')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicator_targets')
          .select('indicator_id, target_value')
          .eq('year', currentYear),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .eq('status', 'approved')
      ]);

      let avgAchievement = 0;
      if (goalsDataRes.data && indicatorsDataRes.data && targetsRes.data && entriesRes.data) {
        const goalProgresses: number[] = [];
        const targetsByIndicator: Record<string, number> = {};

        targetsRes.data.forEach(target => {
          targetsByIndicator[target.indicator_id] = target.target_value;
        });

        goalsDataRes.data.forEach(goal => {
          const goalIndicators = indicatorsDataRes.data.filter(ind => ind.goal_id === goal.id);

          if (goalIndicators.length > 0) {
            const indicatorsWithTargets = goalIndicators.map(ind => ({
              id: ind.id,
              goal_id: ind.goal_id,
              baseline_value: ind.baseline_value,
              target_value: ind.target_value,
              yearly_target: targetsByIndicator[ind.id] || ind.target_value,
              calculation_method: ind.calculation_method,
              goal_impact_percentage: ind.goal_impact_percentage
            }));

            const goalProgress = calculateGoalProgress(goal.id, indicatorsWithTargets, entriesRes.data);
            goalProgresses.push(goalProgress);
          }
        });

        if (goalProgresses.length > 0) {
          avgAchievement = goalProgresses.reduce((sum, val) => sum + val, 0) / goalProgresses.length;
        }
      }

      setStats({
        totalObjectives: objectivesRes.count || 0,
        totalIndicators: indicatorsRes.count || 0,
        totalActivities: activitiesRes.count || 0,
        avgAchievement: Math.round(avgAchievement),
        activeUsers: usersRes.count || 0,
        pendingApprovals: approvalsRes.count || 0,
        pendingActionPlans: actionPlansRes.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ana Sayfa</h1>
          <p className="text-slate-600 mt-1">Kurumsal performans yönetim sisteminize genel bakış</p>
        </div>
        <Button
          onClick={() => navigate('enhanced-dashboard')}
          icon={Zap}
          variant="outline"
        >
          Detaylı Analiz
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Toplam Amaçlar"
          value={stats.totalObjectives}
          icon={Target}
          color="blue"
          subtitle="Aktif stratejik amaçlar"
        />

        <KPICard
          title="Performans Göstergeleri"
          value={stats.totalIndicators}
          icon={BarChart3}
          color="green"
          subtitle="İzlenen KPI sayısı"
        />

        <KPICard
          title="Ortalama Başarı"
          value={`%${stats.avgAchievement}`}
          icon={TrendingUp}
          color="purple"
          subtitle="Yıl içi genel performans"
        />

        <KPICard
          title="Faaliyetler"
          value={stats.totalActivities}
          icon={Briefcase}
          color="yellow"
          subtitle="Toplam faaliyet sayısı"
        />

        <KPICard
          title="Aktif Kullanıcılar"
          value={stats.activeUsers}
          icon={Users}
          color="blue"
          subtitle="Sistemdeki kullanıcılar"
        />

        <KPICard
          title="Bekleyen Onaylar"
          value={stats.pendingApprovals}
          icon={Bell}
          color="red"
          subtitle="Onay bekleyen veri girişleri"
        />

        {profile && (profile.role === 'admin' || profile.role === 'vice_president') && stats.pendingActionPlans > 0 && (
          <div
            onClick={() => navigate('action-plan')}
            className="cursor-pointer"
          >
            <KPICard
              title="Bekleyen Eylem Planları"
              value={stats.pendingActionPlans}
              icon={FileText}
              color="orange"
              subtitle="Onayınızı bekleyen eylem planları"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceTrendChart />
        </div>
        <div>
          <RiskAlertWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskAppetiteWidget />
        <NotificationWidget />

        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hoş Geldiniz</h3>
            <p className="text-slate-600 mb-4">
              Kurumsal Performans Yönetim Sistemi'ne hoş geldiniz. Bu platform ile:
            </p>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start">
                <Flag className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <span>Stratejik amaç ve hedeflerinizi dijital ortamda yönetin</span>
              </li>
              <li className="flex items-start">
                <BarChart3 className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                <span>Performans göstergelerinizi gerçek zamanlı takip edin</span>
              </li>
              <li className="flex items-start">
                <TrendingUp className="w-5 h-5 text-purple-600 mr-2 mt-0.5" />
                <span>Detaylı raporlar ve analizler oluşturun</span>
              </li>
              <li className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                <span>Otomatik risk uyarıları ve bildirimler alın</span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
