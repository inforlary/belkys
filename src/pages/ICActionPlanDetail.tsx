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
  Download,
  Trash2
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import * as XLSX from 'xlsx';

interface ActionPlan {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Action {
  id: string;
  code: string;
  title: string;
  description: string;
  standard_id: string;
  responsible_department_id: string;
  responsible_department_ids?: string[];
  responsible_department_coordinators?: {[key: string]: string};
  related_department_ids?: string[];
  related_department_coordinators?: {[key: string]: string};
  is_continuous?: boolean;
  applies_to_all_units?: boolean;
  monitoring_period?: string;
  special_responsible_type?: string;
  special_responsible?: string;
  related_special_responsible_types?: string[];
  start_date: string;
  target_date: string;
  completed_date: string | null;
  status: string;
  priority: string;
  progress_percent: number;
  expected_outputs?: string;
  outputs?: string;
  required_resources?: string;
  resources?: string;
  related_risk_id?: string;
  related_risk_control_id?: string;
  related_risk_treatment_id?: string;
  related_objective_id?: string;
  ic_standards?: {
    code: string;
    name: string;
    component_id: string;
  };
  departments?: {
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
  department_id: string;
}

interface Standard {
  id: string;
  code: string;
  name: string;
  component_id: string;
}

interface Component {
  id: string;
  code: string;
  name: string;
}

export default function ICActionPlanDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const planId = currentPath.split('/').pop() || '';

  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [controls, setControls] = useState<any[]>([]);
  const [riskActivities, setRiskActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'actions' | 'gantt' | 'components' | 'departments' | 'summary'>('actions');

  const [filterStandard, setFilterStandard] = useState<string>('all');
  const [filterComponent, setFilterComponent] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const [formStep, setFormStep] = useState(1);
  const [actionForm, setActionForm] = useState({
    code: '',
    component_id: '',
    standard_id: '',
    title: '',
    description: '',
    is_continuous: false,
    applies_to_all_units: false,
    responsible_departments: [] as string[],
    responsible_coordinators: {} as {[key: string]: string},
    related_departments: [] as string[],
    related_coordinators: {} as {[key: string]: string},
    special_responsible_type: '',
    special_responsible: '',
    related_special_responsible_types: [] as string[],
    start_date: '',
    target_date: '',
    monitoring_period: 'CONTINUOUS',
    priority: 'MEDIUM',
    expected_output: '',
    required_resources: '',
    risk_id: '',
    control_id: '',
    activity_id: '',
    goal_id: '',
    link_risk: false,
    link_control: false,
    link_activity: false,
    link_goal: false
  });

  useEffect(() => {
    console.log('[ICActionPlanDetail] Effect triggered:', {
      hasOrgId: !!profile?.organization_id,
      planId,
      currentPath
    });
    if (profile?.organization_id && planId) {
      loadData();
    }
  }, [profile?.organization_id, planId]);

  const loadData = async () => {
    try {
      console.log('[ICActionPlanDetail] Loading data for planId:', planId);
      const [planRes, actionsRes, departmentsRes, usersRes, standardsRes, componentsRes, goalsRes, risksRes, controlsRes, riskActivitiesRes] = await Promise.all([
        supabase
          .from('ic_action_plans')
          .select('*')
          .eq('id', planId)
          .single(),
        supabase
          .from('ic_actions')
          .select(`
            *,
            ic_standards(code, name, component_id),
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
          .from('profiles')
          .select('id, full_name, department_id')
          .eq('organization_id', profile?.organization_id)
          .order('full_name'),
        supabase
          .from('ic_standards')
          .select('id, code, name, component_id')
          .order('order_index'),
        supabase
          .from('ic_components')
          .select('id, code, name')
          .order('order_index'),
        supabase
          .from('goals')
          .select('id, code, title')
          .eq('organization_id', profile?.organization_id)
          .order('code'),
        supabase
          .from('risks')
          .select('id, code, name')
          .eq('organization_id', profile?.organization_id)
          .order('code'),
        supabase
          .from('risk_controls')
          .select(`
            id,
            name,
            risks!inner(organization_id)
          `)
          .eq('risks.organization_id', profile?.organization_id)
          .order('name'),
        supabase
          .from('risk_treatments')
          .select(`
            id,
            code,
            title,
            risks!inner(organization_id)
          `)
          .eq('risks.organization_id', profile?.organization_id)
          .order('code')
      ]);

      if (planRes.error) {
        console.error('[ICActionPlanDetail] Error loading plan:', planRes.error);
        console.error('[ICActionPlanDetail] Plan error details:', {
          message: planRes.error.message,
          details: planRes.error.details,
          hint: planRes.error.hint,
          code: planRes.error.code
        });
        throw planRes.error;
      }
      if (actionsRes.error) {
        console.error('[ICActionPlanDetail] Error loading actions:', actionsRes.error);
        console.error('[ICActionPlanDetail] Actions error details:', {
          message: actionsRes.error.message,
          details: actionsRes.error.details,
          hint: actionsRes.error.hint,
          code: actionsRes.error.code
        });
        throw actionsRes.error;
      }

      console.log('[ICActionPlanDetail] Plan loaded successfully:', planRes.data);
      setPlan(planRes.data);
      setActions(actionsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setUsers(usersRes.data || []);
      setStandards(standardsRes.data || []);
      setComponents(componentsRes.data || []);
      setGoals(goalsRes.data || []);
      setRisks(risksRes.data || []);
      setControls(controlsRes.data || []);
      setRiskActivities(riskActivitiesRes.data || []);
    } catch (error) {
      console.error('[ICActionPlanDetail] Error in loadData:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateActionCode = (standardId: string) => {
    if (!standardId) return '';

    const standard = standards.find(s => s.id === standardId);
    if (!standard) return '';

    const actionsForStandard = actions.filter(a => a.standard_id === standardId);
    const nextNumber = actionsForStandard.length + 1;

    return `${standard.code}.${nextNumber}`;
  };

  const handleExportReport = () => {
    if (!plan) return;

    const getStatusLabel = (status: string) => {
      const labels: Record<string, string> = {
        NOT_STARTED: 'Başlamadı',
        IN_PROGRESS: 'Devam Ediyor',
        ONGOING: 'Sürekli Devam',
        COMPLETED: 'Tamamlandı',
        DELAYED: 'Gecikmiş',
        ON_HOLD: 'Beklemede',
        CANCELLED: 'İptal Edildi'
      };
      return labels[status] || status;
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

    const getSpecialResponsibleLabel = (type: string) => {
      const labels: Record<string, string> = {
        TOP_MANAGEMENT: 'Üst Yönetim',
        INTERNAL_AUDITOR: 'İç Denetçi',
        ETHICS_COMMITTEE: 'Etik Komisyonu',
        IT_COORDINATOR: 'BT Koordinatörü',
        HR_COORDINATOR: 'İK Koordinatörü',
        QUALITY_MANAGER: 'Kalite Yöneticisi',
        RISK_COORDINATOR: 'Risk Koordinatörü',
        STRATEGY_COORDINATOR: 'Strateji Koordinatörü'
      };
      return labels[type] || type;
    };

    const reportData = actions.map((action) => {
      const responsibleDepts = action.responsible_department_ids?.map(deptId => {
        const dept = departments.find(d => d.id === deptId);
        return dept?.name || '';
      }).join(', ') || action.departments?.name || '-';

      const relatedDepts = action.related_department_ids?.map(deptId => {
        const dept = departments.find(d => d.id === deptId);
        return dept?.name || '';
      }).join(', ') || '-';

      const specialResponsible = action.special_responsible_type
        ? (action.special_responsible_type === 'OTHER'
          ? action.special_responsible
          : getSpecialResponsibleLabel(action.special_responsible_type))
        : '-';

      return {
        'Kod': action.code,
        'Standart': action.ic_standards?.code || '-',
        'Başlık': action.title,
        'Açıklama': action.description || '-',
        'Sorumlu Birimler': responsibleDepts,
        'Özel Sorumlu': specialResponsible,
        'İlgili Birimler': relatedDepts,
        'Başlangıç Tarihi': action.start_date ? new Date(action.start_date).toLocaleDateString('tr-TR') : '-',
        'Hedef Tarihi': action.is_continuous ? 'Sürekli' : (action.target_date ? new Date(action.target_date).toLocaleDateString('tr-TR') : '-'),
        'Öncelik': getPriorityLabel(action.priority),
        'Durum': getStatusLabel(action.status),
        'İlerleme (%)': action.progress_percent || 0,
        'Beklenen Çıktılar': action.expected_outputs || '-',
        'Gerekli Kaynaklar': action.required_resources || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);

    const colWidths = [
      { wch: 12 },
      { wch: 12 },
      { wch: 40 },
      { wch: 50 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 40 },
      { wch: 40 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eylemler');

    const statsData = [
      { 'Metrik': 'Toplam Eylem', 'Değer': stats.total },
      { 'Metrik': 'Tamamlanan', 'Değer': stats.completed },
      { 'Metrik': 'Devam Eden', 'Değer': stats.inProgress },
      { 'Metrik': 'Geciken', 'Değer': stats.delayed },
      { 'Metrik': 'Başlamadı', 'Değer': stats.notStarted },
      { 'Metrik': 'Tamamlanma Oranı (%)', 'Değer': stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0 }
    ];

    const statsWs = XLSX.utils.json_to_sheet(statsData);
    statsWs['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, statsWs, 'Özet İstatistikler');

    XLSX.writeFile(wb, `${plan.name}_Eylem_Plani_Raporu_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.xlsx`);
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formStep < 4) {
      setFormStep(formStep + 1);
      return;
    }

    setSaving(true);

    try {
      const actionData = {
        action_plan_id: planId,
        code: actionForm.code || generateActionCode(actionForm.standard_id),
        standard_id: actionForm.standard_id || null,
        title: actionForm.title,
        description: actionForm.description,
        is_continuous: actionForm.is_continuous,
        applies_to_all_units: actionForm.applies_to_all_units,
        responsible_department_ids: actionForm.applies_to_all_units ? null : (actionForm.responsible_departments.length > 0 ? actionForm.responsible_departments : null),
        responsible_department_coordinators: actionForm.applies_to_all_units ? null : (Object.keys(actionForm.responsible_coordinators).length > 0 ? actionForm.responsible_coordinators : null),
        related_department_ids: actionForm.applies_to_all_units ? null : (actionForm.related_departments.length > 0 ? actionForm.related_departments : null),
        related_department_coordinators: actionForm.applies_to_all_units ? null : (Object.keys(actionForm.related_coordinators).length > 0 ? actionForm.related_coordinators : null),
        special_responsible_type: actionForm.special_responsible_type || null,
        special_responsible: actionForm.special_responsible_type === 'OTHER' ? actionForm.special_responsible : null,
        related_special_responsible_types: actionForm.related_special_responsible_types.length > 0 ? actionForm.related_special_responsible_types : null,
        start_date: actionForm.start_date || null,
        target_date: actionForm.is_continuous ? null : actionForm.target_date,
        monitoring_period: actionForm.is_continuous ? actionForm.monitoring_period : null,
        priority: actionForm.priority,
        status: editingAction ? editingAction.status : (actionForm.is_continuous ? 'ONGOING' : 'NOT_STARTED'),
        progress_percent: editingAction ? editingAction.progress_percent : 0,
        expected_outputs: actionForm.expected_output || null,
        required_resources: actionForm.required_resources || null,
        related_risk_id: actionForm.link_risk && actionForm.risk_id ? actionForm.risk_id : null,
        related_risk_control_id: actionForm.link_control && actionForm.control_id ? actionForm.control_id : null,
        related_risk_treatment_id: actionForm.link_activity && actionForm.activity_id ? actionForm.activity_id : null,
        related_objective_id: actionForm.link_goal && actionForm.goal_id ? actionForm.goal_id : null
      };

      let error;
      if (editingAction) {
        const result = await supabase
          .from('ic_actions')
          .update(actionData)
          .eq('id', editingAction.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('ic_actions')
          .insert(actionData);
        error = result.error;
      }

      if (error) throw error;

      setShowActionModal(false);
      setEditingAction(null);
      setFormStep(1);
      setActionForm({
        code: '',
        component_id: '',
        standard_id: '',
        title: '',
        description: '',
        is_continuous: false,
        applies_to_all_units: false,
        responsible_departments: [],
        responsible_coordinators: {},
        related_departments: [],
        related_coordinators: {},
        special_responsible_type: '',
        special_responsible: '',
        related_special_responsible_types: [],
        start_date: '',
        target_date: '',
        monitoring_period: 'CONTINUOUS',
        priority: 'MEDIUM',
        expected_output: '',
        required_resources: '',
        risk_id: '',
        control_id: '',
        activity_id: '',
        goal_id: '',
        link_risk: false,
        link_control: false,
        link_activity: false,
        link_goal: false
      });
      loadData();
    } catch (error: any) {
      console.error('Eylem kaydedilirken hata:', error);
      const errorMessage = error?.message || 'Bilinmeyen hata';
      const errorDetails = error?.details || '';
      const errorHint = error?.hint || '';
      alert(`Eylem kaydedilirken hata:\n${errorMessage}\n${errorDetails}\n${errorHint}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAction = (action: Action) => {
    setEditingAction(action);
    setActionForm({
      code: action.code,
      component_id: action.ic_standards?.component_id || '',
      standard_id: action.standard_id || '',
      title: action.title,
      description: action.description || '',
      is_continuous: action.is_continuous || false,
      applies_to_all_units: action.applies_to_all_units || false,
      responsible_departments: action.responsible_department_ids || [],
      responsible_coordinators: action.responsible_department_coordinators || {},
      related_departments: action.related_department_ids || [],
      related_coordinators: action.related_department_coordinators || {},
      special_responsible_type: action.special_responsible_type || '',
      special_responsible: action.special_responsible || '',
      related_special_responsible_types: action.related_special_responsible_types || [],
      start_date: action.start_date || '',
      target_date: action.target_date || '',
      monitoring_period: action.monitoring_period || 'CONTINUOUS',
      priority: action.priority || 'MEDIUM',
      expected_output: action.expected_outputs || '',
      required_resources: action.required_resources || '',
      risk_id: action.related_risk_id || '',
      control_id: action.related_risk_control_id || '',
      activity_id: action.related_risk_treatment_id || '',
      goal_id: action.related_objective_id || '',
      link_risk: !!action.related_risk_id,
      link_control: !!action.related_risk_control_id,
      link_activity: !!action.related_risk_treatment_id,
      link_goal: !!action.related_objective_id
    });
    setFormStep(1);
    setShowActionModal(true);
  };

  const handleDeleteAction = async (action: Action) => {
    if (!confirm(`"${action.title}" eylemini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_actions')
        .delete()
        .eq('id', action.id);

      if (error) throw error;

      loadData();
    } catch (error) {
      console.error('Eylem silinirken hata:', error);
      alert('Eylem silinirken bir hata oluştu');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      NOT_STARTED: 'bg-slate-100 text-slate-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      ONGOING: 'bg-purple-100 text-purple-800',
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
      ONGOING: 'Sürekli Devam',
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
          onClick={() => navigate('internal-control/action-plans')}
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
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Düzenle
              </button>
              <button
                onClick={handleExportReport}
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
              >
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
            onClick={() => setActiveTab('gantt')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'gantt'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Gantt Görünümü
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
                  onClick={() => {
                    setEditingAction(null);
                    setShowActionModal(true);
                  }}
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
                    <tr
                      key={action.id}
                      className={`${getRowBgColor(action)} cursor-pointer`}
                      onClick={() => navigate(`/internal-control/action-plans/${planId}/actions/${action.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-green-600 hover:text-green-700">
                        {action.code}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {action.ic_standards?.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 text-sm hover:text-green-600">{action.title}</div>
                        {action.description && (
                          <div className="text-xs text-slate-500 mt-1 line-clamp-1">{action.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          {action.applies_to_all_units ? (
                            <div className="text-sm text-slate-900 font-medium">
                              🏢 Tüm Birimler
                            </div>
                          ) : (
                            <>
                              {action.responsible_department_ids && action.responsible_department_ids.length > 0 ? (
                                action.responsible_department_ids.map((deptId: string) => {
                                  const dept = departments.find(d => d.id === deptId);
                                  return dept ? (
                                    <div key={deptId} className="text-sm text-slate-900">
                                      🏢 {dept.name}
                                    </div>
                                  ) : null;
                                })
                              ) : action.departments?.name ? (
                                <div className="text-sm text-slate-900">
                                  🏢 {action.departments.name}
                                </div>
                              ) : null}
                            </>
                          )}
                          {action.special_responsible_type && (
                            <div className="text-sm text-blue-700 font-medium">
                              👤 {
                                action.special_responsible_type === 'TOP_MANAGEMENT' ? 'Üst Yönetim' :
                                action.special_responsible_type === 'INTERNAL_AUDITOR' ? 'İç Denetçi / İç Denetim Birimi' :
                                action.special_responsible_type === 'ETHICS_COMMITTEE' ? 'Etik Komisyonu' :
                                action.special_responsible_type === 'IT_COORDINATOR' ? 'Bilgi Teknolojileri Koordinatörü' :
                                action.special_responsible_type === 'HR_COORDINATOR' ? 'İnsan Kaynakları Koordinatörü' :
                                action.special_responsible_type === 'QUALITY_MANAGER' ? 'Kalite Yönetim Temsilcisi' :
                                action.special_responsible_type === 'RISK_COORDINATOR' ? 'Risk Koordinatörü' :
                                action.special_responsible_type === 'STRATEGY_COORDINATOR' ? 'Strateji Geliştirme Koordinatörü' :
                                action.special_responsible_type === 'OTHER' ? action.special_responsible :
                                action.special_responsible_type
                              }
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {action.is_continuous ? (
                          <div className="flex items-center gap-1">
                            <span>♾️</span>
                            <span className="text-xs">Sürekli</span>
                          </div>
                        ) : action.target_date ? (
                          new Date(action.target_date).toLocaleDateString('tr-TR')
                        ) : (
                          '-'
                        )}
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/internal-control/action-plans/${planId}/actions/${action.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-3 h-3" />
                            Detay
                          </button>
                          {(profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'super_admin') && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditAction(action);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-800"
                              >
                                <Edit2 className="w-3 h-3" />
                                Düzenle
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAction(action);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-3 h-3" />
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'gantt' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Gantt Zaman Çizelgesi</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              <div className="flex border-b border-slate-200 mb-4">
                <div className="w-64 flex-shrink-0 px-4 py-2 font-medium text-slate-700">Eylem</div>
                <div className="flex-1 relative">
                  <div className="flex">
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = new Date(plan.start_date);
                      month.setMonth(month.getMonth() + i);
                      return (
                        <div key={i} className="flex-1 text-center text-xs font-medium text-slate-600 py-2 border-l border-slate-200">
                          {month.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {actions.slice(0, 15).map((action) => {
                  const planStart = new Date(plan.start_date);
                  const planEnd = new Date(plan.end_date);
                  const actionStart = action.start_date ? new Date(action.start_date) : new Date(action.target_date);
                  const actionEnd = new Date(action.target_date);

                  const planDuration = planEnd.getTime() - planStart.getTime();
                  const actionStartOffset = actionStart.getTime() - planStart.getTime();
                  const actionDuration = actionEnd.getTime() - actionStart.getTime();

                  const startPercent = (actionStartOffset / planDuration) * 100;
                  const widthPercent = (actionDuration / planDuration) * 100;

                  const today = new Date();
                  const isDelayed = actionEnd < today && action.status !== 'COMPLETED';
                  const isCompleted = action.status === 'COMPLETED';

                  return (
                    <div key={action.id} className="flex items-center hover:bg-slate-50 rounded">
                      <div className="w-64 flex-shrink-0 px-4 py-2">
                        <div className="text-sm font-medium text-slate-900 truncate">{action.code}</div>
                        <div className="text-xs text-slate-500 truncate">{action.title}</div>
                      </div>
                      <div className="flex-1 relative h-12">
                        <div
                          className={`absolute top-2 h-8 rounded ${
                            isCompleted
                              ? 'bg-green-500'
                              : isDelayed
                              ? 'bg-red-500'
                              : action.status === 'IN_PROGRESS'
                              ? 'bg-blue-500'
                              : 'bg-slate-300'
                          }`}
                          style={{
                            left: `${Math.max(0, startPercent)}%`,
                            width: `${Math.min(100 - Math.max(0, startPercent), widthPercent)}%`,
                          }}
                        >
                          {action.progress_percent > 0 && (
                            <div
                              className="absolute inset-y-0 left-0 bg-opacity-50 bg-slate-900 rounded-l"
                              style={{ width: `${action.progress_percent}%` }}
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                            {action.progress_percent}%
                          </div>
                        </div>
                        {today >= planStart && today <= planEnd && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                            style={{
                              left: `${((today.getTime() - planStart.getTime()) / planDuration) * 100}%`,
                            }}
                          >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {actions.length > 15 && (
                <div className="mt-4 text-center text-sm text-slate-500">
                  İlk 15 eylem gösteriliyor. Tüm eylemleri görmek için Eylemler sekmesini kullanın.
                </div>
              )}

              <div className="mt-6 flex items-center gap-6 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>Tamamlandı</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span>Devam Ediyor</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-slate-300 rounded" />
                  <span>Başlamadı</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span>Gecikmiş</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-4 bg-red-500" />
                  <span>Bugün</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'components' && (
        <div className="space-y-4">
          {components.map(component => {
            const componentActions = actions.filter(a => a.ic_standards?.ic_component_id === component.id);
            const componentStandards = standards.filter(s => s.ic_component_id === component.id);
            const completed = componentActions.filter(a => a.status === 'COMPLETED').length;
            const inProgress = componentActions.filter(a => a.status === 'IN_PROGRESS').length;
            const delayed = componentActions.filter(a => a.status === 'DELAYED').length;
            const notStarted = componentActions.filter(a => a.status === 'NOT_STARTED').length;
            const progress = componentActions.length > 0 ? Math.round((completed / componentActions.length) * 100) : 0;

            if (componentActions.length === 0) return null;

            return (
              <div key={component.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">{component.code} - {component.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {componentStandards.length} standart kapsamında {componentActions.length} eylem
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div className="text-center bg-slate-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-slate-900">{componentActions.length}</div>
                      <div className="text-xs text-slate-600 mt-1">Toplam Eylem</div>
                    </div>
                    <div className="text-center bg-green-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">{completed}</div>
                      <div className="text-xs text-green-700 mt-1">
                        Tamamlanan ({componentActions.length > 0 ? Math.round((completed / componentActions.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div className="text-center bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
                      <div className="text-xs text-blue-700 mt-1">
                        Devam Eden ({componentActions.length > 0 ? Math.round((inProgress / componentActions.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div className="text-center bg-red-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-600">{delayed}</div>
                      <div className="text-xs text-red-700 mt-1">
                        Geciken ({componentActions.length > 0 ? Math.round((delayed / componentActions.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-slate-600">{notStarted}</div>
                      <div className="text-xs text-slate-700 mt-1">
                        Başlamadı ({componentActions.length > 0 ? Math.round((notStarted / componentActions.length) * 100) : 0}%)
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Tamamlanma Oranı</span>
                      <span className="text-sm font-bold text-slate-900">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Standartlar:</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {componentStandards.map(standard => {
                        const standardActions = componentActions.filter(a => a.standard_id === standard.id);
                        const standardCompleted = standardActions.filter(a => a.status === 'COMPLETED').length;
                        const standardProgress = standardActions.length > 0 ? Math.round((standardCompleted / standardActions.length) * 100) : 0;

                        return (
                          <div key={standard.id} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="text-xs font-medium text-slate-900">{standard.code}</div>
                                <div className="text-xs text-slate-600 line-clamp-2">{standard.name}</div>
                              </div>
                              <div className="text-xs font-bold text-slate-900 ml-2">{standardActions.length}</div>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-green-600 h-full rounded-full"
                                style={{ width: `${standardProgress}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
            const notStarted = deptActions.filter(a => a.status === 'NOT_STARTED').length;
            const progress = deptActions.length > 0 ? Math.round((completed / deptActions.length) * 100) : 0;

            if (deptActions.length === 0) return null;

            return (
              <div key={department.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-sky-50 px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">{department.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {deptActions.length} sorumlu eylem
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div className="text-center bg-slate-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-slate-900">{deptActions.length}</div>
                      <div className="text-xs text-slate-600 mt-1">Toplam Eylem</div>
                    </div>
                    <div className="text-center bg-green-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">{completed}</div>
                      <div className="text-xs text-green-700 mt-1">
                        Tamamlanan ({deptActions.length > 0 ? Math.round((completed / deptActions.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div className="text-center bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
                      <div className="text-xs text-blue-700 mt-1">
                        Devam Eden ({deptActions.length > 0 ? Math.round((inProgress / deptActions.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div className="text-center bg-red-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-600">{delayed}</div>
                      <div className="text-xs text-red-700 mt-1">
                        Geciken ({deptActions.length > 0 ? Math.round((delayed / deptActions.length) * 100) : 0}%)
                      </div>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-slate-600">{notStarted}</div>
                      <div className="text-xs text-slate-700 mt-1">
                        Başlamadı ({deptActions.length > 0 ? Math.round((notStarted / deptActions.length) * 100) : 0}%)
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Tamamlanma Oranı</span>
                      <span className="text-sm font-bold text-slate-900">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {delayed > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-medium">Dikkat: {delayed} eylem gecikmiş durumda</span>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Öncelik Dağılımı:</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(priority => {
                        const priorityActions = deptActions.filter(a => a.priority === priority);
                        const priorityLabels: Record<string, string> = {
                          CRITICAL: 'Kritik',
                          HIGH: 'Yüksek',
                          MEDIUM: 'Orta',
                          LOW: 'Düşük'
                        };
                        const priorityColors: Record<string, string> = {
                          CRITICAL: 'bg-red-100 text-red-700',
                          HIGH: 'bg-orange-100 text-orange-700',
                          MEDIUM: 'bg-blue-100 text-blue-700',
                          LOW: 'bg-slate-100 text-slate-700'
                        };

                        if (priorityActions.length === 0) return null;

                        return (
                          <div key={priority} className={`${priorityColors[priority]} rounded-lg p-3 text-center`}>
                            <div className="text-2xl font-bold">{priorityActions.length}</div>
                            <div className="text-xs font-medium mt-1">{priorityLabels[priority]}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Plan Özet Raporu</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-slate-700 leading-relaxed">
                <strong className="text-green-700">{plan.name}</strong> kapsamında toplam{' '}
                <strong className="text-slate-900">{stats.total}</strong> eylem planlanmıştır.
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="text-green-700">{stats.completed}</strong> eylem tamamlanmıştır
                    <span className="text-green-600 font-medium ml-2">
                      (%{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="text-blue-700">{stats.inProgress}</strong> eylem devam etmektedir
                    <span className="text-blue-600 font-medium ml-2">
                      (%{stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="text-red-700">{stats.delayed}</strong> eylem gecikme durumundadır
                    <span className="text-red-600 font-medium ml-2">
                      (%{stats.total > 0 ? Math.round((stats.delayed / stats.total) * 100) : 0})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Clock className="w-5 h-5 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="text-slate-700">{stats.notStarted}</strong> eylem henüz başlamamıştır
                    <span className="text-slate-600 font-medium ml-2">
                      (%{stats.total > 0 ? Math.round((stats.notStarted / stats.total) * 100) : 0})
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h4 className="text-base font-bold text-slate-900 mb-4">Bileşen Dağılımı</h4>
              <div className="space-y-3">
                {components.map(component => {
                  const componentActions = actions.filter(a => a.ic_standards?.ic_component_id === component.id);
                  const componentCompleted = componentActions.filter(a => a.status === 'COMPLETED').length;
                  const componentProgress = componentActions.length > 0 ? Math.round((componentCompleted / componentActions.length) * 100) : 0;

                  if (componentActions.length === 0) return null;

                  return (
                    <div key={component.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{component.name}</span>
                        <span className="text-sm font-medium text-slate-900">
                          {componentActions.length} eylem
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-600 h-full rounded-full"
                          style={{ width: `${componentProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h4 className="text-base font-bold text-slate-900 mb-4">Öncelik Dağılımı</h4>
              <div className="space-y-3">
                {[
                  { key: 'CRITICAL', label: 'Kritik', color: 'bg-red-600' },
                  { key: 'HIGH', label: 'Yüksek', color: 'bg-orange-600' },
                  { key: 'MEDIUM', label: 'Orta', color: 'bg-blue-600' },
                  { key: 'LOW', label: 'Düşük', color: 'bg-slate-600' }
                ].map(priority => {
                  const priorityActions = actions.filter(a => a.priority === priority.key);
                  const priorityCompleted = priorityActions.filter(a => a.status === 'COMPLETED').length;
                  const priorityProgress = priorityActions.length > 0 ? Math.round((priorityCompleted / priorityActions.length) * 100) : 0;

                  return (
                    <div key={priority.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{priority.label}</span>
                        <span className="text-sm font-medium text-slate-900">
                          {priorityActions.length} eylem
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`${priority.color} h-full rounded-full`}
                          style={{ width: `${priorityProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h4 className="text-base font-bold text-slate-900 mb-4">En Yüksek Performans Gösteren Birimler</h4>
            <div className="space-y-2">
              {departments
                .map(dept => {
                  const deptActions = actions.filter(a => a.responsible_department_id === dept.id);
                  const deptCompleted = deptActions.filter(a => a.status === 'COMPLETED').length;
                  const deptProgress = deptActions.length > 0 ? Math.round((deptCompleted / deptActions.length) * 100) : 0;
                  return { ...dept, actionCount: deptActions.length, progress: deptProgress };
                })
                .filter(d => d.actionCount > 0)
                .sort((a, b) => b.progress - a.progress)
                .slice(0, 5)
                .map((dept, index) => (
                  <div key={dept.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-slate-400 text-white' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-slate-300 text-slate-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900">{dept.name}</span>
                        <span className="text-sm text-slate-600">{dept.actionCount} eylem</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-600 h-full rounded-full"
                          style={{ width: `${dept.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-600 w-12 text-right">
                      {dept.progress}%
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setEditingAction(null);
          setFormStep(1);
        }}
        title={editingAction ? `Eylem Düzenle - Adım ${formStep}/4` : `Yeni Eylem Ekle - Adım ${formStep}/4`}
      >
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step < formStep
                      ? 'bg-green-600 text-white'
                      : step === formStep
                      ? 'bg-green-100 text-green-600 border-2 border-green-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < formStep ? 'bg-green-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600 text-center">
            {formStep === 1 && 'Temel Bilgiler'}
            {formStep === 2 && 'Sorumluluk'}
            {formStep === 3 && 'Zamanlama ve Öncelik'}
            {formStep === 4 && 'İlişkilendirmeler (Opsiyonel)'}
          </div>
        </div>

        <form onSubmit={handleSubmitAction} className="space-y-4">
          {formStep === 1 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-blue-900 mb-3">KİKS Standardı Seçimi</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-blue-800 mb-1">
                      Bileşen Seçin <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={actionForm.component_id}
                      onChange={(e) => {
                        setActionForm({
                          ...actionForm,
                          component_id: e.target.value,
                          standard_id: '',
                          code: ''
                        });
                      }}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Bileşen seçiniz</option>
                      {components.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.code} - {comp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {actionForm.component_id && (
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        Standart Seçin <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={actionForm.standard_id}
                        onChange={(e) => {
                          const stdId = e.target.value;
                          setActionForm({
                            ...actionForm,
                            standard_id: stdId,
                            code: stdId ? generateActionCode(stdId) : ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Standart seçiniz</option>
                        {standards
                          .filter(std => std.component_id === actionForm.component_id)
                          .map((std) => (
                            <option key={std.id} value={std.id}>
                              {std.code} - {std.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                </div>

                {actionForm.standard_id && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-300">
                    <div className="text-xs font-medium text-green-900">
                      ✓ Seçilen: {standards.find(s => s.id === actionForm.standard_id)?.code}
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      {standards.find(s => s.id === actionForm.standard_id)?.name}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Eylem Kodu <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={actionForm.code}
                    onChange={(e) => setActionForm({ ...actionForm, code: e.target.value })}
                    placeholder="KOS.01.1"
                    disabled={!actionForm.standard_id}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={!actionForm.standard_id}
                    onClick={() => setActionForm({
                      ...actionForm,
                      code: generateActionCode(actionForm.standard_id)
                    })}
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Otomatik
                  </button>
                </div>
                {actionForm.code && (
                  <div className="text-xs text-slate-500 mt-1">
                    Bu standarda ait {actions.filter(a => a.standard_id === actionForm.standard_id).length + 1}. eylem
                  </div>
                )}
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
                <div className="text-xs text-slate-500 mt-1">
                  {actionForm.title.length}/500 karakter
                </div>
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
            </>
          )}

          {formStep === 2 && (
            <>
              <div className="border-b border-slate-200 pb-4 mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Sorumluluk Kapsamı <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={!actionForm.applies_to_all_units}
                      onChange={() => setActionForm({ ...actionForm, applies_to_all_units: false })}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-sm font-medium">Belirli Birim(ler)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={actionForm.applies_to_all_units}
                      onChange={() => setActionForm({ ...actionForm, applies_to_all_units: true, responsible_departments: [], responsible_coordinators: {}, related_departments: [], related_coordinators: {} })}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-sm font-medium">Tüm Birimler</span>
                  </label>
                </div>
              </div>

              {!actionForm.applies_to_all_units && (
                <>
                  <div className="border border-green-200 rounded-lg p-4 mb-4 bg-green-50">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Sorumlu Birim/Birimler <span className="text-red-500">*</span>
                    </label>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {actionForm.responsible_departments.map((deptId) => {
                        const dept = departments.find(d => d.id === deptId);
                        const deptUsers = users.filter(u => u.department_id === deptId);
                        const selectedCoordinator = actionForm.responsible_coordinators[deptId];

                        return (
                          <div
                            key={deptId}
                            className="w-full border border-green-300 rounded-lg p-3 bg-white"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-slate-900">{dept?.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newResponsibleDepts = actionForm.responsible_departments.filter(id => id !== deptId);
                                  const newResponsibleCoords = { ...actionForm.responsible_coordinators };
                                  delete newResponsibleCoords[deptId];
                                  setActionForm({
                                    ...actionForm,
                                    responsible_departments: newResponsibleDepts,
                                    responsible_coordinators: newResponsibleCoords
                                  });
                                }}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Kaldır
                              </button>
                            </div>

                            <div className="mt-2">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Özel Sorumlu/Koordinatör (Opsiyonel)
                              </label>
                              <select
                                value={selectedCoordinator || ''}
                                onChange={(e) => {
                                  const newCoords = { ...actionForm.responsible_coordinators };
                                  if (e.target.value) {
                                    newCoords[deptId] = e.target.value;
                                  } else {
                                    delete newCoords[deptId];
                                  }
                                  setActionForm({
                                    ...actionForm,
                                    responsible_coordinators: newCoords
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              >
                                <option value="">Seçiniz (Tüm Birim Personeli)</option>
                                {deptUsers.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !actionForm.responsible_departments.includes(e.target.value)) {
                          setActionForm({
                            ...actionForm,
                            responsible_departments: [...actionForm.responsible_departments, e.target.value]
                          });
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">+ Sorumlu Birim Ekle</option>
                      {departments
                        .filter(d => !actionForm.responsible_departments.includes(d.id) && !actionForm.related_departments.includes(d.id))
                        .map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="border border-purple-200 rounded-lg p-4 mb-4 bg-purple-50">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Özel Sorumlu Rol
                    </label>

                    <select
                      value={actionForm.special_responsible_type}
                      onChange={(e) => setActionForm({ ...actionForm, special_responsible_type: e.target.value, special_responsible: '' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3"
                    >
                      <option value="">Seçiniz (Opsiyonel)</option>
                      <option value="TOP_MANAGEMENT">Üst Yönetim (Başkan/Genel Sekreter/Genel Müdür)</option>
                      <option value="INTERNAL_AUDITOR">İç Denetçi / İç Denetim Birimi</option>
                      <option value="ETHICS_COMMITTEE">Etik Komisyonu</option>
                      <option value="IT_COORDINATOR">Bilgi Teknolojileri Koordinatörü</option>
                      <option value="HR_COORDINATOR">İnsan Kaynakları Koordinatörü</option>
                      <option value="QUALITY_MANAGER">Kalite Yönetim Temsilcisi</option>
                      <option value="RISK_COORDINATOR">Risk Koordinatörü</option>
                      <option value="STRATEGY_COORDINATOR">Strateji Geliştirme Koordinatörü</option>
                      <option value="OTHER">Diğer (Manuel Giriş)</option>
                    </select>

                    {actionForm.special_responsible_type === 'OTHER' && (
                      <input
                        type="text"
                        value={actionForm.special_responsible}
                        onChange={(e) => setActionForm({ ...actionForm, special_responsible: e.target.value })}
                        placeholder="Özel sorumlu adını girin"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    )}
                  </div>

                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      İlgili Birim/Birimler
                    </label>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {actionForm.related_departments.map((deptId) => {
                        const dept = departments.find(d => d.id === deptId);
                        const deptUsers = users.filter(u => u.department_id === deptId);
                        const selectedCoordinator = actionForm.related_coordinators[deptId];

                        return (
                          <div
                            key={deptId}
                            className="w-full border border-blue-300 rounded-lg p-3 bg-white"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-slate-900">{dept?.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newRelatedDepts = actionForm.related_departments.filter(id => id !== deptId);
                                  const newRelatedCoords = { ...actionForm.related_coordinators };
                                  delete newRelatedCoords[deptId];
                                  setActionForm({
                                    ...actionForm,
                                    related_departments: newRelatedDepts,
                                    related_coordinators: newRelatedCoords
                                  });
                                }}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Kaldır
                              </button>
                            </div>

                            <div className="mt-2">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Özel Sorumlu/Koordinatör (Opsiyonel)
                              </label>
                              <select
                                value={selectedCoordinator || ''}
                                onChange={(e) => {
                                  const newCoords = { ...actionForm.related_coordinators };
                                  if (e.target.value) {
                                    newCoords[deptId] = e.target.value;
                                  } else {
                                    delete newCoords[deptId];
                                  }
                                  setActionForm({
                                    ...actionForm,
                                    related_coordinators: newCoords
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Seçiniz (Tüm Birim Personeli)</option>
                                {deptUsers.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !actionForm.related_departments.includes(e.target.value)) {
                          setActionForm({
                            ...actionForm,
                            related_departments: [...actionForm.related_departments, e.target.value]
                          });
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">+ İlgili Birim Ekle</option>
                      {departments
                        .filter(d => !actionForm.responsible_departments.includes(d.id) && !actionForm.related_departments.includes(d.id))
                        .map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      İlgili Özel Roller
                    </label>

                    <div className="space-y-2">
                      {[
                        { value: 'TOP_MANAGEMENT', label: 'Üst Yönetim (Başkan/Genel Sekreter/Genel Müdür)' },
                        { value: 'INTERNAL_AUDITOR', label: 'İç Denetçi / İç Denetim Birimi' },
                        { value: 'ETHICS_COMMITTEE', label: 'Etik Komisyonu' },
                        { value: 'IT_COORDINATOR', label: 'Bilgi Teknolojileri Koordinatörü' },
                        { value: 'HR_COORDINATOR', label: 'İnsan Kaynakları Koordinatörü' },
                        { value: 'QUALITY_MANAGER', label: 'Kalite Yönetim Temsilcisi' },
                        { value: 'RISK_COORDINATOR', label: 'Risk Koordinatörü' },
                        { value: 'STRATEGY_COORDINATOR', label: 'Strateji Geliştirme Koordinatörü' }
                      ].map((role) => (
                        <label key={role.value} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={actionForm.related_special_responsible_types.includes(role.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setActionForm({
                                  ...actionForm,
                                  related_special_responsible_types: [...actionForm.related_special_responsible_types, role.value]
                                });
                              } else {
                                setActionForm({
                                  ...actionForm,
                                  related_special_responsible_types: actionForm.related_special_responsible_types.filter(t => t !== role.value)
                                });
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {formStep === 2 && !actionForm.applies_to_all_units && actionForm.responsible_departments.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                En az bir sorumlu birim seçmelisiniz.
              </p>
            </div>
          )}

          {formStep === 3 && (
            <>
              <div className="border-b border-slate-200 pb-4 mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Eylem Türü <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="action_type"
                      checked={!actionForm.is_continuous}
                      onChange={() => setActionForm({ ...actionForm, is_continuous: false, target_date: '' })}
                      className="w-4 h-4 text-green-600 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">Süreli Eylem</span>
                      <p className="text-xs text-slate-600 mt-1">Belirli tarih aralığında tamamlanacak</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="action_type"
                      checked={actionForm.is_continuous}
                      onChange={() => setActionForm({ ...actionForm, is_continuous: true, target_date: '' })}
                      className="w-4 h-4 text-green-600 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">Sürekli Eylem</span>
                      <p className="text-xs text-slate-600 mt-1">Devamlı uygulanacak, bitiş tarihi yok</p>
                    </div>
                  </label>
                </div>
              </div>

              {!actionForm.is_continuous ? (
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
                      required={!actionForm.is_continuous}
                      value={actionForm.target_date}
                      onChange={(e) => setActionForm({ ...actionForm, target_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Yürürlük Başlangıcı
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
                        İzleme Periyodu
                      </label>
                      <select
                        value={actionForm.monitoring_period}
                        onChange={(e) => setActionForm({ ...actionForm, monitoring_period: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="CONTINUOUS">Sürekli</option>
                        <option value="MONTHLY">Aylık</option>
                        <option value="QUARTERLY">Çeyreklik</option>
                        <option value="YEARLY">Yıllık</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
                    <span className="text-blue-600 flex-shrink-0">ℹ️</span>
                    <p className="text-xs text-blue-800">
                      Bu eylem sürekli olarak uygulanacak ve belirtilen periyotlarda ilerleme raporu istenecektir.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Öncelik <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'LOW', label: 'Düşük' },
                    { value: 'MEDIUM', label: 'Orta' },
                    { value: 'HIGH', label: 'Yüksek' },
                    { value: 'CRITICAL', label: 'Kritik' }
                  ].map((priority) => (
                    <label
                      key={priority.value}
                      className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer ${
                        actionForm.priority === priority.value
                          ? 'bg-green-50 border-green-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={priority.value}
                        checked={actionForm.priority === priority.value}
                        onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}
                        className="text-green-600"
                      />
                      <span className="text-sm font-medium">{priority.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {formStep === 4 && (
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="link_risk"
                    checked={actionForm.link_risk}
                    onChange={(e) => setActionForm({ ...actionForm, link_risk: e.target.checked })}
                    className="mt-1 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="link_risk" className="font-medium text-slate-900 cursor-pointer">
                      Risk ile İlişkilendir
                    </label>
                    {actionForm.link_risk && (
                      <select
                        value={actionForm.risk_id}
                        onChange={(e) => setActionForm({ ...actionForm, risk_id: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Risk Seçiniz</option>
                        {risks.map((risk) => (
                          <option key={risk.id} value={risk.id}>
                            {risk.code} - {risk.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="link_control"
                    checked={actionForm.link_control}
                    onChange={(e) => setActionForm({ ...actionForm, link_control: e.target.checked })}
                    className="mt-1 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="link_control" className="font-medium text-slate-900 cursor-pointer">
                      Risk Kontrolü ile İlişkilendir
                    </label>
                    {actionForm.link_control && (
                      <select
                        value={actionForm.control_id}
                        onChange={(e) => setActionForm({ ...actionForm, control_id: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Kontrol Seçiniz</option>
                        {controls.map((control) => (
                          <option key={control.id} value={control.id}>
                            {control.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="link_activity"
                    checked={actionForm.link_activity}
                    onChange={(e) => setActionForm({ ...actionForm, link_activity: e.target.checked })}
                    className="mt-1 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="link_activity" className="font-medium text-slate-900 cursor-pointer">
                      Risk Faaliyeti ile İlişkilendir
                    </label>
                    {actionForm.link_activity && (
                      <select
                        value={actionForm.activity_id}
                        onChange={(e) => setActionForm({ ...actionForm, activity_id: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Faaliyet Seçiniz</option>
                        {riskActivities.map((activity) => (
                          <option key={activity.id} value={activity.id}>
                            {activity.code} - {activity.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="link_goal"
                    checked={actionForm.link_goal}
                    onChange={(e) => setActionForm({ ...actionForm, link_goal: e.target.checked })}
                    className="mt-1 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="link_goal" className="font-medium text-slate-900 cursor-pointer">
                      Stratejik Hedef ile İlişkilendir
                    </label>
                    {actionForm.link_goal && (
                      <select
                        value={actionForm.goal_id}
                        onChange={(e) => setActionForm({ ...actionForm, goal_id: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Hedef Seçiniz</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.code} - {goal.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (formStep === 1) {
                  setShowActionModal(false);
                  setEditingAction(null);
                  setFormStep(1);
                } else {
                  setFormStep(formStep - 1);
                }
              }}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              {formStep === 1 ? 'İptal' : 'Geri'}
            </button>
            <button
              type="submit"
              disabled={saving && formStep === 4}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {formStep < 4 ? 'İleri' : (saving ? 'Kaydediliyor...' : 'Kaydet')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
