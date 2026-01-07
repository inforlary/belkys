import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Eye,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Filter,
  Download
} from 'lucide-react';
import Modal from '../components/ui/Modal';

interface ActionPlan {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  version: string;
}

interface Action {
  id: string;
  code: string;
  title: string;
  description: string;
  standard_id: string;
  responsible_department_id: string;
  start_date: string;
  target_date: string;
  completed_date: string | null;
  status: string;
  priority: string;
  progress_percent: number;
  expected_output: string;
  required_resources: string;
  ic_standards?: {
    code: string;
    name: string;
    ic_component_id: string;
  };
  departments?: {
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface Standard {
  id: string;
  code: string;
  name: string;
  ic_component_id: string;
}

interface Component {
  id: string;
  code: string;
  name: string;
}

export default function ICActionPlanDetail() {
  const { profile } = useAuth();
  const navigate = useLocation();
  const planId = window.location.pathname.split('/').pop();

  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActionModal, setShowActionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'actions' | 'components' | 'departments' | 'summary'>('actions');

  const [filterStandard, setFilterStandard] = useState<string>('all');
  const [filterComponent, setFilterComponent] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const [actionForm, setActionForm] = useState({
    standard_id: '',
    title: '',
    description: '',
    responsible_department_id: '',
    start_date: '',
    target_date: '',
    priority: 'MEDIUM',
    expected_output: '',
    required_resources: ''
  });

  useEffect(() => {
    if (profile?.organization_id && planId) {
      loadData();
    }
  }, [profile?.organization_id, planId]);

  const loadData = async () => {
    try {
      const [planRes, actionsRes, departmentsRes, standardsRes, componentsRes] = await Promise.all([
        supabase
          .from('ic_action_plans')
          .select('*')
          .eq('id', planId)
          .single(),
        supabase
          .from('ic_actions')
          .select(`
            *,
            ic_standards(code, name, ic_component_id),
            departments(name)
          `)
          .eq('action_plan_id', planId)
          .order('code'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name'),
        supabase
          .from('ic_standards')
          .select('id, code, name, ic_component_id')
          .order('order_index'),
        supabase
          .from('ic_components')
          .select('id, code, name')
          .order('order_index')
      ]);

      if (planRes.error) throw planRes.error;
      if (actionsRes.error) throw actionsRes.error;

      setPlan(planRes.data);
      setActions(actionsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setStandards(standardsRes.data || []);
      setComponents(componentsRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateActionCode = () => {
    const maxCode = actions.reduce((max, action) => {
      const num = parseInt(action.code.replace(/\D/g, ''));
      return num > max ? num : max;
    }, 0);
    return `E${maxCode + 1}`;
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('ic_actions')
        .insert({
          action_plan_id: planId,
          code: generateActionCode(),
          standard_id: actionForm.standard_id,
          title: actionForm.title,
          description: actionForm.description,
          responsible_department_id: actionForm.responsible_department_id,
          start_date: actionForm.start_date || null,
          target_date: actionForm.target_date,
          priority: actionForm.priority,
          status: 'NOT_STARTED',
          progress_percent: 0,
          expected_output: actionForm.expected_output,
          required_resources: actionForm.required_resources
        });

      if (error) throw error;

      setShowActionModal(false);
      setActionForm({
        standard_id: '',
        title: '',
        description: '',
        responsible_department_id: '',
        start_date: '',
        target_date: '',
        priority: 'MEDIUM',
        expected_output: '',
        required_resources: ''
      });
      loadData();
    } catch (error) {
      console.error('Eylem eklenirken hata:', error);
      alert('Eylem eklenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      NOT_STARTED: 'bg-slate-100 text-slate-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DELAYED: 'bg-red-100 text-red-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-slate-100 text-slate-800'
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOT_STARTED: 'Başlamadı',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      DELAYED: 'Gecikmiş',
      ON_HOLD: 'Beklemede',
      CANCELLED: 'İptal Edildi'
    };
    return labels[status] || status;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      LOW: 'bg-slate-100 text-slate-700',
      MEDIUM: 'bg-blue-100 text-blue-700',
      HIGH: 'bg-orange-100 text-orange-700',
      CRITICAL: 'bg-red-100 text-red-700'
    };
    return badges[priority] || 'bg-slate-100 text-slate-700';
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      LOW: 'Düşük',
      MEDIUM: 'Orta',
      HIGH: 'Yüksek',
      CRITICAL: 'Kritik'
    };
    return labels[priority] || priority;
  };

  const getRowBgColor = (action: Action) => {
    if (action.status === 'COMPLETED') return 'bg-green-50 hover:bg-green-100';
    if (action.status === 'DELAYED') return 'bg-red-50 hover:bg-red-100';
    if (action.status === 'IN_PROGRESS') return 'hover:bg-slate-50';
    return 'bg-slate-50 hover:bg-slate-100';
  };

  const filteredActions = actions.filter(action => {
    if (filterStandard !== 'all' && action.standard_id !== filterStandard) return false;
    if (filterComponent !== 'all' && action.ic_standards?.ic_component_id !== filterComponent) return false;
    if (filterDepartment !== 'all' && action.responsible_department_id !== filterDepartment) return false;
    if (filterStatus !== 'all' && action.status !== filterStatus) return false;
    if (filterPriority !== 'all' && action.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total: actions.length,
    completed: actions.filter(a => a.status === 'COMPLETED').length,
    inProgress: actions.filter(a => a.status === 'IN_PROGRESS').length,
    delayed: actions.filter(a => a.status === 'DELAYED').length,
    notStarted: actions.filter(a => a.status === 'NOT_STARTED').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Plan bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/internal-control/action-plans')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Eylem Planlarına Dön
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{plan.name}</h1>
              {plan.description && (
                <p className="text-slate-600 mt-2">{plan.description}</p>
              )}
              <div className="flex items-center gap-6 mt-4 text-sm text-slate-600">
                <div>
                  <span className="text-slate-500">Dönem: </span>
                  <span className="font-medium text-slate-900">
                    {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Versiyon: </span>
                  <span className="font-medium text-slate-900">{plan.version || '1.0'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Düzenle
              </button>
              <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                Rapor Al
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">Toplam</span>
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
              <div className="text-xs text-blue-700 mt-1">Eylem</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">Tamamlanan</span>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-900">{stats.completed}</div>
              <div className="text-xs text-green-700 mt-1">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">Devam Eden</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-900">{stats.inProgress}</div>
              <div className="text-xs text-blue-700 mt-1">
                {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-800">Geciken</span>
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-3xl font-bold text-red-900">{stats.delayed}</div>
              <div className="text-xs text-red-700 mt-1">
                {stats.total > 0 ? Math.round((stats.delayed / stats.total) * 100) : 0}%
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-800">Başlamadı</span>
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.notStarted}</div>
              <div className="text-xs text-slate-700 mt-1">
                {stats.total > 0 ? Math.round((stats.notStarted / stats.total) * 100) : 0}%
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Genel İlerleme</span>
              <span className="text-sm font-bold text-slate-900">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'actions'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Eylemler
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'components'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Bileşen Bazlı
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'departments'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Birim Bazlı
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'summary'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Özet Rapor
          </button>
        </nav>
      </div>

      {activeTab === 'actions' && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={filterStandard}
                onChange={(e) => setFilterStandard(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              >
                <option value="all">Tüm Standartlar</option>
                {standards.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>

              <select
                value={filterComponent}
                onChange={(e) => setFilterComponent(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              >
                <option value="all">Tüm Bileşenler</option>
                {components.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              >
                <option value="all">Tüm Birimler</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="NOT_STARTED">Başlamadı</option>
                <option value="IN_PROGRESS">Devam Ediyor</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="DELAYED">Gecikmiş</option>
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              >
                <option value="all">Tüm Öncelikler</option>
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
                <option value="CRITICAL">Kritik</option>
              </select>

              <div className="ml-auto">
                <button
                  onClick={() => setShowActionModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-5 h-5" />
                  Yeni Eylem Ekle
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Kod</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Standart</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Eylem Başlığı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Sorumlu Birim</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Hedef Tarih</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">İlerleme</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Durum</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredActions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      {actions.length === 0 ? 'Henüz eylem eklenmemiş' : 'Filtreye uygun eylem bulunamadı'}
                    </td>
                  </tr>
                ) : (
                  filteredActions.map((action) => (
                    <tr key={action.id} className={getRowBgColor(action)}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {action.code}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {action.ic_standards?.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 text-sm">{action.title}</div>
                        {action.description && (
                          <div className="text-xs text-slate-500 mt-1 line-clamp-1">{action.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {action.departments?.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(action.target_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden min-w-[60px]">
                            <div
                              className="bg-green-600 h-full rounded-full"
                              style={{ width: `${action.progress_percent || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-900 min-w-[2.5rem]">
                            {action.progress_percent || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(action.status)}`}>
                          {getStatusLabel(action.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/internal-control/action-plans/${planId}/actions/${action.id}`)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-3 h-3" />
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'components' && (
        <div className="space-y-4">
          {components.map(component => {
            const componentActions = actions.filter(a => a.ic_standards?.ic_component_id === component.id);
            const completed = componentActions.filter(a => a.status === 'COMPLETED').length;
            const inProgress = componentActions.filter(a => a.status === 'IN_PROGRESS').length;
            const delayed = componentActions.filter(a => a.status === 'DELAYED').length;
            const progress = componentActions.length > 0 ? Math.round((completed / componentActions.length) * 100) : 0;

            return (
              <div key={component.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">{component.name}</h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{componentActions.length}</div>
                    <div className="text-sm text-slate-600">Toplam</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{completed}</div>
                    <div className="text-sm text-slate-600">Tamamlanan</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
                    <div className="text-sm text-slate-600">Devam Eden</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{delayed}</div>
                    <div className="text-sm text-slate-600">Geciken</div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">İlerleme</span>
                    <span className="text-sm font-bold text-slate-900">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-600 h-full rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="space-y-4">
          {departments.map(department => {
            const deptActions = actions.filter(a => a.responsible_department_id === department.id);
            const completed = deptActions.filter(a => a.status === 'COMPLETED').length;
            const inProgress = deptActions.filter(a => a.status === 'IN_PROGRESS').length;
            const delayed = deptActions.filter(a => a.status === 'DELAYED').length;
            const progress = deptActions.length > 0 ? Math.round((completed / deptActions.length) * 100) : 0;

            if (deptActions.length === 0) return null;

            return (
              <div key={department.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">{department.name}</h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{deptActions.length}</div>
                    <div className="text-sm text-slate-600">Toplam</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{completed}</div>
                    <div className="text-sm text-slate-600">Tamamlanan</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
                    <div className="text-sm text-slate-600">Devam Eden</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{delayed}</div>
                    <div className="text-sm text-slate-600">Geciken</div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">İlerleme</span>
                    <span className="text-sm font-bold text-slate-900">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-600 h-full rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Plan Özet Raporu</h3>
          <div className="prose prose-sm max-w-none">
            <p className="text-slate-600">
              <strong>{plan.name}</strong> kapsamında toplam <strong>{stats.total}</strong> eylem planlanmıştır.
            </p>
            <ul className="text-slate-600">
              <li><strong>{stats.completed}</strong> eylem tamamlanmıştır (%{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0})</li>
              <li><strong>{stats.inProgress}</strong> eylem devam etmektedir (%{stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0})</li>
              <li><strong>{stats.delayed}</strong> eylem gecikme durumundadır (%{stats.total > 0 ? Math.round((stats.delayed / stats.total) * 100) : 0})</li>
              <li><strong>{stats.notStarted}</strong> eylem henüz başlamamıştır (%{stats.total > 0 ? Math.round((stats.notStarted / stats.total) * 100) : 0})</li>
            </ul>
          </div>
        </div>
      )}

      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title="Yeni Eylem Ekle"
      >
        <form onSubmit={handleSubmitAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              İlişkili Standart <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={actionForm.standard_id}
              onChange={(e) => setActionForm({ ...actionForm, standard_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {standards.map((standard) => (
                <option key={standard.id} value={standard.id}>
                  {standard.code} - {standard.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Eylem Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              placeholder="Eylem başlığını girin"
              maxLength={500}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              rows={3}
              placeholder="Eylem detaylarını açıklayın"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={actionForm.responsible_department_id}
              onChange={(e) => setActionForm({ ...actionForm, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={actionForm.start_date}
                onChange={(e) => setActionForm({ ...actionForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hedef Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={actionForm.target_date}
                onChange={(e) => setActionForm({ ...actionForm, target_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Öncelik <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={actionForm.priority}
              onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="LOW">Düşük - Rutin eylem</option>
              <option value="MEDIUM">Orta - Normal öncelikli</option>
              <option value="HIGH">Yüksek - Önemli eylem</option>
              <option value="CRITICAL">Kritik - Acil müdahale gerekli</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Beklenen Çıktılar
            </label>
            <textarea
              value={actionForm.expected_output}
              onChange={(e) => setActionForm({ ...actionForm, expected_output: e.target.value })}
              rows={2}
              placeholder="Bu eylemden beklenen sonuçlar..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Gerekli Kaynaklar
            </label>
            <textarea
              value={actionForm.required_resources}
              onChange={(e) => setActionForm({ ...actionForm, required_resources: e.target.value })}
              rows={2}
              placeholder="Bütçe, personel, ekipman vb..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowActionModal(false)}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
