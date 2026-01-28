import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3, PieChart, CheckCircle, Clock, AlertTriangle, FileText, Eye, TrendingUp } from 'lucide-react';
import { useLocation } from '../hooks/useLocation';
import LinkedModulesWidget from '../components/internal-control/LinkedModulesWidget';

interface DashboardStats {
  total: number;
  completed: number;
  in_progress: number;
  overdue: number;
  not_started: number;
  completion_rate: number;
}

interface ComponentProgress {
  component_code: string;
  component_name: string;
  total_actions: number;
  avg_progress: number;
}

interface OverdueAction {
  id: string;
  code: string;
  title: string;
  department_name: string;
  target_date: string;
  overdue_days: number;
}

interface PendingApproval {
  id: string;
  code: string;
  title: string;
  department_name: string;
  approval_status: string;
  submitted_at: string;
}

export default function ICActionTracking() {
  const { profile } = useAuth();
  const { navigate } = useLocation();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    completed: 0,
    in_progress: 0,
    overdue: 0,
    not_started: 0,
    completion_rate: 0
  });
  const [componentProgress, setComponentProgress] = useState<ComponentProgress[]>([]);
  const [overdueActions, setOverdueActions] = useState<OverdueAction[]>([]);
  const [dueSoonActions, setDueSoonActions] = useState<OverdueAction[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDashboardData();
    }
  }, [profile?.organization_id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadComponentProgress(),
        loadOverdueActions(),
        loadDueSoonActions(),
        loadPendingApprovals()
      ]);
    } catch (error) {
      console.error('Dashboard verisi yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const { data: actionsData } = await supabase
      .from('ic_actions')
      .select('id, status, progress_percent')
      .eq('organization_id', profile?.organization_id);

    if (actionsData) {
      const total = actionsData.length;
      const completed = actionsData.filter(a => a.status === 'COMPLETED').length;
      const in_progress = actionsData.filter(a => a.status === 'IN_PROGRESS').length;
      const not_started = actionsData.filter(a => a.status === 'NOT_STARTED').length;

      const { data: overdueData } = await supabase
        .from('ic_actions')
        .select('id')
        .eq('organization_id', profile?.organization_id)
        .lt('target_date', new Date().toISOString().split('T')[0])
        .not('status', 'in', '(COMPLETED,CANCELLED)');

      const overdue = overdueData?.length || 0;
      const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      setStats({
        total,
        completed,
        in_progress,
        overdue,
        not_started,
        completion_rate
      });
    }
  };

  const loadComponentProgress = async () => {
    const { data: actionsData } = await supabase
      .from('ic_actions')
      .select(`
        progress_percent,
        ic_general_conditions!ic_actions_condition_id_fkey (
          standard_id
        )
      `)
      .eq('organization_id', profile?.organization_id);

    if (!actionsData) return;

    const standardIds = new Set<string>();
    actionsData.forEach((action: any) => {
      const standardId = action.ic_general_conditions?.standard_id;
      if (standardId) standardIds.add(standardId);
    });

    if (standardIds.size === 0) return;

    const { data: standardsData } = await supabase
      .from('ic_standards')
      .select('id, component_id')
      .in('id', Array.from(standardIds));

    const componentIds = new Set<string>();
    const standardToComponentMap = new Map();
    standardsData?.forEach((std: any) => {
      if (std.component_id) {
        componentIds.add(std.component_id);
        standardToComponentMap.set(std.id, std.component_id);
      }
    });

    const { data: componentsData } = await supabase
      .from('ic_components')
      .select('id, code, name')
      .in('id', Array.from(componentIds));

    const componentsMap = new Map(componentsData?.map((c: any) => [c.id, c]) || []);

    const grouped = actionsData.reduce((acc: any, action: any) => {
      const standardId = action.ic_general_conditions?.standard_id;
      const componentId = standardId ? standardToComponentMap.get(standardId) : null;
      if (!componentId) return acc;

      const component = componentsMap.get(componentId);
      if (!component) return acc;

      const key = component.code;
      if (!acc[key]) {
        acc[key] = {
          component_code: component.code,
          component_name: component.name,
          total_actions: 0,
          total_progress: 0
        };
      }
      acc[key].total_actions++;
      acc[key].total_progress += action.progress_percent || 0;
      return acc;
    }, {});

    const progressData = Object.values(grouped).map((g: any) => ({
      component_code: g.component_code,
      component_name: g.component_name,
      total_actions: g.total_actions,
      avg_progress: Math.round(g.total_progress / g.total_actions)
    }));

    setComponentProgress(progressData);
  };

  const loadOverdueActions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('ic_actions')
      .select(`
        id,
        code,
        title,
        target_date,
        departments!ic_actions_responsible_department_id_fkey(name)
      `)
      .eq('organization_id', profile?.organization_id)
      .lt('target_date', today)
      .not('status', 'in', '(COMPLETED,CANCELLED)')
      .order('target_date', { ascending: true })
      .limit(10);

    if (data) {
      const enriched = data.map((a: any) => ({
        id: a.id,
        code: a.code,
        title: a.title,
        department_name: a.departments?.name || 'Belirtilmemiş',
        target_date: a.target_date,
        overdue_days: Math.floor((new Date().getTime() - new Date(a.target_date).getTime()) / (1000 * 60 * 60 * 24))
      }));
      setOverdueActions(enriched);
    }
  };

  const loadDueSoonActions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data } = await supabase
      .from('ic_actions')
      .select(`
        id,
        code,
        title,
        target_date,
        departments!ic_actions_responsible_department_id_fkey(name)
      `)
      .eq('organization_id', profile?.organization_id)
      .gte('target_date', today)
      .lte('target_date', sevenDaysLater)
      .not('status', 'in', '(COMPLETED,CANCELLED)')
      .order('target_date', { ascending: true })
      .limit(10);

    if (data) {
      const enriched = data.map((a: any) => ({
        id: a.id,
        code: a.code,
        title: a.title,
        department_name: a.departments?.name || 'Belirtilmemiş',
        target_date: a.target_date,
        overdue_days: Math.floor((new Date(a.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }));
      setDueSoonActions(enriched);
    }
  };

  const loadPendingApprovals = async () => {
    const { data } = await supabase
      .from('ic_actions')
      .select(`
        id,
        code,
        title,
        approval_status,
        submitted_at,
        departments!ic_actions_responsible_department_id_fkey(name)
      `)
      .eq('organization_id', profile?.organization_id)
      .in('approval_status', ['birim_onayi_bekliyor', 'yonetim_onayi_bekliyor'])
      .order('submitted_at', { ascending: true });

    if (data) {
      const mapped = data.map((a: any) => ({
        id: a.id,
        code: a.code,
        title: a.title,
        department_name: a.departments?.name || 'Belirtilmemiş',
        approval_status: a.approval_status,
        submitted_at: a.submitted_at
      }));
      setPendingApprovals(mapped);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      birim_onayi_bekliyor: 'Birim Onayı Bekliyor',
      yonetim_onayi_bekliyor: 'Yönetim Onayı Bekliyor'
    };
    return labels[status] || status;
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Eylem Planı Takip</h1>
        <p className="text-gray-600 mt-1">İç kontrol eylem planı ilerleme ve takip ekranı</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Eylem</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tamamlanan</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-xs text-green-600">%{stats.completion_rate}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Devam Eden</p>
              <p className="text-2xl font-bold text-gray-900">{stats.in_progress}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Geciken</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Başlamadı</p>
              <p className="text-2xl font-bold text-gray-900">{stats.not_started}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Bileşen Bazlı İlerleme
          </h3>
          {componentProgress.length > 0 ? (
            <div className="space-y-3">
              {componentProgress.map((comp) => (
                <div key={comp.component_code}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{comp.component_code} - {comp.component_name}</span>
                    <span className="text-gray-600">%{comp.avg_progress}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${comp.avg_progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Henüz eylem bulunmamaktadır.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            Durum Dağılımı
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm">Tamamlanan</span>
              </div>
              <span className="font-semibold">{stats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm">Devam Eden</span>
              </div>
              <span className="font-semibold">{stats.in_progress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-sm">Geciken</span>
              </div>
              <span className="font-semibold">{stats.overdue}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-500"></div>
                <span className="text-sm">Başlamadı</span>
              </div>
              <span className="font-semibold">{stats.not_started}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow">
          <div className="bg-red-50 border-b border-red-200 px-6 py-3">
            <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Geciken Eylemler ({overdueActions.length})
            </h3>
          </div>
          <div className="p-6">
            {overdueActions.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Eylem Kodu</th>
                    <th className="text-left py-2">Birim</th>
                    <th className="text-left py-2">Hedef Tarih</th>
                    <th className="text-right py-2">Gecikme</th>
                    <th className="text-right py-2">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueActions.map(action => (
                    <tr key={action.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-medium">{action.code}</td>
                      <td className="py-2">{action.department_name}</td>
                      <td className="py-2">{new Date(action.target_date).toLocaleDateString('tr-TR')}</td>
                      <td className="py-2 text-right text-red-600">{action.overdue_days} gün</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => navigate(`/ic-action-detail/${action.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-center py-4">Geciken eylem bulunmamaktadır.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
            <h3 className="text-lg font-semibold text-yellow-700 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Yaklaşan Tarihler - 7 Gün İçinde ({dueSoonActions.length})
            </h3>
          </div>
          <div className="p-6">
            {dueSoonActions.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Eylem Kodu</th>
                    <th className="text-left py-2">Birim</th>
                    <th className="text-left py-2">Hedef Tarih</th>
                    <th className="text-right py-2">Kalan</th>
                    <th className="text-right py-2">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {dueSoonActions.map(action => (
                    <tr key={action.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-medium">{action.code}</td>
                      <td className="py-2">{action.department_name}</td>
                      <td className="py-2">{new Date(action.target_date).toLocaleDateString('tr-TR')}</td>
                      <td className="py-2 text-right text-yellow-600">{action.overdue_days} gün</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => navigate(`/ic-action-detail/${action.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-center py-4">7 gün içinde tamamlanması gereken eylem bulunmamaktadır.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <h3 className="text-lg font-semibold text-blue-700">Onay Bekleyenler ({pendingApprovals.length})</h3>
        </div>
        <div className="p-6">
          {pendingApprovals.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Eylem Kodu</th>
                  <th className="text-left py-2">Başlık</th>
                  <th className="text-left py-2">Birim</th>
                  <th className="text-left py-2">Durum</th>
                  <th className="text-left py-2">Gönderim Tarihi</th>
                  <th className="text-right py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map(action => (
                  <tr key={action.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{action.code}</td>
                    <td className="py-2">{action.title}</td>
                    <td className="py-2">{action.department_name}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        action.approval_status === 'birim_onayi_bekliyor' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getStatusLabel(action.approval_status)}
                      </span>
                    </td>
                    <td className="py-2">{action.submitted_at ? new Date(action.submitted_at).toLocaleDateString('tr-TR') : '-'}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => navigate(`/ic-action-detail/${action.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center py-4">Onay bekleyen eylem bulunmamaktadır.</p>
          )}
        </div>
      </div>

      <LinkedModulesWidget />
    </div>
  );
}
